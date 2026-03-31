import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() && !disabled) {
      onSend(value.trim())
      setValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        rows={1}
        className="flex-1 border border-gray-200 rounded-md px-4 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  )
}
