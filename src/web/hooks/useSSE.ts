import { useEffect, useState, useRef, useCallback } from 'react'

export function useSSE(
  eventTypes: string[],
  onEvent: (type: string, data: unknown) => void
): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)

  // Keep onEvent ref updated
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource('/api/events')
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after delay
      setTimeout(connect, 3000)
    }

    // Add listeners for each event type
    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          onEventRef.current(eventType, data)
        } catch {
          // Ignore parse errors
        }
      })
    }
  }, [eventTypes])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  return { connected }
}
