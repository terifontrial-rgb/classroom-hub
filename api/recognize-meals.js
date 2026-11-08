import { getAdminClient, authenticate, send } from '../lib/server-auth.js'

const MAX_TOTAL_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST 요청만 허용됩니다.' })
  try {
    const supabase = getAdminClient()
    const auth = await authenticate(req, supabase)
    if (auth.error) return send(res, auth.status, { error: auth.error })
    if (!['admin', 'teacher'].includes(auth.profile.role)) return send(res, 403, { error: '급식표를 인식할 권한이 없습니다.' })
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return send(res, 500, { error: '서버에 GEMINI_API_KEY 환경변수를 설정해 주세요.' })

    const images = req.body?.images
    if (!Array.isArray(images) || images.length < 1 || images.length > 8) {
      return send(res, 400, { error: '이미지는 1~8개까지 선택할 수 있습니다.' })
    }
    let total = 0
    const parts = []
    for (const image of images) {
      if (!ALLOWED_TYPES.has(image.mimeType) || typeof image.data !== 'string') {
        return send(res, 400, { error: 'JPG, PNG, WEBP 이미지 파일만 지원합니다.' })
      }
      total += Buffer.byteLength(image.data, 'base64')
      if (total > MAX_TOTAL_BYTES) return send(res, 413, { error: '선택한 이미지 전체 용량은 3MB 이하로 줄여 주세요.' })
      parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } })
    }

    const prompt = `당신은 학교 급식표를 구조화하는 도우미입니다. 첨부한 이미지에서 날짜별 식단을 읽으세요. 하루치, 주간표, 월간표를 모두 지원합니다. 날짜를 확실히 읽을 수 있는 날만 반환하고, 이미지에 없는 날짜나 메뉴를 추측하지 마세요. 날짜는 YYYY-MM-DD 형식으로 변환하세요. title에는 해당 날짜의 점심/저녁 등 메뉴 전체를 줄바꿈으로 구분해 넣고, description에는 알레르기 번호, 원산지, 아침/저녁 구분 등 부가 안내를 넣으세요. 같은 날짜가 여러 이미지에 중복되면 하나로 합치세요. 날짜를 판독할 수 없으면 빈 배열을 반환하세요. JSON 외의 설명은 출력하지 마세요. 형식: {"meals":[{"meal_date":"2026-11-08","title":"쌀밥\\n된장국\\n...","description":"알레르기 안내"}]}`
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...parts] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } })
    })
    const result = await response.json()
    if (!response.ok) return send(res, 502, { error: result.error?.message || 'Gemini 이미지 인식 요청에 실패했습니다.' })
    const raw = result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
    let parsed
    try { parsed = JSON.parse(raw) } catch { return send(res, 502, { error: 'Gemini 응답을 식단 데이터로 변환하지 못했습니다. 이미지를 더 선명하게 올려 주세요.' }) }
    const meals = Array.isArray(parsed.meals) ? parsed.meals.filter(m => /^\d{4}-\d{2}-\d{2}$/.test(m.meal_date) && typeof m.title === 'string') : []
    return send(res, 200, { meals })
  } catch (error) {
    return send(res, 500, { error: error.message || '서버 오류가 발생했습니다.' })
  }
}
