import { getAdminClient, authenticate, send } from '../lib/server-auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET 요청만 허용됩니다.' })
  try {
    const admin = getAdminClient()
    const auth = await authenticate(req, admin)
    if (auth.error) return send(res, auth.status, { error: auth.error })
    if (!['admin', 'teacher'].includes(auth.profile.role)) return send(res, 403, { error: '계정 목록을 볼 권한이 없습니다.' })

    let query = admin.from('profiles').select('id,email,display_name,avatar_path,role,created_at').order('created_at', { ascending: true })
    if (auth.profile.role === 'teacher') query = query.in('role', ['student', 'schedule_only'])
    const { data, error } = await query
    if (error) return send(res, 500, { error: error.message })
    return send(res, 200, { users: data || [] })
  } catch (error) {
    return send(res, 500, { error: error.message || '서버 오류가 발생했습니다.' })
  }
}
