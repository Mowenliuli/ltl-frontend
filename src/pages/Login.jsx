import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'
import { useTheme } from '../hooks/useTheme'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { theme, cycle } = useTheme()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = isRegister ? { username, password, nickname } : { username, password }
      const data = isRegister ? await api.register(body) : await api.login(body)
      setToken(data.access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-gray-100 to-brand-100 px-4 dark:from-night-900 dark:via-night-900 dark:to-night-800">
      {/* 主题切换按钮 */}
      <button
        onClick={cycle}
        title={`主题：${theme === 'system' ? '跟随系统' : theme === 'light' ? '白天' : '夜晚'}`}
        className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-lg shadow backdrop-blur transition hover:scale-110 dark:bg-night-700"
      >
        {theme === 'system' ? '🖥️' : theme === 'light' ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-sm animate-fade-up rounded-3xl bg-white/90 p-8 shadow-xl backdrop-blur dark:bg-night-800/90">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white shadow-lg">
            💬
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {isRegister ? '创建账号' : '欢迎回来'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {isRegister ? '注册即可开始聊天' : '登录以继续'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white dark:border-night-600 dark:bg-night-700 dark:focus:border-brand-400 dark:focus:bg-night-700"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoComplete="username"
          />
          {isRegister && (
            <input
              className="w-full animate-fade-up rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white dark:border-night-600 dark:bg-night-700 dark:focus:border-brand-400 dark:focus:bg-night-700"
              placeholder="昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              maxLength={50}
            />
          )}
          <input
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white dark:border-night-600 dark:bg-night-700 dark:focus:border-brand-400 dark:focus:bg-night-700"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          {error && (
            <p className="animate-fade-up rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 font-medium text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? '请稍候…' : isRegister ? '注 册' : '登 录'}
          </button>
        </form>

        <button
          className="mt-5 w-full text-center text-sm text-brand-500 hover:underline dark:text-brand-400"
          onClick={() => { setIsRegister(!isRegister); setError('') }}
        >
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </button>
      </div>
    </div>
  )
}
