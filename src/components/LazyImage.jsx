import { useEffect, useRef, useState } from 'react'

/**
 * 可视区域内才加载的图片（替代原生 loading="lazy"）。
 * 原生 lazy + display:none 占位会触发浏览器懒加载干预导致永不加载；
 * 这里用 IntersectionObserver 显式控制，任何状态下都能可靠加载。
 */
export default function LazyImage({ src, alt, className, onLoad, onError, fetchStrategy }) {
  const [inView, setInView] = useState(fetchStrategy === 'auth' ? true : false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (fetchStrategy === 'auth') return // blob 由父组件获取，这里只负责渲染
    const el = wrapRef.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' }, // 提前 200px 预加载
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return (
    <span ref={wrapRef} className="contents">
      {inView ? (
        <img src={src} alt={alt} className={className} onLoad={onLoad} onError={onError} />
      ) : null}
    </span>
  )
}
