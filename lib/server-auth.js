
import { createClient } from '@supabase/supabase-js'

export function getAdminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL 및 서버용 Secret Key가 설정되지 않았습니다.')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export async function authenticate(req, admin) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    return { error: '로그인이 필요합니다.', status: 401 }
  }

  // 1. 로그인 검증 전용 클라이언트
  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    return {
      error: 'Supabase 로그인 검증 설정이 없습니다.',
      status: 500,
    }
  }

  const authClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return { error: '로그인 정보가 유효하지 않습니다.', status: 401 }
  }

  // 2. 별도의 관리자 클라이언트로 프로필 조회
  const { data: profileRows, error: profileError } = await admin
    .schema('public')
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)

  const profile = profileRows?.[0] || null

  if (profileError) {
    return {
      error: `프로필 조회 오류: ${profileError.message}`,
      status: 500,
    }
  }

  if (!profile) {
    return {
      error: '사용자 프로필을 찾을 수 없습니다.',
      status: 403,
    }
  }

  return { user, profile }
}

export function send(res, status, body) {
  res.status(status).json(body)
}
