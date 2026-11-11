import { useEffect, useRef, useState } from 'react'
import {
  Inbox, MessageSquarePlus, Heart, ImagePlus, X, RefreshCw,
  Send, Sparkles, MessageCircle, HelpCircle, ThumbsUp, Eye,
  Check, ChevronRight
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './supabase'

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: '건의사항', label: '💡 건의사항', color: '#7a8e7e' },
  { id: '칭찬·응원', label: '💖 칭찬·응원', color: '#c78377' },
  { id: '질문', label: '❓ 질문', color: '#7a879e' },
  { id: '자유의견', label: '📢 자유의견', color: '#b09467' }
]

export default function App() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [writeOpen, setWriteOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [likedIds, setLikedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('suggestion_likes') || '[]')
    } catch {
      return []
    }
  })

  // 라이트박스(이미지 확대)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // 글 작성 상태
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('건의사항')
  const [nickname, setNickname] = useState('익명의 학우')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadSuggestions()
    }
  }, [])

  async function loadSuggestions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSuggestions(data || [])
    } catch (err) {
      setMessage(`목록을 불러오지 못했습니다: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const valid = files.filter(f => f.type.startsWith('image/'))
    if (valid.length < files.length) {
      alert('이미지 파일(JPG, PNG, WebP 등)만 첨부할 수 있습니다.')
    }
    setSelectedFiles(prev => [...prev, ...valid].slice(0, 8))
    e.target.value = ''
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setSubmitting(true)
    setMessage('')
    try {
      let uploadedPaths = []
      // 사진 업로드
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const ext = file.name?.split('.').pop() || (file.type ? file.type.split('/')[1]?.replace('jpeg', 'jpg') : 'jpg') || 'jpg'
          const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
          const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`
          const { error: upErr } = await supabase.storage.from('suggestion-images').upload(fileName, file, {
            upsert: false,
            contentType: file.type || 'image/jpeg'
          })
          if (upErr) throw upErr
          uploadedPaths.push(fileName)
        }
      }

      // 글 등록 (누구나 동일하게 익명 등록)
      const { data, error } = await supabase.from('suggestions').insert({
        title: title.trim(),
        content: content.trim(),
        category,
        nickname: nickname.trim() || '익명의 학우',
        image_paths: uploadedPaths,
        likes_count: 0
      }).select('*')

      if (error) throw error

      setTitle('')
      setContent('')
      setNickname('익명의 학우')
      setSelectedFiles([])
      setWriteOpen(false)
      if (data?.[0]) {
        setSuggestions(prev => [data[0], ...prev])
      }
    } catch (err) {
      setMessage(`등록 실패: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleLike(id, currentLikes) {
    const hasLiked = likedIds.includes(id)
    const nextCount = hasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
    const nextLiked = hasLiked ? likedIds.filter(x => x !== id) : [...likedIds, id]

    setLikedIds(nextLiked)
    localStorage.setItem('suggestion_likes', JSON.stringify(nextLiked))

    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, likes_count: nextCount } : s))

    try {
      await supabase.from('suggestions').update({ likes_count: nextCount }).eq('id', id)
    } catch {
      // 실패 시 롤백
    }
  }

  const filtered = filter === 'all'
    ? suggestions
    : suggestions.filter(s => s.category === filter)

  const getImageUrl = (p) => supabase.storage.from('suggestion-images').getPublicUrl(p).data.publicUrl

  if (!isSupabaseConfigured) {
    return <SetupGuideScreen />
  }

  return (
    <div className="sug-shell">
      {/* 상단 네비게이션 헤더 */}
      <header className="sug-header">
        <div className="sug-brand">
          <div className="sug-brand-icon">
            <Inbox size={22} />
          </div>
          <div>
            <span className="sug-eyebrow">ANONYMOUS CLASSROOM BOX</span>
            <h1>우리 반 익명 건의함</h1>
          </div>
        </div>

        <div className="sug-header-actions">
          <button className="icon-button" title="새로고침" onClick={loadSuggestions}>
            <RefreshCw size={17} />
          </button>
          <button className="sug-primary-btn" onClick={() => setWriteOpen(true)}>
            <MessageSquarePlus size={16} />
            <span>건의 남기기</span>
          </button>
        </div>
      </header>

      {/* 안내 배너 */}
      <div className="sug-hero">
        <div className="sug-hero-content">
          <h2>누구나 자유롭고 솔직하게 <span>✳</span></h2>
          <p>
            로그인이나 개인정보 확인 없이 완전히 익명으로 등록됩니다.<br />
            하고 싶었던 말, 개선 아이디어, 따뜻한 응원을 자유롭게 남겨보세요.
          </p>
        </div>
        <div className="sug-hero-chip">
          <span>총 {suggestions.length}개의 건의</span>
        </div>
      </div>

      {message && <div className="sug-notice">{message}<button onClick={() => setMessage('')}>닫기</button></div>}

      {/* 카테고리 필터 탭 */}
      <div className="sug-category-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`sug-tab ${filter === cat.id ? 'active' : ''}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 건의글 목록 */}
      <main className="sug-main">
        {loading ? (
          <div className="sug-skeleton-list">
            <div className="sug-skeleton" />
            <div className="sug-skeleton" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="sug-empty">
            <div className="sug-empty-icon">📫</div>
            <h3>아직 등록된 건의가 없어요.</h3>
            <p>우리 반을 위한 첫 번째 익명 의견을 남겨보세요!</p>
            <button className="sug-primary-btn" onClick={() => setWriteOpen(true)}>
              <MessageSquarePlus size={16} /> 첫 글 쓰기
            </button>
          </div>
        ) : (
          <div className="sug-cards-grid">
            {filtered.map(item => {
              const hasLiked = likedIds.includes(item.id)
              return (
                <article key={item.id} className="sug-card">
                  {/* 카드 상단 메타 정보 */}
                  <div className="sug-card-top">
                    <span className="sug-tag">{item.category || '건의사항'}</span>
                    <span className="sug-date">
                      {new Date(item.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>

                  <h3 className="sug-card-title">{item.title}</h3>
                  <p className="sug-card-body">{item.content}</p>

                  {/* 첨부 이미지 그리드 */}
                  {item.image_paths && item.image_paths.length > 0 && (
                    <div className={`sug-images-grid count-${Math.min(item.image_paths.length, 4)}`}>
                      {item.image_paths.map((p, idx) => {
                        const src = getImageUrl(p)
                        return (
                          <div
                            key={idx}
                            className="sug-image-thumb"
                            onClick={() => setLightboxUrl(src)}
                            title="사진 크게 보기"
                          >
                            <img src={src} alt="건의함 첨부 사진" loading="lazy" />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 관리자/선생님 답변 피드백 (존재할 경우 표시) */}
                  {item.admin_reply && (
                    <div className="sug-reply-box">
                      <b><Sparkles size={13} /> 선생님 / 답변</b>
                      <p>{item.admin_reply}</p>
                    </div>
                  )}

                  {/* 카드 하단 작성자 & 공감 버튼 */}
                  <div className="sug-card-bottom">
                    <div className="sug-author-pill">
                      <span className="sug-author-avatar">익명</span>
                      <span>{item.nickname || '익명의 학우'}</span>
                    </div>

                    <button
                      type="button"
                      className={`sug-like-btn ${hasLiked ? 'liked' : ''}`}
                      onClick={() => toggleLike(item.id, item.likes_count || 0)}
                      title="공감하기"
                    >
                      <Heart size={15} fill={hasLiked ? '#c78377' : 'none'} color={hasLiked ? '#c78377' : '#999'} />
                      <span>{item.likes_count || 0}</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {/* 건의 작성 모달 */}
      {writeOpen && (
        <div className="sug-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sug-modal">
            <div className="sug-modal-header">
              <div>
                <span className="sug-eyebrow">ANONYMOUS SUBMISSION</span>
                <h2>새로운 의견 남기기</h2>
              </div>
              <button className="icon-button" onClick={() => setWriteOpen(false)} aria-label="닫기">
                <X size={20} />
              </button>
            </div>

            <form className="sug-form" onSubmit={handleSubmit}>
              <div className="sug-form-row">
                <label>
                  카테고리
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="건의사항">💡 건의사항</option>
                    <option value="칭찬·응원">💖 칭찬·응원</option>
                    <option value="질문">❓ 질문</option>
                    <option value="자유의견">📢 자유의견</option>
                  </select>
                </label>
                <label>
                  작성자 닉네임 (익명)
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="예: 익명의 학우, 2반 친구"
                    maxLength={20}
                  />
                </label>
              </div>

              <label>
                제목
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="의견의 핵심을 적어주세요"
                  required
                  maxLength={100}
                />
              </label>

              <label>
                내용
                <textarea
                  rows={6}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="우리 반 친구들이나 선생님께 전달하고 싶은 내용을 솔직하고 따뜻하게 적어주세요."
                  required
                />
              </label>

              {/* 사진 첨부 (모바일/PC 지원) */}
              <div>
                <span className="sug-label-text">사진 첨부 (선택)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  className="sug-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={18} />
                  <div>
                    <b>사진 첨부하기 (모바일 카메라/갤러리 지원)</b>
                    <small>
                      {selectedFiles.length > 0 ? `${selectedFiles.length}장의 사진 선택됨` : '최대 8장까지 이미지를 첨부할 수 있어요'}
                    </small>
                  </div>
                </button>

                {/* 첨부 파일 썸네일 미리보기 */}
                {selectedFiles.length > 0 && (
                  <div className="sug-file-preview-grid">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="sug-thumb">
                        <img src={URL.createObjectURL(file)} alt="선택 사진 미리보기" />
                        <button
                          type="button"
                          className="sug-thumb-remove"
                          onClick={() => removeFile(idx)}
                          title="삭제"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sug-modal-actions">
                <button
                  type="button"
                  className="sug-cancel-btn"
                  onClick={() => setWriteOpen(false)}
                  disabled={submitting}
                >
                  취소
                </button>
                <button className="sug-primary-btn" disabled={submitting}>
                  <Send size={15} />
                  <span>{submitting ? '등록 중...' : '익명으로 등록'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 이미지 라이트박스 확대 모달 */}
      {lightboxUrl && (
        <div className="sug-lightbox" onClick={() => setLightboxUrl(null)}>
          <div className="sug-lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="sug-lightbox-close" onClick={() => setLightboxUrl(null)}>
              <X size={24} />
            </button>
            <img src={lightboxUrl} alt="사진 확대 보기" />
          </div>
        </div>
      )}

      <footer className="sug-footer">
        우리 반 익명 건의함 <span>·</span> Classroom Suggestion Box
      </footer>
    </div>
  )
}

function SetupGuideScreen() {
  return (
    <div className="sug-setup-screen">
      <div className="sug-brand-icon large">
        <Inbox size={32} />
      </div>
      <h1>우리 반 익명 건의함</h1>
      <p>새로운 건의함 Supabase 연결 설정이 필요합니다.</p>

      <div className="sug-setup-card">
        <h3>🚀 시작 전 3단계 안내</h3>
        <ol>
          <li>
            <b>새 Supabase 프로젝트 생성:</b><br />
            Supabase(supabase.com)에서 건의함용 새 프로젝트를 무료로 생성합니다.
          </li>
          <li>
            <b>초기 SQL 실행:</b><br />
            새 프로젝트 Dashboard의 <b>SQL Editor</b>에 들어가서 프로젝트 폴더의 <code>supabase-schema.sql</code> 파일 내용을 복사해 실행([Run])합니다.
          </li>
          <li>
            <b>환경변수 입력:</b><br />
            <code>.env</code> 파일에 새 프로젝트의 <code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_ANON_KEY</code>를 입력하고 서버를 다시 실행합니다.
          </li>
        </ol>
      </div>
    </div>
  )
}
