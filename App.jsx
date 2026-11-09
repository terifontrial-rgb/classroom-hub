import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, Utensils, Clock3, MessageSquare, Shield, LogOut,
  Plus, ChevronLeft, ChevronRight, Pin, ImagePlus, Trash2, Menu,
  X, Sparkles, Users, BookOpen, RefreshCw
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './supabase'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const timetableWeekdays = weekdays.slice(1, 6)
const roleLabel = { admin: '관리자', teacher: '선생님', student: '학생' }
const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
const isStaff = (role) => role === 'admin' || role === 'teacher'
const cleanMealDescription = (value) => /(?:\d+(?:\.\d+)?\s*kcal|쇠고기|돼지고기|닭고기|오리고기|원산지|비고\s*:)/i.test(value || '') ? '' : value

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) loadProfile(next.user)
      else { setProfile(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadProfile(user) {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) setNotice(`프로필을 불러오지 못했습니다: ${error.message}`)
    setProfile(data)
    setLoading(false)
  }

  async function signOut() { await supabase.auth.signOut(); setPage('home') }
  const refresh = () => setRefreshKey(v => v + 1)

  if (!isSupabaseConfigured) return <SetupScreen />
  if (loading) return <div className="center-screen"><div className="loader" /><p>교실 허브를 준비하고 있어요.</p></div>
  if (!session) return <AuthScreen />
  if (!profile) return <div className="center-screen"><h2>프로필을 찾을 수 없어요.</h2><p>SQL의 프로필 생성 트리거가 실행됐는지 확인해 주세요.</p><button className="button" onClick={() => loadProfile(session.user)}>다시 시도</button><button className="text-button" onClick={signOut}>로그아웃</button></div>

  const nav = [
    ['home', '홈', Sparkles], ['meals', '급식', Utensils], ['timetable', '시간표', Clock3],
    ['calendar', '일정', CalendarDays], ['board', '자유게시판', MessageSquare], ['fortune', '오늘의 운세', Sparkles], ['profile', '내 프로필', Users],
    ...(isStaff(profile.role) ? [['users', '계정 관리', Users]] : [])
  ]

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">C</div><div><b>우리반 허브</b><small>CLASSROOM HUB</small></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="class-chip"><span className="status-dot"/> 우리 반 공간</div>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => {setPage(id);setMenuOpen(false)}}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><Avatar profile={profile} fallback={session.user.email}/><div className="profile-text"><b>{profile.display_name || session.user.email}</b><small>{roleLabel[profile.role] || '학생'}</small></div></div><button className="nav-item" onClick={signOut}><LogOut size={18}/> 로그아웃</button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)}><Menu/></button><div><span className="eyebrow">YOUR CLASS, IN ONE PLACE</span><h1>{nav.find(x => x[0] === page)?.[1] || '우리 반'}</h1></div><div className="top-actions"><span className="role-pill">{roleLabel[profile.role]}</span><button className="icon-button" title="새로고침" onClick={refresh}><RefreshCw size={17}/></button></div></header>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>닫기</button></div>}
      <div className="page-content" key={`${page}-${refreshKey}`}>
        {page === 'home' && <HomePage role={profile.role} go={setPage}/>}
        {page === 'meals' && <MealsPage role={profile.role}/>}
        {page === 'timetable' && <TimetablePage role={profile.role}/>}
        {page === 'calendar' && <CalendarPage role={profile.role}/>}
        {page === 'board' && <BoardPage role={profile.role} userId={session.user.id}/>}
        {page === 'fortune' && <DailyFortunePage role={profile.role}/>}
        {page === 'profile' && <ProfilePage profile={profile} userId={session.user.id} onSaved={loadProfile}/>}
        {page === 'users' && isStaff(profile.role) && <UsersPage currentUser={session.user.id} role={profile.role}/>}
      </div>
      <footer className="footer">우리 반의 하루를 더 편리하게 <span>·</span> Classroom Hub</footer>
    </main>
  </div>
}

function Avatar({profile, fallback='?'}) {
  const src = profile?.avatar_path ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl : ''
  return <div className="avatar">{src ? <img src={src} alt="프로필 사진"/> : (profile?.display_name || fallback || '?').slice(0,1).toUpperCase()}</div>
}

