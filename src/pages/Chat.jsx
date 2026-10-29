import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api/client'
import { wsClient } from '../ws/client'
import { useTheme } from '../hooks/useTheme'
import Sidebar, { Avatar, convTitle } from '../components/Sidebar'
import MessageItem, { shouldShowTime } from '../components/MessageItem'
import MessageInput from '../components/MessageInput'
import GroupModal from '../components/GroupModal'

/** 本地删除记录按「用户+会话」存 localStorage：换设备/清缓存后恢复，且不影响对方记录。 */
const HIDDEN_KEY_PREFIX = 'ltl:hidden-msgs:'

function loadHidden(convId) {
  try {
    const raw = localStorage.getItem(`${HIDDEN_KEY_PREFIX}${convId}`)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveHidden(convId, ids) {
  try {
    localStorage.setItem(`${HIDDEN_KEY_PREFIX}${convId}`, JSON.stringify([...ids]))
  } catch { /* 容量满时静默失败，本次会话内删除仍生效 */ }
}

export default function Chat() {
  const [me, setMe] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [wsOnline, setWsOnline] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  // 移动端：是否显示聊天面板（false = 显示会话列表）
  const [showChatMobile, setShowChatMobile] = useState(false)
  // 群聊弹窗：null | { mode: 'create' | 'manage', conversation? }
  const [groupModal, setGroupModal] = useState(null)
  // 消息管理（本地多选删除，不影响对方）
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const listRef = useRef(null)
  const activeConvRef = useRef(null)
  activeConvRef.current = activeConv
  const navigate = useNavigate()
  const { theme, cycle } = useTheme()

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    })
  }

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.conversations())
    } catch { /* 401 已由 api 层处理 */ }
  }, [])

  // 初始化：加载用户、会话，建立 WS
  useEffect(() => {
    api.me().then(setMe).catch(() => {})
    loadConversations()

    // StrictMode 双挂载保护：cleanup 会立刻 disconnect，延迟到下一拍再 connect，
    // 让第二次 mount 的 connect 能真正生效（disconnect 是同步把 closedByUser 置 true）。
    const connectTimer = setTimeout(() => wsClient.reopen(), 0)

    const offOpen = wsClient.on('open', () => setWsOnline(true))
    const offClose = wsClient.on('close', () => setWsOnline(false))
    const offSent = wsClient.on('sent', handleIncoming)
    const offMsg = wsClient.on('message', handleIncoming)
    const offGroup = wsClient.on('group_updated', handleGroupUpdated)
    return () => {
      clearTimeout(connectTimer)
      offOpen(); offClose(); offSent(); offMsg(); offGroup()
      wsClient.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 打开会话时加载历史消息（带竞态防护：切换会话后丢弃旧响应）
  useEffect(() => {
    if (!activeConv) return
    const convId = activeConv.id
    let cancelled = false
    setHasMore(true)
    api.messages(convId).then((msgs) => {
      if (cancelled || activeConvRef.current?.id !== convId) return
      // 合并本地已删除记录（刷新后重新屏蔽）
      const hidden = loadHidden(convId)
      const visible = msgs.filter((m) => !hidden.has(m.id))
      // 若整页都被本地删除且可能还有更早的，自动再拉一页补齐
      setMessages(visible)
      if (msgs.length < 50) setHasMore(false)
      scrollToBottom()
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id])

  // 下拉加载更多历史（同样校验响应回来时仍在同一会话）
  async function onListScroll() {
    const el = listRef.current
    const convId = activeConvRef.current?.id
    if (!el || el.scrollTop > 40 || loadingMore || !hasMore || messages.length === 0 || !convId) return
    setLoadingMore(true)
    try {
      const older = await api.messages(convId, messages[0].id)
      if (activeConvRef.current?.id !== convId) return
      if (older.length < 50) setHasMore(false)
      const hidden = loadHidden(convId)
      const visible = older.filter((m) => !hidden.has(m.id))
      if (visible.length > 0) {
        const prevHeight = el.scrollHeight
        setMessages((prev) => [...visible, ...prev])
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight
        })
      }
    } catch { /* 网络错误忽略，下次滚动重试 */ } finally {
      setLoadingMore(false)
    }
  }

  function handleIncoming(msg) {
    // 被我本地删除的消息再次到达（理论上新消息不会重复，保险起见）时忽略
    if (activeConvRef.current?.id === msg.conversation_id) {
      if (!loadHidden(msg.conversation_id).has(msg.id)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        scrollToBottom()
      }
    }
    loadConversations()
  }

  // 群变更（改名/加人/踢人/解散）：刷新会话列表；若自己被移出或群已解散则退出该会话
  // 通过 ref 读取当前会话，避免 useEffect([]) 注册的回调捕获到陈旧闭包
  function handleGroupUpdated(data) {
    loadConversations()
    if (!activeConvRef.current || activeConvRef.current.id !== data.conversation_id) return
    if (data.by === 'dissolve' || data.by === 'removed') {
      alert(data.by === 'dissolve' ? '该群聊已解散' : '你已被移出该群聊')
      setActiveConv(null)
      setMessages([])
      setShowChatMobile(false)
    }
  }

  function handleGroupCreated(conv) {
    handleNewConversation(conv)
    loadConversations()
  }

  // 群资料变更后同步当前会话信息（群名/人数）
  function handleGroupUpdatedLocal(detail) {
    setActiveConv((cur) => (cur && cur.id === detail.id ? { ...cur, ...detail } : cur))
    loadConversations()
  }

  // 退群/解散后从列表移除并退出会话
  function handleGroupLeft(convId) {
    setConversations((prev) => prev.filter((c) => c.id !== convId))
    setActiveConv(null)
    setMessages([])
    setShowChatMobile(false)
  }

  function handleSelect(conv) {
    setActiveConv(conv)
    setMessages([])
    setShowChatMobile(true)
    exitSelectMode()
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function toggleSelectMsg(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 本地删除：只从自己视图移除，不影响对方/其他群成员的记录
  function deleteSelected() {
    if (selected.size === 0 || !activeConvRef.current) return
    if (!confirm(`确定删除选中的 ${selected.size} 条消息？（仅从你的记录中移除）`)) return
    const convId = activeConvRef.current.id
    const hidden = loadHidden(convId)
    selected.forEach((id) => hidden.add(id))
    saveHidden(convId, hidden)
    setMessages((prev) => prev.filter((m) => !selected.has(m.id)))
    exitSelectMode()
  }

  function handleNewConversation(conv) {
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]))
    handleSelect(conv)
  }

  function logout() {
    wsClient.disconnect()
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-night-900">
      {/* 侧边栏：移动端整屏，桌面端固定宽度 */}
      <div className={`${showChatMobile ? 'hidden' : 'flex'} w-full md:flex md:w-80 md:shrink-0`}>
        <Sidebar
          me={me}
          conversations={conversations}
          activeConvId={activeConv?.id}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
          onCreateGroup={() => setGroupModal({ mode: 'create' })}
          onLogout={logout}
          wsOnline={wsOnline}
        />
      </div>

      {/* 聊天面板 */}
      <div className={`${showChatMobile ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}>
        {activeConv ? (
          <>
            {/* 顶部栏 */}
            <div className="safe-top flex items-center gap-3 border-b border-gray-200 bg-white/90 px-3 py-3 backdrop-blur dark:border-night-600 dark:bg-night-800/90">
              <button
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 active:scale-95 dark:text-gray-300 dark:hover:bg-night-700 md:hidden"
                onClick={() => setShowChatMobile(false)}
                aria-label="返回会话列表"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <Avatar user={activeConv.peer} size="sm" isGroup={activeConv.kind === 'group'} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                  {convTitle(activeConv)}
                  {activeConv.kind === 'group' && (
                    <span className="ml-1 text-xs font-normal text-gray-400">（{activeConv.member_count}）</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {activeConv.kind === 'group' ? '群聊' : `@${activeConv.peer?.username}`}
                </p>
              </div>
              {activeConv.kind === 'group' && (
                <button
                  onClick={() => setGroupModal({ mode: 'manage', conversation: activeConv })}
                  title="群聊设置"
                  className="rounded-lg p-2 transition hover:bg-gray-100 active:scale-95 dark:hover:bg-night-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-300">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}
              {!selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  title="多选消息（本地删除，不影响对方）"
                  className="rounded-lg p-2 transition hover:bg-gray-100 active:scale-95 dark:hover:bg-night-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-300">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </button>
              )}
              <button
                onClick={cycle}
                title={`主题：${theme === 'system' ? '跟随系统' : theme === 'light' ? '白天' : '夜晚'}`}
                className="rounded-lg p-2 transition hover:bg-gray-100 active:scale-95 dark:hover:bg-night-700"
              >
                {theme === 'system' ? '🖥️' : theme === 'light' ? '☀️' : '🌙'}
              </button>
            </div>

            {/* 消息区 */}
            <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto py-2">
              {loadingMore && (
                <p className="py-2 text-center text-xs text-gray-400">加载更早的消息…</p>
              )}
              {!hasMore && messages.length > 0 && (
                <p className="py-2 text-center text-[11px] text-gray-300 dark:text-gray-600">
                  — 没有更早的消息了 —
                </p>
              )}
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  msg={m}
                  isMine={m.sender_id === me?.id}
                  showTime={shouldShowTime(messages[i - 1], m)}
                  showSender={activeConv.kind === 'group' && m.sender_id !== me?.id}
                  selectMode={selectMode}
                  selectChecked={selected.has(m.id)}
                  onToggleSelect={() => toggleSelectMsg(m.id)}
                />
              ))}
            </div>

            {selectMode ? (
              <div className="safe-bottom flex items-center justify-between border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-night-600 dark:bg-night-800/90">
                <span className="text-sm text-gray-500 dark:text-gray-300">
                  已选 {selected.size} 条
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exitSelectMode}
                    className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 active:scale-95 dark:text-gray-300 dark:hover:bg-night-700"
                  >
                    取消
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={selected.size === 0}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 active:scale-95 disabled:opacity-40"
                  >
                    删除
                  </button>
                </div>
              </div>
            ) : (
              <MessageInput conversation={activeConv} onLocalMessage={handleIncoming} />
            )}
          </>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-gray-400 md:flex">
            <span className="text-5xl">💬</span>
            <p>选择或发起一个会话</p>
          </div>
        )}
      </div>

      {groupModal && (
        <GroupModal
          mode={groupModal.mode}
          conversation={groupModal.conversation}
          me={me}
          onClose={() => setGroupModal(null)}
          onCreated={handleGroupCreated}
          onUpdated={handleGroupUpdatedLocal}
          onLeft={handleGroupLeft}
        />
      )}
    </div>
  )
}
