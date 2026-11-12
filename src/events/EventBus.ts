import type { ActivityEvent } from '../domain.ts';
/** Events are delivered only after the entire command has committed. */
export class EventBus {
  private listeners = new Set<(event: ActivityEvent) => void>();
  subscribe(listener: (event: ActivityEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  publish(events: ActivityEvent[]) {
    for (const event of events) for (const listener of [...this.listeners]) {
      try { listener(structuredClone(event)); } catch (error) { console.error('Office event subscriber failed', error); }
    }
  }
}
