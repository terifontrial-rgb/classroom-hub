import { getAdminClient, authenticate, send } from '../lib/server-auth.js'

const SCHOOL_OFFICE_CODE = 'J10' // 경기도교육청
const SCHOOL_CODE = '7531240' // 한백고등학교

function koreaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dateRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  if (monthNumber < 1 || monthNumber > 12) return null
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function menuText(row) {
  return (row.DDISH_NM || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 요청만 허용됩니다.' })

  try {
    const admin = getAdminClient()
    const auth = await authenticate(req, admin)
    if (auth.error) return send(res, auth.status, { error: auth.error })
    if (!['admin', 'teacher'].includes(auth.profile.role)) {
      return send(res, 403, { error: '선생님 또는 관리자만 급식을 가져올 수 있습니다.' })
    }
    if (!process.env.NEIS_API_KEY) return send(res, 503, { error: 'NEIS_API_KEY 서버 환경변수가 설정되지 않았습니다.' })

    const month = typeof req.body?.month === 'string' ? req.body.month : ''
    const date = typeof req.body?.date === 'string' ? req.body.date : ''
    const range = month
      ? dateRange(month)
      : /^\d{4}-\d{2}-\d{2}$/.test(date) ? { from: date, to: date } : null
    if (!range) return send(res, 400, { error: '월(YYYY-MM) 또는 날짜(YYYY-MM-DD) 형식이 올바르지 않습니다.' })

    const today = koreaDate()
    if (date && date < today) return send(res, 400, { error: '지난 날짜의 급식은 다시 저장하지 않습니다.' })

    const params = new URLSearchParams({
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '100',
      ATPT_OFCDC_SC_CODE: SCHOOL_OFFICE_CODE,
      SD_SCHUL_CODE: SCHOOL_CODE,
      MLSV_FROM_YMD: range.from.replaceAll('-', ''),
      MLSV_TO_YMD: range.to.replaceAll('-', '')
    })
    const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?${params}`)
    if (!response.ok) throw new Error(`나이스 API 응답 오류 (${response.status})`)
    const result = await response.json()
    const apiError = result.RESULT || result.mealServiceDietInfo?.[0]?.head?.find(item => item.RESULT)?.RESULT
    if (apiError && apiError.CODE !== 'INFO-000' && apiError.CODE !== 'INFO-200') {
      throw new Error(apiError.MESSAGE || `나이스 오류 ${apiError.CODE}`)
    }

    const byDate = new Map()
    for (const row of result.mealServiceDietInfo?.[1]?.row || []) {
      if (!/^\d{8}$/.test(String(row.MLSV_YMD || ''))) continue
      const mealDate = `${row.MLSV_YMD.slice(0, 4)}-${row.MLSV_YMD.slice(4, 6)}-${row.MLSV_YMD.slice(6, 8)}`
      if (mealDate < today) continue
      const text = menuText(row)
      if (!text) continue
      const menus = byDate.get(mealDate) || []
      menus.push(`${row.MMEAL_SC_NM ? `[${row.MMEAL_SC_NM}]\n` : ''}${text}`)
      byDate.set(mealDate, menus)
    }
    const meals = [...byDate].map(([meal_date, menus]) => ({
      meal_date,
      title: menus.join('\n\n'),
      description: '',
      image_paths: [],
      updated_at: new Date().toISOString()
    }))

    // Service role로 저장해 브라우저 RLS 정책의 DELETE/UPSERT 제약을 피하고,
    // 요청한 교사/관리자 권한은 위 authenticate 검사로 유지합니다.
    const { data: removed, error: deleteError } = await admin
      .from('meals').delete().lt('meal_date', today).select('meal_date')
    if (deleteError) throw deleteError
    if (meals.length) {
      const { error: upsertError } = await admin.from('meals').upsert(meals, { onConflict: 'meal_date' })
      if (upsertError) throw upsertError
    }

    return send(res, 200, month
      ? { meals, deletedPastCount: removed?.length || 0 }
      : { meal: meals[0] || null, deletedPastCount: removed?.length || 0 })
  } catch (error) {
    return send(res, 500, { error: error.message || '나이스 급식을 가져오지 못했습니다.' })
  }
}