function ProfilePage({profile,userId,onSaved}) {
  const [name,setName]=useState(profile.display_name||''),[file,setFile]=useState(null),[cropFile,setCropFile]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{setName(profile.display_name||'')},[profile.display_name])
  async function save(e){e.preventDefault();setBusy(true);setMessage('')
    try {
      let avatar_path=profile.avatar_path||null
      if(file){if(!file.type.startsWith('image/'))throw new Error('이미지 파일을 선택해 주세요.');if(file.size>5*1024*1024)throw new Error('사진은 5MB 이하로 선택해 주세요.')
        const path=`${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
        const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,file,{upsert:false});if(uploadError)throw uploadError;avatar_path=path
      }
      const {error}=await supabase.from('profiles').update({display_name:name.trim(),avatar_path}).eq('id',userId);if(error)throw error
      setFile(null);setMessage('프로필을 저장했어요.');await onSaved((await supabase.auth.getUser()).data.user)
    }catch(error){setMessage(`저장 실패: ${error.message}`)}finally{setBusy(false)}
  }
  async function resetAvatar(){if(!profile.avatar_path&&!file)return;setBusy(true);setMessage('');try{const {error}=await supabase.from('profiles').update({avatar_path:null}).eq('id',userId);if(error)throw error;setFile(null);setMessage('기본 프로필 사진으로 되돌렸어요.');await onSaved((await supabase.auth.getUser()).data.user)}catch(error){setMessage(`기본 사진으로 되돌리지 못했어요: ${error.message}`)}finally{setBusy(false)}}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">MY PROFILE</span><h2>내 프로필을 바꿔요.</h2><p>이름과 프로필 사진은 본인, 선생님, 관리자가 변경할 수 있어요.</p></div><section className="panel"><form className="editor-form" onSubmit={save}><div className="profile-edit-preview"><Avatar profile={{...profile,display_name:name}}/><span>{roleLabel[profile.role]}</span></div><label>이름<input value={name} onChange={e=>setName(e.target.value)} maxLength="80" required/></label><label className="upload-box"><ImagePlus/> 프로필 사진 선택<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const picked=e.target.files?.[0];if(picked){setCropFile(picked);e.target.value=''}}}/><small>{cropFile?.name ? `선택됨: ${cropFile.name} · 사진 조정 후 저장` : file?.name ? `선택됨: ${file.name}` : 'PNG/JPG/WebP · 최대 5MB'}</small></label><div className="button-row"><button className="button" disabled={busy}>{busy?'저장 중...':'프로필 저장'}</button><button type="button" className="danger-button" disabled={busy||(!profile.avatar_path&&!file)} onClick={resetAvatar}>기본 사진으로 되돌리기</button></div>{message&&<p className="inline-message">{message}</p>}</form></section>{cropFile&&<ImageCropDialog file={cropFile} onCancel={()=>setCropFile(null)} onCrop={cropped=>{setFile(cropped);setCropFile(null)}}/>}</div>
}

function ImageCropDialog({file,onCrop,onCancel}) {
  const viewport=240,imageRef=useRef(null),drag=useRef(null),[url,setUrl]=useState(''),[size,setSize]=useState(null),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0})
  useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file])
  const base=size?Math.max(viewport/size.width,viewport/size.height):1
  const width=size?size.width*base*zoom:viewport,height=size?size.height*base*zoom:viewport
  function loaded(e){const img=e.currentTarget;setSize({width:img.naturalWidth,height:img.naturalHeight});const fit=Math.max(viewport/img.naturalWidth,viewport/img.naturalHeight);setOffset({x:(viewport-img.naturalWidth*fit)/2,y:(viewport-img.naturalHeight*fit)/2})}
  function clamp(x,y,w=width,h=height){return {x:Math.min(0,Math.max(viewport-w,x)),y:Math.min(0,Math.max(viewport-h,y))}}
  function setZoomed(value){const next=Math.max(1,Math.min(3,value));const ratio=next/zoom;setZoom(next);setOffset(old=>clamp(viewport/2-(viewport/2-old.x)*ratio,viewport/2-(viewport/2-old.y)*ratio, size.width*base*next,size.height*base*next))}
  function finish(){const img=imageRef.current;if(!img||!size)return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),scale=width/size.width;ctx.drawImage(img,-offset.x/scale,-offset.y/scale,viewport/scale,viewport/scale,0,0,512,512);canvas.toBlob(blob=>{if(blob)onCrop(new File([blob],'profile-photo.jpg',{type:'image/jpeg'}))},'image/jpeg',.92)}
  return <div className="crop-backdrop" role="dialog" aria-modal="true" aria-label="프로필 사진 자르기"><section className="crop-dialog"><h2>프로필 사진 조정</h2><p>사진을 끌어 원 안에 원하는 부분을 맞춰 주세요.</p><div className="crop-stage" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX-offset.x,y:e.clientY-offset.y}}} onPointerMove={e=>{if(drag.current)setOffset(clamp(e.clientX-drag.current.x,e.clientY-drag.current.y))}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>{url&&<img ref={imageRef} src={url} onLoad={loaded} alt="자르기 미리보기" draggable="false" style={{width,height,left:offset.x,top:offset.y}}/>}<div className="crop-circle"/></div><label className="crop-zoom">확대/축소<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e=>setZoomed(Number(e.target.value))}/></label><div className="button-row"><button type="button" className="danger-button" onClick={onCancel}>취소</button><button type="button" className="button" disabled={!size} onClick={finish}>이 사진 사용</button></div></section></div>
}

function SetupScreen() {
  return <div className="center-screen"><div className="brand-mark large">C</div><h1>우리반 허브</h1><p>시작하기 전에 Supabase 연결 설정이 필요해요.</p><div className="setup-card"><b>1.</b> 프로젝트 폴더의 <code>.env.example</code>을 복사해 <code>.env</code>로 이름을 바꾸세요.<br/><b>2.</b> Supabase 프로젝트 URL과 Publishable Key를 입력하세요.<br/><b>3.</b> 터미널에서 개발 서버를 다시 실행하세요.</div></div>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } }
          })

      if (result.error) {
        setMessage(result.error.message)
      } else if (mode === 'signup') {
        setMessage('가입 요청이 완료됐어요. 이메일 인증이 켜져 있다면 메일을 확인한 뒤 로그인해 주세요.')
      }
    } catch (error) {
      setMessage(error.message || '요청을 처리하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-layout">
    <div className="auth-art">
      <div className="brand-mark large">C</div>
      <span className="eyebrow">A CALMER CLASSROOM</span>
      <h1>우리 반의 하루를<br/>한곳에서 관리해요.</h1>
      <p>급식부터 시간표, 일정과 소식까지<br/>교실 생활에 필요한 정보를 한눈에.</p>
      <div className="art-orbit">✳</div>
    </div>
    <div className="auth-panel">
      <div className="auth-card">
        <span className="eyebrow">WELCOME</span>
        <h2>{mode === 'login' ? '다시 만나서 반가워요' : '새 계정 만들기'}</h2>
        <p>우리 반 허브에 {mode === 'login' ? '로그인' : '가입'}해 주세요.</p>
        <form onSubmit={submit}>
          {mode === 'signup' && <label>이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="이름" required/></label>}
          <label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>
          <label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호" minLength="6" required/></label>
          <button className="button full" disabled={busy}>{busy ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}</button>
        </form>
        {message && <div className="inline-message">{message}</div>}
        <button type="button" className="text-button" onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setMessage('')}}>
          {mode === 'login' ? '처음 방문했나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
        <small className="auth-note">학생은 회원가입 후 기본적으로 학생 권한이 부여됩니다.</small>
      </div>
    </div>
  </div>
}

function useLoad(queryKey, loader, deps=[]) {
  const [data,setData]=useState([]); const [busy,setBusy]=useState(true); const [error,setError]=useState('')
  const depString = JSON.stringify(deps)
  useEffect(()=>{let alive=true;setBusy(true);loader().then(({data,error})=>{if(!alive)return;if(error)setError(error.message);else setData(data||[]);setBusy(false)});return()=>{alive=false}},[queryKey,depString])
  return {data,busy,error,setData}
}
function Empty({children='아직 등록된 내용이 없어요.'}) { return <div className="empty-state"><div className="empty-icon">✳</div>{children}</div> }
function SectionTitle({title,desc,action}) { return <div className="section-heading"><div><h2>{title}</h2>{desc&&<p>{desc}</p>}</div>{action}</div> }

function HomePage({role,go}) {
  const today=todayISO()
  const meals=useLoad('home-meals',()=>supabase.from('meals').select('*').eq('meal_date',today).maybeSingle().then(r=>({data:r.data?[r.data]:[],error:r.error})))
  const dayIndex=new Date().getDay()
  const timetable=useLoad('home-time',()=>dayIndex>=1&&dayIndex<=5?supabase.from('timetable_entries').select('*').eq('weekday',dayIndex).order('period'):Promise.resolve({data:[],error:null}))
  const events=useLoad('home-events',()=>supabase.from('events').select('*').gte('event_date',today).order('event_date').limit(5))
  const posts=useLoad('home-posts',()=>supabase.from('posts').select('*').eq('is_important',true).order('created_at',{ascending:false}).limit(3))
  const fortune=useLoad('home-fortune',()=>supabase.from('daily_fortunes').select('content').eq('fortune_date',today).maybeSingle().then(r=>({data:r.data?[r.data]:[],error:r.error})))
  const nextDday=events.data.find(e=>e.is_dday)
  const daysLeft=nextDday?Math.ceil((new Date(`${nextDday.event_date}T00:00:00`)-new Date(`${today}T00:00:00`))/86400000):null
  return <div className="stack-lg">
    <div className="welcome-row"><div><span className="eyebrow">{dateLabel(today)}</span><h2>오늘도 좋은 하루 보내요 <span>✳</span></h2><p>우리 반의 오늘을 확인해 보세요.</p></div><div className="weather-art">☼</div></div>
    <div className="dashboard-grid">
      <section className="panel meal-panel"><SectionTitle title="오늘의 급식" desc="오늘 식단을 확인해요" action={<button className="subtle-link" onClick={()=>go('meals')}>전체 보기 ↗</button>}/>{meals.busy?<div className="skeleton"/>:meals.data[0]?<div className="meal-content">{meals.data[0].title&&<b>{meals.data[0].title}</b>}<div className="meal-images">{(meals.data[0].image_paths||[]).map((p,i)=><img key={p} src={supabase.storage.from('meal-images').getPublicUrl(p).data.publicUrl} alt={`오늘 급식 ${i+1}`}/>)}</div>{cleanMealDescription(meals.data[0].description)&&<p>{cleanMealDescription(meals.data[0].description)}</p>}</div>:<Empty>오늘 등록된 급식이 없어요.</Empty>}</section>
      <section className="panel dday-panel"><SectionTitle title="다가오는 중요한 날" desc="우리 반의 주요 일정"/>{nextDday?<><div className="dday-number">{daysLeft===0?'D-DAY':daysLeft>0?`D-${daysLeft}`:`D+${Math.abs(daysLeft)}`}</div><h3>{nextDday.title}</h3><p>{dateLabel(nextDday.event_date)}</p><button className="subtle-link" onClick={()=>go('calendar')}>일정 확인하기 ↗</button></>:<Empty>등록된 D-DAY 일정이 없어요.</Empty>}</section>
      <section className="panel"><SectionTitle title="오늘의 시간표" desc={`${weekdays[dayIndex]}요일 수업`} action={<button className="subtle-link" onClick={()=>go('timetable')}>시간표 보기 ↗</button>}/>{timetable.busy?<div className="skeleton"/>:timetable.data.length?<div className="mini-timetable">{timetable.data.map(row=><div className="mini-period" key={row.id}><span>{row.period}교시</span><b>{row.subject}</b><small>{row.room||''}</small></div>)}</div>:<Empty>오늘 시간표가 등록되지 않았어요.</Empty>}</section>
      <section className="panel"><SectionTitle title="중요한 공지" desc="놓치지 말아야 할 소식" action={<button className="subtle-link" onClick={()=>go('board')}>게시판 ↗</button>}/>{posts.data.length?<div className="notice-list">{posts.data.map(p=><div key={p.id}><Pin size={14}/><span>{p.title}</span></div>)}</div>:<Empty>중요 공지가 없어요.</Empty>}</section>
      <section className="panel fortune-preview"><SectionTitle title="오늘 하루 운세" desc="우리 반의 오늘을 위한 한마디" action={<button className="subtle-link" onClick={()=>go('fortune')}>운세 보기 ↗</button>}/>{fortune.busy?<div className="skeleton"/>:fortune.error?<p className="inline-message">운세 테이블을 찾지 못했어요. Supabase SQL Editor에서 sql/06_daily_fortunes.sql을 실행해 주세요.</p>:fortune.data[0]?<p>{fortune.data[0].content}</p>:<Empty>오늘의 운세를 준비하고 있어요.</Empty>}</section>
    </div>
    <section className="panel event-strip"><SectionTitle title="다가오는 일정" desc="예정된 우리 반 이벤트"/><div className="upcoming-list">{events.data.length?events.data.map(e=><div className="upcoming-item" key={e.id}><div className="date-tile"><b>{new Date(`${e.event_date}T00:00:00`).getDate()}</b><small>{weekdays[new Date(`${e.event_date}T00:00:00`).getDay()]}요일</small></div><div><b>{e.title}</b><p>{e.description||'등록된 설명이 없습니다.'}</p></div>{e.is_dday&&<span className="tag">D-DAY</span>}</div>):<Empty>예정된 일정이 없어요.</Empty>}</div></section>
  </div>
}

function DailyFortunePage({role}) {
  const today=todayISO()
  const {data,busy,error,setData}=useLoad(`fortune-${today}`,()=>supabase.from('daily_fortunes').select('fortune_date,content').eq('fortune_date',today).maybeSingle().then(r=>({data:r.data?[r.data]:[],error:r.error})))
  const [requesting,setRequesting]=useState(false),[message,setMessage]=useState('')
  async function requestFortune(){setRequesting(true);setMessage('오늘의 운세를 만들고 있어요.');try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');const response=await fetch('/api/generate-fortune',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});const body=await response.text();let result;try{result=JSON.parse(body)}catch{throw new Error('운세 API 응답을 읽지 못했어요. npm run dev 서버를 다시 시작해 주세요.')}if(!response.ok)throw new Error(result.error||'운세를 생성하지 못했어요.');setData([{fortune_date:today,content:result.content}]);setMessage(result.alreadyCreated?'오늘 운세가 이미 만들어져 있어요.':'오늘의 운세를 만들었어요.')}catch(error){const text=error.message||'오류가 발생했습니다.';setMessage(text.includes('daily_fortunes')||text.includes('schema cache')?'Supabase에 운세 테이블이 없어요. sql/06_daily_fortunes.sql을 Supabase SQL Editor에서 실행해 주세요.':text)}finally{setRequesting(false)}}
  const missingTable=error&&(/daily_fortunes|schema cache|PGRST205/i.test(error))
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">DAILY FORTUNE</span><h2>오늘 하루 운세</h2><p>{dateLabel(today)} · 우리 반이 함께 읽는 오늘의 한마디</p></div><section className="panel fortune-panel">{busy?<div className="skeleton"/>:error?<p className="inline-message">{missingTable?'Supabase에 운세 테이블이 없어요. sql/06_daily_fortunes.sql을 Supabase SQL Editor에서 실행한 뒤 다시 불러와 주세요.':`운세를 불러오지 못했어요: ${error}`}</p>:data[0]?<><span className="fortune-mark">✳</span><p className="fortune-copy">{data[0].content}</p></>:<><Empty>오늘의 운세를 아직 준비하지 못했어요.</Empty>{isStaff(role)&&<button className="button" type="button" disabled={requesting} onClick={requestFortune}>{requesting?'요청 중...':'관리자·선생님이 오늘 운세 요청'}</button>}</>}{message&&<p className="inline-message">{message}</p>}<small className="permission-note">가볍게 즐기는 오락용 콘텐츠이며, 실제 미래를 예측하거나 보장하지 않아요.</small></section></div>
}

function MealsPage({role}) {
  const staff=isStaff(role)
  const [date,setDate]=useState(todayISO()),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[fetchingNeis,setFetchingNeis]=useState(false)
  const {data,busy:loading,setData}=useLoad(`meals-${date}`,()=>supabase.from('meals').select('*').eq('meal_date',date).maybeSingle().then(r=>({data:r.data?[r.data]:[],error:r.error})),[date])
  async function requestNeis(payload){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');const res=await fetch('/api/neis-meals',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(payload)});const body=await res.text();let result;try{result=JSON.parse(body)}catch{throw new Error('나이스 API가 JSON 대신 코드/HTML을 반환했어요. 서버를 재시작해 npm run dev로 실행해 주세요.')}if(!res.ok)throw new Error(result.error||'나이스 급식을 불러오지 못했어요.');return result}
  async function fetchNeisMeal(){if(date<todayISO()){setMessage('지난 날짜의 급식은 다시 저장하지 않아요.');return}setFetchingNeis(true);setMessage('나이스에서 급식을 가져오고 있어요.');try{const result=await requestNeis({date});if(!result.meal){setData([]);setMessage(`${date}에는 나이스에 등록된 급식이 없습니다. 지난 날짜 급식 ${result.deletedPastCount||0}건을 정리했어요.`);return}setData([result.meal]);setMessage(`나이스 급식을 가져와 저장했어요. 지난 날짜 급식 ${result.deletedPastCount||0}건을 정리했습니다.`)}catch(error){setMessage(`나이스 연동 실패: ${error.message==='Failed to fetch'?'개발 API 서버에 연결하지 못했습니다. 터미널에서 npm run dev를 실행 중인지 확인해 주세요.':error.message}`)}finally{setFetchingNeis(false)}}
  async function fetchNeisMonth(){setFetchingNeis(true);setMessage('선택한 달의 나이스 급식을 가져오고 있어요.');try{const result=await requestNeis({month:date.slice(0,7)});const meals=result.meals||[];setData(meals.filter(meal=>meal.meal_date===date));if(!meals.length){setMessage(`선택한 달에는 오늘 이후 등록된 급식이 없어요. 지난 날짜 급식 ${result.deletedPastCount||0}건을 정리했습니다.`);return}setMessage(`${meals.length}일분 급식을 저장했어요. 지난 날짜 급식 ${result.deletedPastCount||0}건을 정리했습니다.`)}catch(error){setMessage(`나이스 연동 실패: ${error.message==='Failed to fetch'?'개발 API 서버에 연결하지 못했습니다. 터미널에서 npm run dev를 실행 중인지 확인해 주세요.':error.message}`)}finally{setFetchingNeis(false)}}
  async function saveManual(e){e.preventDefault();setBusy(true);setMessage('')
    try{const {error}=await supabase.from('meals').upsert({meal_date:date,title,description,image_paths:[],updated_at:new Date().toISOString()},{onConflict:'meal_date'});if(error)throw error;setTitle('');setDescription('');setMessage('급식이 저장됐어요.')
    }catch(err){setMessage(err.message)}finally{setBusy(false)}
  }
  async function remove(){
    const row = data[0]
    if (!row) {
      setMessage('삭제할 급식 정보가 없어요.')
      return
    }
    if (!confirm(`${date} 급식 정보를 삭제할까요?`)) return

    setBusy(true)
    setMessage('급식 정보를 삭제하고 있어요.')
    try {
      const { data: deletedRows, error } = await supabase
        .from('meals')
        .delete()
        .eq('meal_date', date)
        .select('meal_date')

      if (error) throw error
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('삭제된 급식 데이터가 없어요. Supabase의 meals 테이블 DELETE 정책(RLS)을 확인해 주세요.')
      }

      let imageMessage = ''
      if (row.image_paths?.length) {
        const { error: imageError } = await supabase.storage
          .from('meal-images')
          .remove(row.image_paths)
        if (imageError) imageMessage = ' 사진 파일은 일부 남아 있을 수 있어요.'
      }

      setData([])
      setMessage(`급식 정보가 삭제됐어요.${imageMessage}`)
    } catch (error) {
      setMessage(`삭제 실패: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }
  const imageUrl=p=>supabase.storage.from('meal-images').getPublicUrl(p).data.publicUrl
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">MEAL PLAN</span><h2>오늘의 식단을 확인해요.</h2><p>나이스에서 한백고등학교 급식을 가져오거나 직접 입력해 저장할 수 있어요.</p></div><section className="panel"><div className="date-control"><label>날짜 선택<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{staff&&<span className="permission-note">선생님·관리자 편집 가능</span>}</div>{loading?<div className="skeleton"/>:data[0]?<div className="meal-content large-meal">{data[0].title&&<h3>{data[0].title}</h3>}<div className="meal-images">{(data[0].image_paths||[]).map((p,i)=><img key={`${p}-${i}`} src={imageUrl(p)} alt={`급식 이미지 ${i+1}`}/>)}</div>{cleanMealDescription(data[0].description)&&<p>{cleanMealDescription(data[0].description)}</p>}</div>:<Empty>선택한 날짜의 급식이 아직 등록되지 않았어요.</Empty>}{staff&&<><hr/><SectionTitle title="나이스 급식 가져오기" desc="한백고등학교 나이스에서 선택 날짜 또는 해당 월의 급식을 가져와 저장해요."/><div className="button-row"><button type="button" className="button" disabled={fetchingNeis||busy} onClick={fetchNeisMeal}>{fetchingNeis?'불러오는 중...':'선택한 날짜 가져오기'}</button><button type="button" className="button" disabled={fetchingNeis||busy} onClick={fetchNeisMonth}>{fetchingNeis?'불러오는 중...':'한 달 급식 가져오기'}</button></div>{message&&<p className="inline-message">{message}</p>}<hr/><SectionTitle title="직접 급식 입력" desc="나이스에 식단이 없거나 수정이 필요하면 직접 입력할 수 있어요."/><form className="editor-form" onSubmit={saveManual}><label>식단 제목<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 11월 7일 점심" required/></label><label>안내<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="알레르기 안내 등"/></label><button className="button" disabled={busy}>{busy?'저장 중...':'선택한 날짜에 저장'}</button>{data[0]&&<button type="button" className="danger-button" onClick={remove} disabled={busy}>현재 날짜 급식 삭제</button>}</form></>}</section></div>
}

