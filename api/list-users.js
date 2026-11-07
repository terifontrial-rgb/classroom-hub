
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' })
  }

  const url = process.env.SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY

  if (!url || !secret) {
    return res.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' })
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '')

    if (!token) {
      return res.status(401).json({ error: '로그인이 필요합니다.' })
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return res.status(401).json({ error: '인증에 실패했습니다.' })
    }

    const { data: requester, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !requester ||
        !['admin', 'teacher'].includes(requester.role)) {
      return res.status(403).json({ error: '계정 조회 권한이 없습니다.' })
    }

    let query = supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .order('created_at', { ascending: true })

    if (requester.role === 'teacher') {
      query = query.eq('role', 'student')
    }

    const { data, error } = await query

    if (error) {
      return res.status(500).json({ error: '계정 목록을 불러오지 못했습니다.' })
    }

    return res.status(200).json({ users: data })
  } catch {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
