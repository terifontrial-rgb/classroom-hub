export async function getOrCreateDailyFortune(admin, date) {
  const { data: existing, error: readError } = await admin
    .from('daily_fortunes').select('fortune_date,content').eq('fortune_date', date).maybeSingle()
  if (readError) throw readError
  if (existing) return { content: existing.content, alreadyCreated: true }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY 서버 환경변수가 설정되지 않았습니다.')
  const prompt = `오늘은 ${date}입니다. 한국어로 학급 구성원 모두가 함께 읽을 수 있는 짧은 오늘의 운세를 작성하세요. 개인별 별자리나 생년월일을 전제하지 말고, 3~4문장으로 따뜻하고 구체적인 하루 조언을 포함하세요. 운세는 가벼운 오락 콘텐츠이며 사실이나 미래를 보장하는 표현은 피하세요. 제목이나 마크다운 없이 본문만 출력하세요.`
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 220 }
    })
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error?.message || 'Gemini 운세 생성 요청에 실패했습니다.')
  const content = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
  if (!content) throw new Error('Gemini가 오늘의 운세를 반환하지 않았습니다.')

  const { error: saveError } = await admin.from('daily_fortunes').upsert(
    { fortune_date: date, content }, { onConflict: 'fortune_date' }
  )
  if (saveError) throw saveError
  return { content, alreadyCreated: false }
}
