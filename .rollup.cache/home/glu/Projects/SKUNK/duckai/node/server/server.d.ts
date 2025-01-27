export declare class APIServer {
    private port;
    private nodePrivateKey;
    private registryAddress;
    private rpcUrl;
    private network;
    private app;
    private p2p;
    private connectedClients;
    private registryContract;
    private publicClient;
    constructor(port: number | undefined, nodePrivateKey: string, registryAddress: string, rpcUrl: string, network?: "base" | "mode");
    private setupExpress;
    private setupRoutes;
    private setupP2PHandlers;
    private updateClientConnection;
    private startCleanupInterval;
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleMessage;
}
