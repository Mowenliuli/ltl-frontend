import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/** 头像：无头像时按用户名取色显示首字符；群聊显示群图标 */
export function Avatar({ user, size = 'md', isGroup }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }

  if (isGroup) {
    return (
      <div className={`${sizes[size]} flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-1/2 w-1/2">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      </div>
    )
  }

  const name = user?.nickname || user?.username || '?'
  const colors = [
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-cyan-500', 'bg-brand-500', 'bg-violet-500', 'bg-fuchsia-500',
  ]
  const color = colors[(user?.id ?? name.charCodeAt(0)) % colors.length]

  if (user?.avatar) {
    return <img src={user.avatar} alt={name} className={`${sizes[size]} shrink-0 rounded-full object-cover`} />
  }
  return (
    <div className={`${sizes[size]} ${color} flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

/** 会话显示名（私聊取对方昵称，群聊取群名） */
export function convTitle(c) {
  if (!c) return ''
  return c.kind === 'group' ? c.name : c.peer?.nickname || c.peer?.username || ''
}

/** 侧边栏：会话列表 + 搜索（用户发起私聊） */
export default function Sidebar({ me, conversations, activeConvId, onSelect, onNewConversation, onCreateGroup, onLogout, wsOnline }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const seqRef = useRef(0)

  // 300ms 防抖 + 序号防乱序（旧响应不覆盖新结果）
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return undefined }
    setSearching(true)
    const seq = ++seqRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.searchUsers(query)
        if (seq === seqRef.current) setResults(res)
      } catch { /* 忽略搜索错误 */ } finally {
        if (seq === seqRef.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function startChat(user) {
    try {
      const conv = await api.openConversation(user.id)
      setQuery('')
      setResults([])
      onNewConversation(conv)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="safe-top flex h-full w-full flex-col bg-white dark:bg-night-800 md:w-80 md:border-r md:border-gray-200 md:dark:border-night-600">
      {/* 头部：我的信息 + 连接状态 + 建群 + 登出 */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar user={me} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-night-800 ${
                wsOnline ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
              title={wsOnline ? '已连接' : '连接中…'}
            />
          </div>
          <div>
            <p className="font-semibold leading-tight text-gray-800 dark:text-gray-100">
              {me?.nickname || me?.username || '…'}
            </p>
            <p className="text-xs text-gray-400">{wsOnline ? '在线' : '连接中…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateGroup}
            title="创建群聊"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-night-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-red-500 dark:hover:bg-night-700"
          >
            退出
          </button>
        </div>
      </div>

      {/* 搜索用户 */}
      <div className="px-3 pb-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            className="w-full rounded-xl border-none bg-gray-100 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-brand-500/50 dark:bg-night-700"
            placeholder="搜索用户，发起聊天"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {results.length > 0 && (
          <ul className="mt-2 animate-fade-up divide-y divide-gray-100 rounded-xl border border-gray-100 shadow-sm dark:divide-night-600 dark:border-night-600">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-50 dark:hover:bg-night-700"
                  onClick={() => startChat(u)}
                >
                  <Avatar user={u} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.nickname || u.username}</p>
                    <p className="truncate text-xs text-gray-400">@{u.username}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && <p className="mt-2 text-center text-xs text-gray-400">搜索中…</p>}
      </div>

      {/* 会话列表 */}
      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-gray-400">
            <p className="mb-1 text-3xl">💬</p>
            暂无会话，搜索用户或创建群聊
          </li>
        )}
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-gray-100 dark:active:bg-night-700 ${
                c.id === activeConvId
                  ? 'bg-brand-50 dark:bg-night-700/60'
                  : 'hover:bg-gray-50 dark:hover:bg-night-700/40'
              }`}
              onClick={() => onSelect(c)}
            >
              <Avatar user={c.peer} isGroup={c.kind === 'group'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium text-gray-800 dark:text-gray-100">
                    {convTitle(c)}
                    {c.kind === 'group' && (
                      <span className="ml-1 text-xs font-normal text-gray-400">（{c.member_count}）</span>
                    )}
                  </p>
                  {c.last_message && (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {formatTime(c.last_message.created_at)}
                    </span>
                  )}
                </div>
                {c.last_message && (
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {c.kind === 'group' && c.last_message.sender
                      ? `${c.last_message.sender.nickname || c.last_message.sender.username}: `
                      : ''}
                    {previewText(c.last_message)}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function previewText(msg) {
  switch (msg.type) {
    case 'image': return '[图片]'
    case 'voice': return '[语音]'
    case 'file': return '[文件]'
    default: return msg.content
  }
}

function toDate(iso) {
  return new Date(typeof iso === 'string' && !iso.endsWith('Z') ? iso + 'Z' : iso)
}

function formatTime(iso) {
  const d = toDate(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const diff = (now - d) / 86400000
  if (diff < 7) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
