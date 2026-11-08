import { getAdminClient, authenticate, send } from '../lib/server-auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 요청만 허용됩니다.' })
  try {
    const admin = getAdminClient()
    const auth = await authenticate(req, admin)
    if (auth.error) return send(res, auth.status, { error: auth.error })
    const targetId = req.body?.userId
    if (!targetId || typeof targetId !== 'string') return send(res, 400, { error: '삭제할 계정 정보가 필요합니다.' })
    if (targetId === auth.user.id) return send(res, 403, { error: '본인 계정은 삭제할 수 없습니다.' })

    const { data: target, error: targetError } = await admin
      .from('profiles').select('id,role').eq('id', targetId).maybeSingle()
    if (targetError || !target) return send(res, 404, { error: '삭제할 계정을 찾을 수 없습니다.' })
    if (target.role === 'admin') return send(res, 403, { error: '관리자 계정은 삭제할 수 없습니다.' })
    if (auth.profile.role === 'teacher' && target.role !== 'student') {
      return send(res, 403, { error: '선생님은 학생 계정만 삭제할 수 있습니다.' })
    }
    if (!['admin', 'teacher'].includes(auth.profile.role)) return send(res, 403, { error: '계정을 삭제할 권한이 없습니다.' })

    // Auth 계정 삭제 -> profiles의 ON DELETE CASCADE -> 해당 작성자의 posts도 CASCADE 삭제
    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) return send(res, 500, { error: error.message })
    return send(res, 200, { success: true })
  } catch (error) {
    return send(res, 500, { error: error.message || '서버 오류가 발생했습니다.' })
  }
}
