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
declare global {
    interface GlobalThis {
        CustomEvent: typeof CustomEvent;
        Event: typeof Event;
    }
}
