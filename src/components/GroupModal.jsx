import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { Avatar } from './Sidebar'

/**
 * 群聊管理弹窗：
 *  - mode='create'：创建群（输入群名 + 勾选成员）
 *  - mode='manage'：群详情/管理（成员列表，群主可改名/加人/踢人；成员可退群）
 */
export default function GroupModal({ mode, conversation, me, onClose, onCreated, onUpdated, onLeft }) {
  const isCreate = mode === 'create'
  const isOwner = !isCreate && conversation?.owner_id === me?.id

  const [name, setName] = useState(isCreate ? '' : conversation?.name || '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [recent, setRecent] = useState([]) // 最近私聊联系人（快速勾选）
  const [selected, setSelected] = useState([]) // 待添加/初始成员 UserOut[]
  const [members, setMembers] = useState(conversation?.members || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  // 拉取最近联系人作为候选
  useEffect(() => {
    if (isCreate || isOwner) {
      api.recentContacts().then(setRecent).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 管理模式：拉取最新成员列表
  useEffect(() => {
    if (!isCreate && conversation?.id) {
      api.groupDetail(conversation.id)
        .then((d) => { setMembers(d.members || []); setName(d.name) })
        .catch((e) => setError(e.message))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try { setResults(await api.searchUsers(query)) } catch { /* 忽略 */ }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const memberIds = new Set(members.map((m) => m.user.id))
  const selectedIds = new Set(selected.map((s) => s.id))
  const excluded = (u) => memberIds.has(u.id) || u.id === me?.id || selectedIds.has(u.id)
  const candidates = results.filter((u) => !excluded(u))
  // 最近联系人中尚未入选的（输入关键字时按昵称/用户名过滤，否则全部展示）
  const recentCandidates = recent
    .filter((u) => !excluded(u))
    .filter((u) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (u.nickname || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    })

  function toggleCandidate(u) {
    if (selectedIds.has(u.id)) {
      removeCandidate(u.id)
    } else {
      setSelected((prev) => [...prev, u])
    }
  }

  function addCandidate(u) {
    setSelected((prev) => [...prev, u])
    setQuery('')
    setResults([])
  }

  function removeCandidate(id) {
    setSelected((prev) => prev.filter((u) => u.id !== id))
  }

  async function handleCreate() {
    if (!name.trim()) { setError('请输入群名称'); return }
    setBusy(true); setError('')
    try {
      const conv = await api.createGroup({ name: name.trim(), member_ids: selected.map((u) => u.id) })
      onCreated(conv)
      onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === conversation.name) return
    setBusy(true); setError('')
    try {
      const d = await api.renameGroup(conversation.id, name.trim())
      onUpdated(d)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleAddMembers() {
    if (selected.length === 0) return
    setBusy(true); setError('')
    try {
      const d = await api.addGroupMembers(conversation.id, selected.map((u) => u.id))
      setMembers(d.members || [])
      setSelected([])
      onUpdated(d)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleRemove(uid) {
    if (!confirm('确定将该成员移出群聊？')) return
    setBusy(true); setError('')
    try {
      const d = await api.removeGroupMember(conversation.id, uid)
      setMembers(d.members || [])
      onUpdated(d)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleLeave() {
    const tip = isOwner ? '你是群主，退群将解散该群，确定？' : '确定退出该群？'
    if (!confirm(tip)) return
    setBusy(true); setError('')
    try {
      await api.leaveGroup(conversation.id)
      onLeft(conversation.id)
      onClose()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-night-800 sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-night-600">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">
            {isCreate ? '创建群聊' : `群聊信息（${members.length} 人）`}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-night-700">✕</button>
        </div>

        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10">{error}</p>}

          {/* 群名 */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">群名称</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-night-600 dark:bg-night-700"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入群名称"
                disabled={!isCreate && !isOwner}
                maxLength={100}
              />
              {!isCreate && isOwner && name.trim() !== conversation.name && (
                <button onClick={handleRename} disabled={busy}
                  className="rounded-xl bg-brand-500 px-4 text-sm text-white disabled:opacity-50">
                  保存
                </button>
              )}
            </div>
          </div>

          {/* 搜索添加成员 */}
          {(isCreate || isOwner) && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">{isCreate ? '选择成员' : '添加成员'}</label>
              {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selected.map((u) => (
                    <span key={u.id} className="flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-1 pr-2 text-xs text-brand-700 dark:bg-night-700 dark:text-brand-300">
                      <Avatar user={u} size="sm" className="!h-5 !w-5" />
                      {u.nickname || u.username}
                      <button onClick={() => removeCandidate(u.id)} className="ml-0.5 text-gray-400 hover:text-red-500">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-night-600 dark:bg-night-700"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索用户名或昵称"
              />

              {/* 最近联系人：下拉式多选列表，点击勾选/取消 */}
              {recentCandidates.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[11px] text-gray-400">最近聊过</p>
                  <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100 dark:divide-night-600 dark:border-night-600">
                    {recentCandidates.map((u) => {
                      const checked = selectedIds.has(u.id)
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => toggleCandidate(u)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                              checked ? 'bg-brand-50 dark:bg-night-700' : 'hover:bg-gray-50 dark:hover:bg-night-700'
                            }`}
                          >
                            <Avatar user={u} size="sm" />
                            <span className="min-w-0 flex-1 truncate">
                              {u.nickname || u.username}
                              <span className="ml-1 text-xs text-gray-400">@{u.username}</span>
                            </span>
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
                                checked
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-gray-300 text-transparent dark:border-night-600'
                              }`}
                            >
                              ✓
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* 全站搜索结果（不在最近联系人中的） */}
              {candidates.length > 0 && (
                <ul className="mt-1 max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100 dark:divide-night-600 dark:border-night-600">
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button onClick={() => addCandidate(u)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-night-700">
                        <Avatar user={u} size="sm" />
                        <span className="truncate">{u.nickname || u.username}</span>
                        <span className="text-xs text-gray-400">@{u.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!isCreate && selected.length > 0 && (
                <button onClick={handleAddMembers} disabled={busy}
                  className="mt-2 w-full rounded-xl bg-brand-500 py-2 text-sm text-white disabled:opacity-50">
                  添加 {selected.length} 人
                </button>
              )}
            </div>
          )}

          {/* 成员列表（管理模式） */}
          {!isCreate && (
            <div>
              <label className="mb-1 block text-xs text-gray-400">成员列表</label>
              <ul className="divide-y divide-gray-100 dark:divide-night-600">
                {members.map((m) => (
                  <li key={m.user.id} className="flex items-center gap-3 py-2.5">
                    <Avatar user={m.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                        {m.user.nickname || m.user.username}
                        {m.user.id === me?.id && <span className="ml-1 text-xs text-gray-400">（我）</span>}
                      </p>
                      <p className="text-xs text-gray-400">@{m.user.username}</p>
                    </div>
                    {m.role === 'owner' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">群主</span>
                    ) : isOwner ? (
                      <button
                        onClick={() => handleRemove(m.user.id)}
                        disabled={busy}
                        className="rounded-lg px-2 py-1 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
                      >
                        移除
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="safe-bottom border-t border-gray-100 p-4 dark:border-night-600">
          {isCreate ? (
            <button onClick={handleCreate} disabled={busy || !name.trim()}
              className="w-full rounded-xl bg-brand-500 py-3 font-medium text-white transition hover:bg-brand-600 disabled:opacity-50">
              {busy ? '创建中…' : `创建群聊${selected.length ? `（${selected.length + 1} 人）` : ''}`}
            </button>
          ) : (
            <button onClick={handleLeave} disabled={busy}
              className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:hover:bg-red-500/10">
              {isOwner ? '解散群聊' : '退出群聊'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
