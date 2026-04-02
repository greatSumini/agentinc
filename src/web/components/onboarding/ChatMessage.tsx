import type { ChatMessage as ChatMessageType } from '../../hooks/useOnboarding'

interface ChatMessageProps {
  message: ChatMessageType
  ceoName?: string
}

export function ChatMessage({ message, ceoName = 'CEO' }: ChatMessageProps) {
  const isCeo = message.role === 'ceo'

  return (
    <div className={`flex ${isCeo ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isCeo
            ? 'bg-gray-100 text-gray-900'
            : 'bg-gray-900 text-white'
        }`}
      >
        {isCeo && (
          <span className="text-xs font-medium text-gray-500 block mb-1">
            {ceoName}
          </span>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}
