"use strict";
if (typeof globalThis.CustomEvent !== "function") {
    class CustomEvent extends Event {
        detail;
        constructor(type, options) {
            super(type, options);
            this.detail = options?.detail;
        }
    }
    globalThis.CustomEvent = CustomEvent;
}
if (typeof globalThis.Event !== "function") {
    class Event {
        type;
        constructor(type, options) {
            this.type = type;
        }
    }
    globalThis.Event = Event;
}
//# sourceMappingURL=polyfills.js.map