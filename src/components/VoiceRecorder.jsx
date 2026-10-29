import { useEffect, useRef, useState } from 'react'

/**
 * 按住录音，松开发送，上滑取消（MediaRecorder）。
 * 回调 onSend(file, durationSeconds)
 */
export default function VoiceRecorder({ onSend, disabled }) {
  const [recording, setRecording] = useState(false)
  const [willCancel, setWillCancel] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const startTimeRef = useRef(0)
  const startYRef = useRef(0)
  const cancelRef = useRef(false)
  const timerRef = useRef(null)

  async function start(e) {
    if (disabled || recording) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('当前浏览器不支持录音')
      return
    }
    // 捕获指针：手指滑出按钮仍能收到 move/up 事件，"上滑取消"才不会误触发发送
    e.target.setPointerCapture?.(e.pointerId)
    startYRef.current = e.clientY ?? 0
    cancelRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(timerRef.current)
        if (cancelRef.current) return
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        if (duration < 1) return
        const ext = recorder.mimeType?.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        onSend(new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type }), duration)
      }
      recorder.start()
      recorderRef.current = recorder
      startTimeRef.current = Date.now()
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(
        () => setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)),
        1000,
      )
    } catch {
      alert('无法访问麦克风，请检查权限')
    }
  }

  function move(e) {
    if (!recording) return
    const cancel = startYRef.current - (e.clientY ?? startYRef.current) > 80
    cancelRef.current = cancel
    setWillCancel(cancel)
  }

  function stop() {
    if (!recording) return
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setWillCancel(false)
  }

  useEffect(
    () => () => {
      cancelRef.current = true
      recorderRef.current?.stop()
      clearInterval(timerRef.current)
    },
    [],
  )

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
        className={`select-none touch-none rounded-xl px-3 py-2.5 text-sm transition active:scale-95 disabled:opacity-40 ${
          recording
            ? 'bg-red-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-night-700 dark:text-gray-300 dark:hover:bg-night-600'
        }`}
      >
        {recording ? `🔴 ${seconds}s` : '🎤'}
      </button>

      {/* 录音悬浮提示 */}
      {recording && (
        <div className="pointer-events-none fixed inset-x-0 bottom-32 z-50 flex justify-center">
          <div
            className={`animate-fade-up rounded-2xl px-6 py-4 text-center shadow-xl ${
              willCancel ? 'bg-red-500 text-white' : 'bg-white text-gray-700 dark:bg-night-700 dark:text-gray-100'
            }`}
          >
            <p className="text-2xl">{willCancel ? '✕' : '🎙️'}</p>
            <p className="mt-1 text-sm">{willCancel ? '松开取消' : `录音中 ${seconds}s，上滑取消`}</p>
          </div>
        </div>
      )}
    </>
  )
}
