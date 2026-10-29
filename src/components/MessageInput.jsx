import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { wsClient } from '../ws/client'
import VoiceRecorder from './VoiceRecorder'

const MAX_MB = 5

/** 输入栏：移动端优先，自适应增高文本框 + 附件面板。conv 为当前会话对象。
 *  onLocalMessage：上传成功但 WS 回执丢失时，由父组件本地合并消息（按 id 去重）。
 */
export default function MessageInput({ conversation, onLocalMessage }) {
  const convId = conversation?.id
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const textareaRef = useRef(null)
  const imageRef = useRef(null)
  const fileRef = useRef(null)

  // 切换会话时清空草稿和面板，避免把给 A 的话发给了 B
  useEffect(() => {
    setText('')
    setShowPanel(false)
  }, [convId])

  // 自适应高度（最多 5 行左右）
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  function sendText() {
    const content = text.trim()
    if (!content) return
    if (!wsClient.send({ action: 'send', conv_id: convId, type: 'text', content })) {
      alert('连接已断开，请稍后重试')
      return
    }
    setText('')
    setShowPanel(false)
  }

  async function sendFile(file, kind) {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`文件不能超过 ${MAX_MB}MB`)
      return
    }
    setSending(true)
    setShowPanel(false)
    try {
      // 上传带 conv_id：服务端直接生成消息并推送；
      // 若 WS 恰好断开导致收不到回执，本地合并一次（父组件按 id 去重）
      const res = await api.upload(file, kind, { convId })
      if (res?.message) onLocalMessage?.(res.message)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  const sendVoice = (file, _duration) => sendFile(file, 'voice')

  function onKeyDown(e) {
    // 桌面端 Enter 发送；移动端键盘 Enter 通常是换行键，不拦截
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(pointer: fine)').matches) {
      e.preventDefault()
      sendText()
    }
  }

  return (
    <div className="safe-bottom border-t border-gray-200 bg-white dark:border-night-600 dark:bg-night-800">
      <div className="flex items-end gap-2 p-2.5">
        <VoiceRecorder onSend={sendVoice} disabled={sending} />

        <textarea
          ref={textareaRef}
          className="min-h-[42px] flex-1 resize-none rounded-xl border-none bg-gray-100 px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-500/50 dark:bg-night-700"
          rows={1}
          placeholder="发送消息…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setShowPanel(false)}
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={sendText}
            className="animate-fade-up rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow transition hover:bg-brand-600 active:scale-95"
          >
            发送
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            className={`rounded-xl px-3 py-2.5 text-lg transition active:scale-95 ${
              showPanel
                ? 'bg-brand-100 text-brand-600 dark:bg-night-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-night-700 dark:text-gray-300 dark:hover:bg-night-600'
            }`}
          >
            ＋
          </button>
        )}
      </div>

      {/* 附件面板 */}
      {showPanel && (
        <div className="grid animate-fade-up grid-cols-4 gap-4 px-6 pb-4 pt-1">
          <PanelButton
            icon="🖼️"
            label="图片"
            disabled={sending}
            onClick={() => imageRef.current?.click()}
          />
          <PanelButton
            icon="📎"
            label="文件"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
          />
        </div>
      )}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { sendFile(e.target.files[0], 'image'); e.target.value = '' }}
      />
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => { sendFile(e.target.files[0], 'file'); e.target.value = '' }}
      />

      {sending && (
        <p className="pb-2 text-center text-xs text-gray-400">上传中…</p>
      )}
    </div>
  )
}

function PanelButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-40"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl transition active:scale-95 dark:bg-night-700">
        {icon}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </button>
  )
}
