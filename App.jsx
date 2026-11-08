
function MealsPage({role}) {
  const staff = isStaff(role)
  const [date,setDate] = useState(todayISO())
  const [title,setTitle] = useState('')
  const [description,setDescription] = useState('')
  const [files,setFiles] = useState([])
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [recognized,setRecognized] = useState([])

  const {data,busy:loading,setData}=useLoad(
    `meals-${date}`,
    ()=>supabase
      .from('meals')
      .select('*')
      .eq('meal_date',date)
      .maybeSingle()
      .then(r=>({data:r.data?[r.data]:[],error:r.error})),
    [date]
  )

  function authHeaders(token) {
    return {'Authorization':`Bearer ${token}`}
  }

  async function recognize() {
    if (!files.length) {
      setMessage('먼저 급식표 이미지 파일을 선택해 주세요.')
      return
    }

    setBusy(true)
    setMessage('Gemini가 이미지에서 날짜와 식단을 읽고 있어요.')
    setRecognized([])

    try {
      const payload = []

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error('이미지 파일만 선택할 수 있어요.')
        }
        if (file.size > 5*1024*1024) {
          throw new Error(`${file.name}: 이미지 한 장은 5MB 이하로 선택해 주세요.`)
        }

        const dataUrl = await new Promise((resolve,reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('이미지를 읽지 못했어요.'))
          reader.readAsDataURL(file)
        })

        payload.push({
          name:file.name,
          mimeType:file.type,
          data:dataUrl.split(',')[1]
        })
      }

      const {data:{session}} = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요.')
      }

      const response = await fetch('/api/recognize-meals', {
        method:'POST',
        headers:{
          ...authHeaders(session.access_token),
          'Content-Type':'application/json'
        },
        body:JSON.stringify({images:payload})
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error||'이미지 인식에 실패했어요.')

      const rows = (result.meals||[]).filter(
        x => /^\d{4}-\d{2}-\d{2}$/.test(x.meal_date)&&x.title
      )

      if (!rows.length) {
        throw new Error('날짜별 식단을 찾지 못했어요. 더 선명한 이미지로 다시 시도해 주세요.')
      }

      setRecognized(rows)
      setMessage(`${rows.length}일분을 인식했어요. 내용을 확인하고 저장해 주세요.`)
    } catch(err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveRecognized() {
    if (!recognized.length) return

    setBusy(true)
    setMessage('인식한 식단을 저장하고 있어요.')

    try {
      const rows = []

      for (const meal of recognized) {
        const imagePaths = []

        for (const file of files) {
          const path = `${meal.meal_date}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
          const {error:uploadError} = await supabase.storage
            .from('meal-images')
            .upload(path,file,{upsert:false})

          if (uploadError) throw uploadError
          imagePaths.push(path)
        }

        rows.push({
          meal_date:meal.meal_date,
          title:meal.title,
          description:meal.description||'',
          image_paths:imagePaths,
          updated_at:new Date().toISOString()
        })
      }

      const {error} = await supabase
        .from('meals')
        .upsert(rows,{onConflict:'meal_date'})

      if (error) throw error

      setRecognized([])
      setFiles([])
      setMessage(`${rows.length}일분 급식표를 저장했어요.`)
    } catch(err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveManual(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const paths = []

      for (const file of files) {
        const path = `${date}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
        const {error} = await supabase.storage
          .from('meal-images')
          .upload(path,file,{upsert:false})

        if (error) throw error
        paths.push(path)
      }

      const {error} = await supabase.from('meals').upsert({
        meal_date:date,
        title,
        description,
        image_paths:paths,
        updated_at:new Date().toISOString()
      },{onConflict:'meal_date'})

      if (error) throw error

      setFiles([])
      setTitle('')
      setDescription('')
      setMessage('급식이 저장됐어요.')

      // 저장 후 현재 날짜의 급식 다시 불러오기
      const {data:updated,error:loadError} = await supabase
        .from('meals')
        .select('*')
        .eq('meal_date',date)
        .maybeSingle()

      if (loadError) throw loadError
      setData(updated?[updated]:[])
    } catch(err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const row = data[0]

    if (!row) {
      setMessage('삭제할 급식 정보가 없어요.')
      return
    }

    if (!confirm(`${date} 급식 정보를 삭제할까요?`)) return

    setBusy(true)
    setMessage('급식 정보를 삭제하고 있어요.')

    try {
      // 데이터베이스에서 급식 삭제
      const {data:deletedRows,error} = await supabase
        .from('meals')
        .delete()
        .eq('meal_date',date)
        .select('meal_date')

      if (error) throw error

      // 삭제된 행이 없으면 권한 또는 정책을 확인
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(
          '삭제된 급식 데이터가 없어요. Supabase의 meals 테이블 DELETE 정책(RLS)을 확인해 주세요.'
        )
      }

      // 데이터베이스 삭제 성공 후 사진 삭제
      let imageMessage = ''

      if (row.image_paths?.length) {
        const {error:imageError} = await supabase
          .storage
          .from('meal-images')
          .remove(row.image_paths)

        if (imageError) {
          imageMessage = ' 사진 파일은 일부 남아 있을 수 있어요.'
        }
      }

      // 화면에서 즉시 제거
      setData([])
      setMessage(`급식 정보가 삭제됐어요.${imageMessage}`)
    } catch(err) {
      setMessage(`삭제 실패: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const imageUrl = p =>
    supabase.storage.from('meal-images').getPublicUrl(p).data.publicUrl

  return <div className="stack-lg">
    <div className="page-intro">
      <span className="eyebrow">MEAL PLAN</span>
      <h2>오늘의 식단을 확인해요.</h2>
      <p>하루·주간·월간 급식표 이미지를 Gemini로 읽어 날짜별 식단으로 등록할 수 있어요.</p>
    </div>

    <section className="panel">
      <div className="date-control">
        <label>
          날짜 선택
          <input
            type="date"
            value={date}
            onChange={e=>{
              setDate(e.target.value)
              setMessage('')
            }}
          />
        </label>
        {staff&&<span className="permission-note">선생님·관리자 편집 가능</span>}
      </div>

      {loading ? <div className="skeleton"/> : data[0] ?
        <div className="meal-content large-meal">
          {data[0].title&&<h3>{data[0].title}</h3>}
          <div className="meal-images">
            {(data[0].image_paths||[]).map((p,i)=>
              <img key={`${p}-${i}`} src={imageUrl(p)} alt={`급식 이미지 ${i+1}`}/>
            )}
          </div>
          {data[0].description&&<p>{data[0].description}</p>}
        </div>
        : <Empty>선택한 날짜의 급식이 아직 등록되지 않았어요.</Empty>}

      {staff&&<>
        <hr/>
        <SectionTitle
          title="급식표 이미지 인식"
          desc="하루치, 주간표, 월간표 이미지를 모두 선택할 수 있어요."
        />

        <div className="editor-form">
          <label className="upload-box">
            <ImagePlus/>
            급식표 이미지 선택 (최대 8개, 전체 3MB 이하)

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e=>{
                const selectedFiles = Array.from(e.currentTarget.files||[])
                setFiles(selectedFiles)
                setRecognized([])
                setMessage(
                  selectedFiles.length > 0
                    ? `${selectedFiles.length}개 파일을 선택했어요.`
                    : '선택된 파일이 없어요.'
                )
                e.currentTarget.value = ''
              }}
            />

            <small>
              {files.length > 0
                ? `${files.length}개 파일 선택됨`
                : '선택된 파일이 없습니다.'}
            </small>

            {files.length > 0&&
              <small>{files.map(file=>file.name).join(', ')}</small>}
          </label>

          <button
            type="button"
            className="button"
            disabled={busy||!files.length}
            onClick={recognize}
          >
            {busy?'처리 중...':'Gemini로 식단 인식'}
          </button>

          {recognized.length>0&&<>
            <div className="recognized-meals">
              <h3>인식 결과 확인 ({recognized.length}일)</h3>
              {recognized.map((meal,i)=>
                <div className="recognized-row" key={`${meal.meal_date}-${i}`}>
                  <label>
                    날짜
                    <input
                      type="date"
                      value={meal.meal_date}
                      onChange={e=>setRecognized(old=>old.map(
                        (x,j)=>j===i?{...x,meal_date:e.target.value}:x
                      ))}
                    />
                  </label>
                  <label>
                    식단
                    <textarea
                      value={meal.title}
                      onChange={e=>setRecognized(old=>old.map(
                        (x,j)=>j===i?{...x,title:e.target.value}:x
                      ))}
                    />
                  </label>
                  <label>
                    안내
                    <textarea
                      value={meal.description||''}
                      onChange={e=>setRecognized(old=>old.map(
                        (x,j)=>j===i?{...x,description:e.target.value}:x
                      ))}
                    />
                  </label>
                </div>
              )}
            </div>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={saveRecognized}
            >
              확인한 {recognized.length}일분 저장
            </button>
          </>}

          {message&&<p className="inline-message">{message}</p>}
        </div>

        <hr/>

        <SectionTitle
          title="직접 급식 입력"
          desc="이미지를 인식하지 않고 한 날짜의 급식을 직접 등록할 수도 있어요."
        />

        <form className="editor-form" onSubmit={saveManual}>
          <label>
            식단 제목
            <input
              value={title}
              onChange={e=>setTitle(e.target.value)}
              placeholder="예: 11월 7일 점심"
              required
            />
          </label>
          <label>
            안내
            <textarea
              value={description}
              onChange={e=>setDescription(e.target.value)}
              placeholder="알레르기 안내 등"
            />
          </label>
          <button className="button" disabled={busy}>
            {busy?'저장 중...':'선택한 날짜에 저장'}
          </button>
          {data[0]&&
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={remove}
            >
              {busy?'처리 중...':'현재 날짜 급식 삭제'}
            </button>
          )}
          {message&&<p className="inline-message">{message}</p>}
        </form>
      </>}
    </section>
  </div>
}
