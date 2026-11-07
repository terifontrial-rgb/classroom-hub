
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' })
  }

  const url = process.env.SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY

  if (!url || !secret) {
    return res.status(500).json({ error: '서버 환경변수가 설정되지 않았습니다.' })
  }

  const supabase = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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

    if (profileError || !requester) {
      return res.status(403).json({ error: '권한을 확인할 수 없습니다.' })
    }

    const { email, password, displayName, role } = req.body || {}

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' })
    }

    if (typeof password !== 'string' || password.length < 10) {
      return res.status(400).json({ error: '비밀번호는 10자 이상이어야 합니다.' })
    }

    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: '잘못된 계정 유형입니다.' })
    }

    if (requester.role === 'teacher' && role !== 'student') {
      return res.status(403).json({ error: '선생님은 학생 계정만 생성할 수 있습니다.' })
    }

    if (requester.role !== 'admin' && requester.role !== 'teacher') {
      return res.status(403).json({ error: '계정 생성 권한이 없습니다.' })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        role,
      })
      .eq('id', data.user.id)

    if (updateError) {
      await supabase.auth.admin.deleteUser(data.user.id)
      return res.status(500).json({ error: '프로필 생성에 실패했습니다.' })
    }

    return res.status(200).json({
      message: '계정이 생성되었습니다.',
      userId: data.user.id,
    })
  } catch {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
