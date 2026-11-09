import { getAdminClient, send } from '../lib/server-auth.js'
import { getOrCreateDailyFortune } from '../lib/daily-fortune.js'

function koreaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET 요청만 허용됩니다.' })
  const secret = process.env.CRON_SECRET
  if (!secret) return send(res, 503, { error: 'CRON_SECRET 서버 환경변수가 설정되지 않았습니다.' })
  if (req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: '인증되지 않은 요청입니다.' })

  try {
    const admin = getAdminClient()
    const today = koreaDate()

    const { data: removedMeals, error: mealDeleteError } = await admin
      .from('meals').delete().lt('meal_date', today).select('meal_date')
    if (mealDeleteError) throw mealDeleteError

    const { error: fortuneDeleteError } = await admin
      .from('daily_fortunes').delete().lt('fortune_date', today)
    if (fortuneDeleteError) throw fortuneDeleteError

    const fortune = await getOrCreateDailyFortune(admin, today)
    return send(res, 200, { date: today, deletedMealCount: removedMeals?.length || 0, ...fortune })
  } catch (error) {
    return send(res, 500, { error: error.message || '일일 정리 작업에 실패했습니다.' })
  }
}