function TimetablePage({role}) {
  const staff=isStaff(role),[day,setDay]=useState(1),[period,setPeriod]=useState('1'),[subject,setSubject]=useState(''),[room,setRoom]=useState(''),[teacher,setTeacher]=useState(''),[message,setMessage]=useState('')
  const {data,busy,setData}=useLoad(`timetable-${day}`,()=>supabase.from('timetable_entries').select('*').eq('weekday',day).order('period'),[day])
  async function add(e){e.preventDefault();const {error}=await supabase.from('timetable_entries').upsert({weekday:day,period:Number(period),subject,room,teacher},{onConflict:'weekday,period'});setMessage(error?`저장 실패: ${error.message}`:'시간표를 저장했어요.');if(!error){const {data:rows}=await supabase.from('timetable_entries').select('*').eq('weekday',day).order('period');setData(rows||[])}}
  async function del(id){if(!confirm('이 시간표 항목을 삭제할까요?'))return;const {data:deleted,error}=await supabase.from('timetable_entries').delete().eq('id',id).select('id');if(error){setMessage(`삭제 실패: ${error.message}`);return}if(!deleted?.length){setMessage('삭제된 항목이 없어요. Supabase SQL 편집기에서 정책 SQL을 적용했는지 확인해 주세요.');return}setData(rows=>rows.filter(row=>row.id!==id));setMessage('시간표 항목을 삭제했어요.')}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">CLASS TIMETABLE</span><h2>우리 반 시간표</h2><p>외부 사이트 연동 없이 직접 입력한 시간표를 저장해요.</p></div><section className="panel"><div className="weekday-tabs">{timetableWeekdays.map((d,i)=><button key={d} className={day===i+1?'selected':''} onClick={()=>setDay(i+1)}>{d}</button>)}</div>{busy?<div className="skeleton"/>:data.length?<div className="timetable-list">{data.map(r=><div className="timetable-row" key={r.id}><div className="period-badge">{r.period}<small>교시</small></div><div className="timetable-subject"><b>{r.subject}</b><small>{r.teacher||'담당 교사 미입력'}</small></div><span className="room-label">{r.room||'교실 미정'}</span>{staff&&<button className="icon-button" onClick={()=>del(r.id)} title="삭제"><Trash2 size={16}/></button>}</div>)}</div>:<Empty>이 요일의 시간표가 아직 등록되지 않았어요.</Empty>}{staff&&<><hr/><SectionTitle title="시간표 입력" desc="같은 요일·교시를 다시 저장하면 기존 수업을 수정해요."/><form className="editor-grid" onSubmit={add}><label>교시<input type="number" min="1" max="12" value={period} onChange={e=>setPeriod(e.target.value)} required/></label><label>과목<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예: 국어" required/></label><label>교실<input value={room} onChange={e=>setRoom(e.target.value)} placeholder="예: 2-3"/></label><label>담당 교사<input value={teacher} onChange={e=>setTeacher(e.target.value)} placeholder="선택 입력"/></label><button className="button">시간표 저장</button></form>{message&&<p className="inline-message">{message}</p>}</>}</section></div>
}

