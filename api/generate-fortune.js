import { getAdminClient, authenticate, send } from '../lib/server-auth.js'
import { getOrCreateDailyFortune } from '../lib/daily-fortune.js'

function koreaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 요청만 허용됩니다.' })
  try {
    const admin = getAdminClient()
    const auth = await authenticate(req, admin)
    if (auth.error) return send(res, auth.status, { error: auth.error })
    if (!['admin', 'teacher'].includes(auth.profile.role)) {
      return send(res, 403, { error: '선생님 또는 관리자만 오늘의 운세를 요청할 수 있습니다.' })
    }
    const fortune = await getOrCreateDailyFortune(admin, koreaDate())
    return send(res, 200, fortune)
  } catch (error) {
    const message = error.message || '오늘의 운세를 생성하지 못했습니다.'
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500
    return send(res, status, { error: message })
  }
}
