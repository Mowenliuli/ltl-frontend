/** 主题 hook：light / dark / system，持久化到 localStorage，监听系统切换。 */
import { useCallback, useEffect, useState } from 'react'

function getInitial() {
  return localStorage.getItem('theme') || 'system'
}

function apply(theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const [theme, setThemeState] = useState(getInitial)

  useEffect(() => {
    apply(theme)
    if (theme === 'system') {
      localStorage.removeItem('theme')
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => apply('system')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // 三态循环：system -> light -> dark -> system
  const cycle = useCallback(() => {
    setThemeState((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))
  }, [])

  return { theme, cycle }
}