function CalendarPage({role}) {
  const staff=isStaff(role),[month,setMonth]=useState(()=>new Date()),[date,setDate]=useState(todayISO()),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[dday,setDday]=useState(false),[message,setMessage]=useState('')
  const year=month.getFullYear(),mon=month.getMonth(),first=new Date(year,mon,1).getDay(),days=new Date(year,mon+1,0).getDate()
  const {data,busy}=useLoad(`events-${year}-${mon}`,()=>supabase.from('events').select('*').gte('event_date',`${year}-${String(mon+1).padStart(2,'0')}-01`).lte('event_date',`${year}-${String(mon+1).padStart(2,'0')}-${String(days).padStart(2,'0')}`).order('event_date'))
  const selected=data.filter(e=>e.event_date===date)
  async function add(e){e.preventDefault();const {error}=await supabase.from('events').insert({event_date:date,title,description,is_dday:dday});setMessage(error?.message||'일정을 등록했어요.');if(!error){setTitle('');setDescription('');setDday(false);location.reload()}}
  async function del(id){if(!confirm('이 일정을 삭제할까요?'))return;const {error}=await supabase.from('events').delete().eq('id',id);setMessage(error?.message||'삭제했어요.');if(!error)location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">CLASS CALENDAR</span><h2>우리 반의 일정을 기록해요.</h2><p>일정 중 중요한 날은 D-DAY로 표시할 수 있어요.</p></div><div className="calendar-layout"><section className="panel calendar-panel"><div className="calendar-head"><button className="icon-button" onClick={()=>setMonth(new Date(year,mon-1,1))}><ChevronLeft/></button><h3>{year}년 {mon+1}월</h3><button className="icon-button" onClick={()=>setMonth(new Date(year,mon+1,1))}><ChevronRight/></button></div><div className="calendar-grid">{weekdays.map(d=><div className="weekday-label" key={d}>{d}</div>)}{Array.from({length:first},(_,i)=><div key={`blank-${i}`} className="calendar-cell blank"/>)}{Array.from({length:days},(_,i)=>{const n=i+1,ds=`${year}-${String(mon+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`,ev=data.filter(e=>e.event_date===ds);return <button key={ds} className={`calendar-cell ${date===ds?'chosen':''} ${ds===todayISO()?'today':''}`} onClick={()=>setDate(ds)}><span>{n}</span>{ev.slice(0,2).map(e=><i key={e.id} className={e.is_dday?'event-dot important-dot':'event-dot'} title={e.title}/>)}</button>})}</div><div className="calendar-legend"><span><i className="event-dot"/> 일반 일정</span><span><i className="event-dot important-dot"/> D-DAY 일정</span></div></section><section className="panel selected-events"><span className="eyebrow">SELECTED DATE</span><h3>{dateLabel(date)}</h3>{busy?<div className="skeleton"/>:selected.length?selected.map(e=><div className="event-card" key={e.id}><div><b>{e.title}</b>{e.is_dday&&<span className="tag">D-DAY</span>}<p>{e.description}</p></div>{staff&&<button className="icon-button" onClick={()=>del(e.id)}><Trash2 size={16}/></button>}</div>):<Empty>이 날짜에 등록된 일정이 없어요.</Empty>}{staff&&<><hr/><SectionTitle title="일정 추가"/><form className="editor-form" onSubmit={add}><label>일정 이름<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 체육대회" required/></label><label>설명<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="일정에 대한 설명"/></label><label className="check-line"><input type="checkbox" checked={dday} onChange={e=>setDday(e.target.checked)}/> 이 일정을 D-DAY로 표시</label><button className="button">일정 등록</button>{message&&<p className="inline-message">{message}</p>}</form></>}</section></div></div>
}

