import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Utensils, Clock3, MessageSquare, Shield, LogOut,
  Plus, ChevronLeft, ChevronRight, Pin, ImagePlus, Trash2, Menu,
  X, Sparkles, Users, BookOpen, RefreshCw
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './supabase'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const roleLabel = { admin: '관리자', teacher: '선생님', student: '학생' }
const todayISO = () => new Date().toLocaleDateString('sv-SE')
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
const isStaff = (role) => role === 'admin' || role === 'teacher'

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
    ['calendar', '일정', CalendarDays], ['board', '자유게시판', MessageSquare],
    ...(profile.role === 'admin' ? [['users', '계정 권한', Users]] : [])
  ]

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">C</div><div><b>우리반 허브</b><small>CLASSROOM HUB</small></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="class-chip"><span className="status-dot"/> 우리 반 공간</div>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => {setPage(id);setMenuOpen(false)}}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">{(profile.display_name || session.user.email || '?').slice(0,1).toUpperCase()}</div><div className="profile-text"><b>{profile.display_name || session.user.email}</b><small>{roleLabel[profile.role] || '학생'}</small></div></div><button className="nav-item" onClick={signOut}><LogOut size={18}/> 로그아웃</button></div>
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
        {page === 'users' && profile.role === 'admin' && <UsersPage currentUser={session.user.id}/>}
      </div>
      <footer className="footer">우리 반의 하루를 더 편리하게 <span>·</span> Classroom Hub</footer>
    </main>
  </div>
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
    e.preventDefault(); setBusy(true); setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup') setMessage('가입 요청이 완료됐어요. 이메일 인증이 켜져 있다면 메일을 확인한 뒤 로그인해 주세요.')
  }
  return <div className="auth-layout"><div className="auth-art"><div className="brand-mark large">C</div><span className="eyebrow">A CALMER CLASSROOM</span><h1>우리 반의 하루를<br/>한곳에서 관리해요.</h1><p>급식부터 시간표, 일정과 소식까지<br/>교실 생활에 필요한 정보를 한눈에.</p><div className="art-orbit">✳</div></div><div className="auth-panel"><div className="auth-card"><span className="eyebrow">WELCOME</span><h2>{mode === 'login' ? '다시 만나서 반가워요' : '새 계정 만들기'}</h2><p>우리 반 허브에 로그인해 주세요.</p><form onSubmit={submit}>{mode === 'signup' && <label>이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="이름" required/></label>}<label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호" minLength="6" required/></label><button className="button full" disabled={busy}>{busy ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}</button></form>{message && <div className="inline-message">{message}</div>}<button className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'처음 방문했나요? 회원가입':'이미 계정이 있나요? 로그인'}</button><small className="auth-note">학생은 회원가입 후 기본적으로 학생 권한이 부여됩니다.</small></div></div></div>
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
  const timetable=useLoad('home-time',()=>supabase.from('timetable_entries').select('*').eq('weekday',dayIndex).order('period'))
  const events=useLoad('home-events',()=>supabase.from('events').select('*').gte('event_date',today).order('event_date').limit(5))
  const posts=useLoad('home-posts',()=>supabase.from('posts').select('*').eq('is_important',true).order('created_at',{ascending:false}).limit(3))
  const nextDday=events.data.find(e=>e.is_dday)
  const daysLeft=nextDday?Math.ceil((new Date(`${nextDday.event_date}T00:00:00`)-new Date(`${today}T00:00:00`))/86400000):null
  return <div className="stack-lg">
    <div className="welcome-row"><div><span className="eyebrow">{dateLabel(today)}</span><h2>오늘도 좋은 하루 보내요 <span>✳</span></h2><p>우리 반의 오늘을 확인해 보세요.</p></div><div className="weather-art">☼</div></div>
    <div className="dashboard-grid">
      <section className="panel meal-panel"><SectionTitle title="오늘의 급식" desc="오늘 식단을 확인해요" action={<button className="subtle-link" onClick={()=>go('meals')}>전체 보기 ↗</button>}/>{meals.busy?<div className="skeleton"/>:meals.data[0]?<div className="meal-content">{meals.data[0].title&&<b>{meals.data[0].title}</b>}<div className="meal-images">{(meals.data[0].image_paths||[]).map((p,i)=><img key={p} src={supabase.storage.from('meal-images').getPublicUrl(p).data.publicUrl} alt={`오늘 급식 ${i+1}`}/>)}</div>{meals.data[0].description&&<p>{meals.data[0].description}</p>}</div>:<Empty>오늘 등록된 급식이 없어요.</Empty>}</section>
      <section className="panel dday-panel"><SectionTitle title="다가오는 중요한 날" desc="우리 반의 주요 일정"/>{nextDday?<><div className="dday-number">{daysLeft===0?'D-DAY':daysLeft>0?`D-${daysLeft}`:`D+${Math.abs(daysLeft)}`}</div><h3>{nextDday.title}</h3><p>{dateLabel(nextDday.event_date)}</p><button className="subtle-link" onClick={()=>go('calendar')}>일정 확인하기 ↗</button></>:<Empty>등록된 D-DAY 일정이 없어요.</Empty>}</section>
      <section className="panel"><SectionTitle title="오늘의 시간표" desc={`${weekdays[dayIndex]}요일 수업`} action={<button className="subtle-link" onClick={()=>go('timetable')}>시간표 보기 ↗</button>}/>{timetable.busy?<div className="skeleton"/>:timetable.data.length?<div className="mini-timetable">{timetable.data.map(row=><div className="mini-period" key={row.id}><span>{row.period}교시</span><b>{row.subject}</b><small>{row.room||''}</small></div>)}</div>:<Empty>오늘 시간표가 등록되지 않았어요.</Empty>}</section>
      <section className="panel"><SectionTitle title="중요한 공지" desc="놓치지 말아야 할 소식" action={<button className="subtle-link" onClick={()=>go('board')}>게시판 ↗</button>}/>{posts.data.length?<div className="notice-list">{posts.data.map(p=><div key={p.id}><Pin size={14}/><span>{p.title}</span></div>)}</div>:<Empty>중요 공지가 없어요.</Empty>}</section>
    </div>
    <section className="panel event-strip"><SectionTitle title="다가오는 일정" desc="예정된 우리 반 이벤트"/><div className="upcoming-list">{events.data.length?events.data.map(e=><div className="upcoming-item" key={e.id}><div className="date-tile"><b>{new Date(`${e.event_date}T00:00:00`).getDate()}</b><small>{weekdays[new Date(`${e.event_date}T00:00:00`).getDay()]}요일</small></div><div><b>{e.title}</b><p>{e.description||'등록된 설명이 없습니다.'}</p></div>{e.is_dday&&<span className="tag">D-DAY</span>}</div>):<Empty>예정된 일정이 없어요.</Empty>}</div></section>
  </div>
}

