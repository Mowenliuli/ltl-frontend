/** REST 请求封装：自动带 JWT，统一错误处理。 */
import { API_BASE } from '../config'

export function getToken() {
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
}

async function request(path, { method = 'GET', body, formData } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('未登录或登录已过期')
  }
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const data = await res.json()
      if (data.detail) detail = data.detail
    } catch { /* 非 JSON 响应 */ }
    throw new Error(detail)
  }
  return res.json()
}

/** 带鉴权拉取文件并转为 blob: URL（用于鉴权下载接口）。返回 null 表示失败。 */
export async function fetchBlobUrl(path) {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

export const api = {
  // auth
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  // users
  searchUsers: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  // chat
  conversations: () => request('/api/chat/conversations'),
  recentContacts: () => request('/api/chat/recent-contacts'),
  openConversation: (peerId) => request(`/api/chat/conversations/${peerId}`, { method: 'POST' }),
  messages: (convId, beforeId) =>
    request(`/api/chat/conversations/${convId}/messages${beforeId ? `?before_id=${beforeId}` : ''}`),
  // files
  upload: (file, kind, { convId, peerId } = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    const params = new URLSearchParams({ kind })
    if (convId) params.set('conv_id', convId)
    if (peerId) params.set('peer_id', peerId)
    return request(`/api/files/upload?${params}`, { method: 'POST', formData: fd })
  },
  // groups
  createGroup: (body) => request('/api/groups', { method: 'POST', body }),
  groupDetail: (id) => request(`/api/groups/${id}`),
  renameGroup: (id, name) => request(`/api/groups/${id}`, { method: 'PATCH', body: { name } }),
  addGroupMembers: (id, user_ids) => request(`/api/groups/${id}/members`, { method: 'POST', body: { user_ids } }),
  removeGroupMember: (id, uid) => request(`/api/groups/${id}/members/${uid}`, { method: 'DELETE' }),
  leaveGroup: (id) => request(`/api/groups/${id}/leave`, { method: 'POST' }),
}