function BoardPage({role,userId}) {
  const staff=isStaff(role),[title,setTitle]=useState(''),[body,setBody]=useState(''),[important,setImportant]=useState(false),[message,setMessage]=useState('')
  const {data,busy}=useLoad('board',()=>supabase.from('posts').select('*').order('is_important',{ascending:false}).order('created_at',{ascending:false}))
  async function add(e){e.preventDefault();if(!staff){setMessage('게시물 등록은 선생님 또는 관리자만 할 수 있어요.');return}const {error}=await supabase.from('posts').insert({title,body,is_important:important,author_id:userId});setMessage(error?.message||'게시물을 등록했어요.');if(!error)location.reload()}
  async function del(id){if(!staff){setMessage('게시물 삭제 권한이 없어요.');return}if(!confirm('게시물을 삭제할까요?'))return;const {data:deleted,error}=await supabase.from('posts').delete().eq('id',id).select('id');if(error){setMessage(`삭제 실패: ${error.message}`);return}if(!deleted?.length){setMessage('삭제된 게시물이 없어요. Supabase SQL 권한 정책을 확인해 주세요.');return}setMessage('게시물을 삭제했어요.');location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">CLASS COMMUNITY</span><h2>우리 반 소식을 확인해요.</h2><p>게시물 등록은 선생님과 관리자만 할 수 있어요.</p></div><section className="panel"><SectionTitle title="게시판" desc="중요 공지는 상단에 고정돼요."/><div className="post-list">{busy?<div className="skeleton"/>:data.length?data.map(p=><article className={`post-card ${p.is_important?'pinned':''}`} key={p.id}><div className="post-meta">{p.is_important&&<span className="tag"><Pin size={12}/> 중요 공지</span>}<span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span></div><h3>{p.title}</h3><p>{p.body}</p>{staff&&<button className="text-button danger-text" onClick={()=>del(p.id)}>게시물 삭제</button>}</article>):<Empty>아직 게시물이 없어요.</Empty>}</div>{staff&&<><hr/><SectionTitle title="새 게시물 작성"/><form className="editor-form" onSubmit={add}><label>제목<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="제목을 입력하세요" required/></label><label>내용<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} placeholder="내용을 입력하세요" required/></label><label className="check-line"><input type="checkbox" checked={important} onChange={e=>setImportant(e.target.checked)}/> 중요 공지로 등록 (상단 고정)</label><button className="button">게시물 등록</button>{message&&<p className="inline-message">{message}</p>}</form></>}{!staff&&<p className="permission-note">게시물은 열람만 가능합니다.</p>}</section></div>
}

function UsersPage({currentUser,role}) {
  const [data,setData]=useState([]),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[working,setWorking]=useState('')
  async function load(){setBusy(true);try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');const res=await fetch('/api/list-users',{headers:{Authorization:`Bearer ${session.access_token}`}});const body=await res.text();let json;try{json=JSON.parse(body)}catch{throw new Error('계정 목록 API가 JSON 대신 자바스크립트 파일을 반환했어요. 서버를 재시작해 npm run dev로 실행해 주세요.')}if(!res.ok)throw new Error(json.error||'계정 목록을 불러오지 못했어요.');setData(json.users||[])}catch(e){setMessage(e.message==='Failed to fetch'?'계정 API에 연결하지 못했습니다. npm run dev 서버가 실행 중인지 확인해 주세요.':e.message)}finally{setBusy(false)}}
  useEffect(()=>{load()},[])
  async function changeRole(id,newRole){if(role!=='admin')return;if(id===currentUser&&newRole!=='admin'){setMessage('현재 로그인한 관리자 본인의 권한은 변경할 수 없어요.');return}setWorking(id);try{const {error}=await supabase.rpc('admin_set_user_role',{target_user_id:id,new_role:newRole});if(error)throw error;setMessage('권한을 변경했어요.');await load()}catch(e){setMessage(e.message)}finally{setWorking('')}}
  async function editUserName(user){const next=prompt('새 이름을 입력하세요.',user.display_name||'');if(next===null||!next.trim())return;setWorking(user.id);try{const {error}=await supabase.from('profiles').update({display_name:next.trim()}).eq('id',user.id);if(error)throw error;setMessage('이름을 변경했어요.');await load()}catch(e){setMessage(`이름 변경 실패: ${e.message}`)}finally{setWorking('')}}
  async function editUserPhoto(user,file){if(!file)return;setWorking(user.id);try{if(!file.type.startsWith('image/')||file.size>5*1024*1024)throw new Error('5MB 이하 이미지 파일을 선택해 주세요.');const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:upError}=await supabase.storage.from('profile-avatars').upload(path,file);if(upError)throw upError;const {error}=await supabase.from('profiles').update({avatar_path:path}).eq('id',user.id);if(error)throw error;setMessage('프로필 사진을 변경했어요.');await load()}catch(e){setMessage(`사진 변경 실패: ${e.message}`)}finally{setWorking('')}}
  async function removeUser(user){if(user.id===currentUser||user.role==='admin'){setMessage('본인 또는 관리자 계정은 삭제할 수 없어요.');return}if(role==='teacher'&&user.role!=='student'){setMessage('선생님은 학생 계정만 삭제할 수 있어요.');return}if(!confirm(`${user.display_name||user.email} 계정을 삭제할까요? 이 계정이 작성한 게시물도 함께 삭제됩니다.`))return
    setWorking(user.id);try{const {data:{session}}=await supabase.auth.getSession();const res=await fetch('/api/delete-user',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({userId:user.id})});const json=await res.json();if(!res.ok)throw new Error(json.error||'계정 삭제에 실패했어요.');setMessage('계정과 해당 계정의 게시물을 삭제했어요.');await load()}catch(e){setMessage(e.message)}finally{setWorking('')}}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">ACCOUNT MANAGEMENT</span><h2>우리 반 계정 관리</h2><p>{role==='admin'?'학생과 선생님 계정을 관리할 수 있어요.':'학생 계정만 관리할 수 있어요.'}</p></div><section className="panel"><SectionTitle title="가입한 계정" desc="계정 삭제는 복구할 수 없으며 작성한 게시물도 함께 삭제됩니다."/><div className="user-list">{busy?<div className="skeleton"/>:data.length?data.map(u=><div className="user-row" key={u.id}><Avatar profile={u} fallback={u.email}/><div className="user-info"><b>{u.display_name||'이름 미설정'} <small className="inline-role">{roleLabel[u.role]}</small></b><small>{u.email}</small></div><button className="text-button" disabled={working===u.id} onClick={()=>editUserName(u)}>이름 변경</button><label className="text-button photo-change">사진<input type="file" accept="image/png,image/jpeg,image/webp" disabled={working===u.id} onChange={e=>{editUserPhoto(u,e.target.files?.[0]);e.target.value=''}}/></label>{role==='admin'&&u.id!==currentUser&&u.role!=='admin'&&<select value={u.role} disabled={working===u.id} onChange={e=>changeRole(u.id,e.target.value)}><option value="student">학생</option><option value="teacher">선생님</option></select>}{u.id!==currentUser&&u.role!=='admin'&&(role==='admin'||u.role==='student')&&<button className="danger-button" disabled={working===u.id} onClick={()=>removeUser(u)}>{working===u.id?'처리 중':'계정 삭제'}</button>}</div>):<Empty>관리할 계정이 없어요.</Empty>}</div>{message&&<p className="inline-message">{message}</p>}<button className="text-button" onClick={load}>목록 새로고침</button></section></div>
}