function MealsPage({role}) {
  const staff=isStaff(role)
  const [date,setDate]=useState(todayISO()),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const {data,busy:loading}=useLoad(`meals-${date}`,()=>supabase.from('meals').select('*').eq('meal_date',date).maybeSingle().then(r=>({data:r.data?[r.data]:[],error:r.error})),[date])
  async function save(e){e.preventDefault();if(files.length>3){setMessage('이미지는 최대 3개까지 올릴 수 있어요.');return}setBusy(true);setMessage('');try{const paths=[];for(const file of files){const path=`${date}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await supabase.storage.from('meal-images').upload(path,file,{upsert:false});if(error)throw error;paths.push(path)}const {error}=await supabase.from('meals').upsert({meal_date:date,title,description,image_paths:paths,updated_at:new Date().toISOString()},{onConflict:'meal_date'});if(error)throw error;setFiles([]);setMessage('급식이 저장됐어요.');location.reload()}catch(err){setMessage(err.message)}finally{setBusy(false)}}
  async function remove(){if(!confirm('이 날짜의 급식 정보를 삭제할까요?'))return;const row=data[0];if(row?.image_paths?.length)await supabase.storage.from('meal-images').remove(row.image_paths);const {error}=await supabase.from('meals').delete().eq('meal_date',date);setMessage(error?error.message:'삭제했어요.');location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">MEAL PLAN</span><h2>오늘의 식단을 확인해요.</h2><p>날짜별 급식 이미지와 안내를 모아볼 수 있어요.</p></div><section className="panel"><div className="date-control"><label>날짜 선택<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{staff&&<span className="permission-note">선생님·관리자 편집 가능</span>}</div>{loading?<div className="skeleton"/>:data[0]?<div className="meal-content large-meal">{data[0].title&&<h3>{data[0].title}</h3>}<div className="meal-images">{(data[0].image_paths||[]).map((p,i)=><img key={p} src={supabase.storage.from('meal-images').getPublicUrl(p).data.publicUrl} alt={`급식 이미지 ${i+1}`}/>)}</div>{data[0].description&&<p>{data[0].description}</p>}</div>:<Empty>선택한 날짜의 급식이 아직 등록되지 않았어요.</Empty>}{staff&&<><hr/><SectionTitle title="급식 등록 및 수정" desc="이미지는 한 날짜에 최대 3개까지 등록할 수 있어요."/><form className="editor-form" onSubmit={save}><label>식단 제목<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 11월 7일 점심"/></label><label>안내<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="알레르기 안내 등"/></label><label className="upload-box"><ImagePlus/> 이미지 선택 (최대 3개)<input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,3))}/><small>{files.length}개 선택됨</small></label><div className="button-row"><button className="button" disabled={busy}>{busy?'저장 중...':'급식 저장'}</button>{data[0]&&<button type="button" className="danger-button" onClick={remove}>삭제</button>}</div>{message&&<p className="inline-message">{message}</p>}</form></>}</section></div>
}

function TimetablePage({role}) {
  const staff=isStaff(role),[day,setDay]=useState(1),[period,setPeriod]=useState('1'),[subject,setSubject]=useState(''),[room,setRoom]=useState(''),[teacher,setTeacher]=useState(''),[message,setMessage]=useState('')
  const {data,busy}=useLoad(`timetable-${day}`,()=>supabase.from('timetable_entries').select('*').eq('weekday',day).order('period'),[day])
  async function add(e){e.preventDefault();const {error}=await supabase.from('timetable_entries').upsert({weekday:day,period:Number(period),subject,room,teacher},{onConflict:'weekday,period'});setMessage(error?.message||'시간표를 저장했어요.');if(!error)location.reload()}
  async function del(id){const {error}=await supabase.from('timetable_entries').delete().eq('id',id);setMessage(error?.message||'삭제했어요.');if(!error)location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">CLASS TIMETABLE</span><h2>우리 반 시간표</h2><p>외부 사이트 연동 없이 직접 입력한 시간표를 저장해요.</p></div><section className="panel"><div className="weekday-tabs">{weekdays.slice(1).map((d,i)=><button key={d} className={day===i+1?'selected':''} onClick={()=>setDay(i+1)}>{d}</button>)}</div>{busy?<div className="skeleton"/>:data.length?<div className="timetable-list">{data.map(r=><div className="timetable-row" key={r.id}><div className="period-badge">{r.period}<small>교시</small></div><div className="timetable-subject"><b>{r.subject}</b><small>{r.teacher||'담당 교사 미입력'}</small></div><span className="room-label">{r.room||'교실 미정'}</span>{staff&&<button className="icon-button" onClick={()=>del(r.id)} title="삭제"><Trash2 size={16}/></button>}</div>)}</div>:<Empty>이 요일의 시간표가 아직 등록되지 않았어요.</Empty>}{staff&&<><hr/><SectionTitle title="시간표 입력" desc="같은 요일·교시를 다시 저장하면 기존 수업을 수정해요."/><form className="editor-grid" onSubmit={add}><label>교시<input type="number" min="1" max="12" value={period} onChange={e=>setPeriod(e.target.value)} required/></label><label>과목<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예: 국어" required/></label><label>교실<input value={room} onChange={e=>setRoom(e.target.value)} placeholder="예: 2-3"/></label><label>담당 교사<input value={teacher} onChange={e=>setTeacher(e.target.value)} placeholder="선택 입력"/></label><button className="button">시간표 저장</button></form>{message&&<p className="inline-message">{message}</p>}</>}</section></div>
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
  async function add(e){e.preventDefault();if(important&&!staff){setMessage('중요 공지는 선생님 또는 관리자만 등록할 수 있어요.');return}const {error}=await supabase.from('posts').insert({title,body,is_important:important,author_id:userId});setMessage(error?.message||'게시물을 등록했어요.');if(!error)location.reload()}
  async function del(id){if(!confirm('게시물을 삭제할까요?'))return;const {error}=await supabase.from('posts').delete().eq('id',id);setMessage(error?.message||'삭제했어요.');if(!error)location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">CLASS COMMUNITY</span><h2>자유롭게 소식을 나눠요.</h2><p>학생도 자유롭게 게시물을 작성할 수 있어요.</p></div><section className="panel"><SectionTitle title="게시판" desc="중요 공지는 상단에 고정돼요."/><div className="post-list">{busy?<div className="skeleton"/>:data.length?data.map(p=><article className={`post-card ${p.is_important?'pinned':''}`} key={p.id}><div className="post-meta">{p.is_important&&<span className="tag"><Pin size={12}/> 중요 공지</span>}<span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span></div><h3>{p.title}</h3><p>{p.body}</p>{(staff||p.author_id===userId)&&<button className="text-button danger-text" onClick={()=>del(p.id)}>게시물 삭제</button>}</article>):<Empty>첫 게시물을 작성해 보세요.</Empty>}</div><hr/><SectionTitle title="새 게시물 작성"/><form className="editor-form" onSubmit={add}><label>제목<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="제목을 입력하세요" required/></label><label>내용<textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} placeholder="내용을 입력하세요" required/></label>{staff&&<label className="check-line"><input type="checkbox" checked={important} onChange={e=>setImportant(e.target.checked)}/> 중요 공지로 등록 (상단 고정)</label>}<button className="button">게시물 등록</button>{message&&<p className="inline-message">{message}</p>}</form></section></div>
}

function UsersPage({currentUser}) {
  const {data,busy}=useLoad('profiles',()=>supabase.from('profiles').select('*').order('created_at',{ascending:true}))
  const [message,setMessage]=useState('')
  async function changeRole(id,role){if(id===currentUser&&role!=='admin'){setMessage('현재 로그인한 관리자 본인의 권한은 여기서 변경할 수 없어요.');return}const {error}=await supabase.rpc('admin_set_user_role',{target_user_id:id,new_role:role});setMessage(error?.message||'권한을 변경했어요.');if(!error)location.reload()}
  return <div className="stack-lg"><div className="page-intro"><span className="eyebrow">ACCOUNT MANAGEMENT</span><h2>우리 반 계정 권한</h2><p>관리자만 선생님·관리자 권한을 부여할 수 있어요.</p></div><section className="panel"><SectionTitle title="가입한 계정" desc="학생으로 가입한 계정을 선생님 또는 관리자로 변경할 수 있어요."/><div className="user-list">{busy?<div className="skeleton"/>:data.map(u=><div className="user-row" key={u.id}><div className="avatar">{(u.display_name||u.email||'?').slice(0,1).toUpperCase()}</div><div className="user-info"><b>{u.display_name||'이름 미설정'}</b><small>{u.email}</small></div><select value={u.role} disabled={u.id===currentUser} onChange={e=>changeRole(u.id,e.target.value)}><option value="student">학생</option><option value="teacher">선생님</option><option value="admin">관리자</option></select></div>)}</div>{message&&<p className="inline-message">{message}</p>}</section></div>
}