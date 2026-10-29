import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../config'
import { fetchBlobUrl } from '../api/client'
import LazyImage from './LazyImage'

/** 圆形播放/暂停按钮（isMine 决定配色） */
function VoiceBubble({ src, duration, isMine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadedDuration, setLoadedDuration] = useState(0)

  const total = loadedDuration || duration || 0

  function toggle() {
    const el = audioRef.current
    if (!el || !src) return
    if (playing) el.pause()
    else el.play()
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return undefined
    const onTime = () => setCurrentTime(el.currentTime)
    const onMeta = () => setLoadedDuration(el.duration || 0)
    const onEnd = () => { setPlaying(false); setCurrentTime(0) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [src])

  const progress = total > 0 ? Math.min(1, currentTime / total) : 0
  const bars = 5

  return (
    <div className="flex min-w-[120px] items-center gap-2.5">
      {src && <audio ref={audioRef} src={src} preload="metadata" className="hidden" />}
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? '暂停语音' : '播放语音'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          isMine
            ? 'bg-white/25 text-white hover:bg-white/35'
            : 'bg-brand-500 text-white hover:bg-brand-600'
        } disabled:opacity-50`}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      {/* 声波纹：随播放进度点亮 */}
      <div
        className={`voice-bars flex items-end gap-[3px] ${playing ? 'is-playing' : ''} ${
          isMine ? 'text-white/85' : 'text-gray-500 dark:text-gray-300'
        }`}
        aria-hidden
      >
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={`voice-bar ${progress * bars > i ? 'lit' : ''}`}
            style={{ height: `${6 + ((i * 5) % 12)}px` }}
          />
        ))}
      </div>
      <span className={`text-xs tabular-nums ${isMine ? 'text-white/85' : 'text-gray-500 dark:text-gray-400'}`}>
        {formatDuration(total)}
      </span>
    </div>
  )
}

function formatDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return '0″'
  return `${Math.max(1, Math.round(sec))}″`
}

/** 单条消息气泡，按类型区分：text / image / voice / file；群聊里他人消息显示昵称。
 *  selectMode/selectChecked/onToggleSelect：多选删除模式
 */
export default function MessageItem({ msg, isMine, showTime, showSender, selectMode, selectChecked, onToggleSelect }) {
  const isUpload = msg.content.startsWith('/api/files/download/')
  const url = isUpload && API_BASE ? `${API_BASE}${msg.content}` : msg.content
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  // 上传文件走鉴权下载接口，<img>/<audio> 无法带 Authorization 头，转为 blob: URL
  const [blobUrl, setBlobUrl] = useState(null)

  useEffect(() => {
    if (!isUpload || msg.type === 'text') return undefined
    let revoked = null
    fetchBlobUrl(msg.content).then((u) => {
      if (u) {
        revoked = u
        setBlobUrl(u)
      }
    })
    return () => revoked && URL.revokeObjectURL(revoked)
  }, [msg.content, isUpload, msg.type])

  const mediaUrl = isUpload ? blobUrl : url

  let extra = {}
  try { extra = JSON.parse(msg.extra || '{}') } catch { /* 无元信息 */ }

  let body
  switch (msg.type) {
    case 'image':
      body = (
        <a href={mediaUrl || undefined} target="_blank" rel="noreferrer" className="relative block">
          {!imgLoaded && !imgError && (
            <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-gray-200 text-xs text-gray-400 dark:bg-night-600">
              加载中…
            </div>
          )}
          {imgError && (
            <span className="block w-48 rounded-xl bg-gray-200 px-3 py-4 text-center text-xs text-gray-400 dark:bg-night-600">
              图片加载失败，点击打开
            </span>
          )}
          {/* IntersectionObserver 控制加载，不依赖原生 lazy，避免懒加载干预挂起 */}
          {mediaUrl && (
            <LazyImage
              src={mediaUrl}
              alt="图片"
              fetchStrategy={isUpload ? 'auth' : undefined}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={
                imgLoaded
                  ? 'max-h-64 w-auto rounded-xl'
                  : 'absolute inset-0 h-full w-full opacity-0'
              }
            />
          )}
        </a>
      )
      break
    case 'voice':
      body = <VoiceBubble src={mediaUrl} duration={extra.duration} isMine={isMine} />
      break
    case 'file':
      body = (
        <a
          href={mediaUrl || undefined}
          download={extra.name}
          className="flex items-center gap-3 py-1"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/10 text-lg dark:bg-white/10">
            📄
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium underline underline-offset-2">
              {extra.name || '文件'}
            </span>
            {extra.size ? (
              <span className="block text-xs opacity-60">{formatSize(extra.size)}</span>
            ) : null}
          </span>
        </a>
      )
      break
    default:
      body = <span className="whitespace-pre-wrap break-words">{msg.content}</span>
  }

  const time = toDate(msg.created_at)

  return (
    <>
      {showTime && (
        <p className="py-2 text-center text-[11px] text-gray-400">
          {time.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <div className={`flex animate-fade-up items-center px-3 py-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
        {selectMode && (
          <button
            type="button"
            onClick={onToggleSelect}
            aria-label="选择消息"
            className={`mx-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
              selectChecked
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-gray-300 text-transparent dark:border-night-600'
            }`}
          >
            ✓
          </button>
        )}
        <div
          className={`flex max-w-[80%] flex-col ${isMine ? 'items-end' : 'items-start'}`}
          onClick={selectMode ? onToggleSelect : undefined}
        >
          {showSender && msg.sender && (
            <span className="mb-0.5 px-1 text-[11px] text-gray-400">
              {msg.sender.nickname || msg.sender.username}
            </span>
          )}
          <div
            className={`rounded-2xl text-sm shadow-sm ${
              msg.type === 'image' ? 'overflow-hidden p-1' : 'px-3.5 py-2.5'
            } ${
              isMine
                ? 'rounded-br-md bg-brand-500 text-white'
                : 'rounded-bl-md bg-white text-gray-800 dark:bg-night-700 dark:text-gray-100'
            }`}
          >
            {body}
          </div>
        </div>
      </div>
    </>
  )
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function toDate(v) {
  return new Date(typeof v === 'string' && !v.endsWith('Z') ? v + 'Z' : v)
}

/** 判断相邻两条消息是否需要插入时间分隔（间隔超过 5 分钟） */
export function shouldShowTime(prev, cur) {
  if (!prev) return true
  return toDate(cur.created_at) - toDate(prev.created_at) > 5 * 60 * 1000
}
