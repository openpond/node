// @ts-nocheck
interface CustomEventInit<T = any> {
  detail?: T;
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}

interface EventInit {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}

// Add type declaration for globalThis
declare global {
  interface GlobalThis {
    CustomEvent: typeof CustomEvent;
    Event: typeof Event;
  }
}

if (typeof globalThis.CustomEvent !== "function") {
  class CustomEvent<T = any> extends Event {
    public detail?: T;
    constructor(type: string, options?: CustomEventInit<T>) {
      super(type, options);
      this.detail = options?.detail;
    }
  }

  globalThis.CustomEvent = CustomEvent as any;
}

if (typeof globalThis.Event !== "function") {
  class Event {
    public type: string;
    constructor(type: string, options?: EventInit) {
      this.type = type;
    }
  }

  globalThis.Event = Event as any;
}
