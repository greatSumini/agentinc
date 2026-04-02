interface ChatMessageProps {
  role: 'user' | 'ceo'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
