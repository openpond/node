export interface NodeEvent {
    type: "ready" | "message" | "peer_discovered";
    payload: {
        peerId?: string;
        from?: string;
        content?: string;
        topics?: string[];
    };
}
