/**
 * EventBus - Central decoupled publish/subscribe event dispatcher
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const unbind = this.on(event, (data) => {
      unbind();
      callback(data);
    });
    return unbind;
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for event "${event}":`, error);
        }
      });
    }
  }
}

export const eventBus = new EventBus();
