/**
 * EventBus
 *
 * Singleton for SSE event broadcasting to connected clients.
 */

export type EventType =
  | 'ticket:created'
  | 'ticket:updated'
  | 'agent:status'
  | 'onboarding:question'
  | 'onboarding:status'

export class EventBus {
  private listeners: Map<string, Set<(data: string) => void>> = new Map()

  subscribe(clientId: string, callback: (data: string) => void): void {
    if (!this.listeners.has(clientId)) {
      this.listeners.set(clientId, new Set())
    }
    this.listeners.get(clientId)!.add(callback)
  }

  unsubscribe(clientId: string): void {
    this.listeners.delete(clientId)
  }

  emit(event: EventType, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const callbacks of this.listeners.values()) {
      for (const callback of callbacks) {
        callback(message)
      }
    }
  }
}

// Singleton instance
export const eventBus = new EventBus()
