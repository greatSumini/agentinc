import { useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import { ChatMessage } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'

export function ChatPage() {
  const { state, sendMessage } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages, state.loading])

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Talk to CEO</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {state.messages.map((msg, index) => (
          <ChatMessage key={index} role={msg.role} content={msg.content} />
        ))}

        {/* Loading indicator */}
        {state.loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-500">
              <span>CEO is thinking</span>
              <span className="thinking-dots"></span>
            </div>
          </div>
        )}

        {/* Error display */}
        {state.error && (
          <div className="flex justify-center mb-3">
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
              Error: {state.error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-6 py-4 bg-white">
        <ChatInput onSend={sendMessage} disabled={state.loading} />
      </div>
    </div>
  )
}
