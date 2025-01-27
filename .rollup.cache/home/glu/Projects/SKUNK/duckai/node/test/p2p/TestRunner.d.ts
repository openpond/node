import { EventEmitter } from "events";
interface TestResult {
    success: boolean;
    error?: Error;
    messagesSent: number;
    messagesReceived: number;
    startTime: number;
    endTime: number;
}
interface TestSummary {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: Map<string, TestResult>;
    duration: number;
}
export declare class TestRunner extends EventEmitter {
    private readonly registryAddress;
    private readonly rpcUrl;
    private readonly funderPrivateKey;
    private bootstrapNodes;
    private agents;
    private messageLog;
    private results;
    private funderClient;
    constructor(registryAddress: string, rpcUrl: string, funderPrivateKey: `0x${string}`);
    init(): Promise<void>;
    private fundAgent;
    private generateAgentCapabilities;
    private generatePrivateKey;
    startBootstrapNodes(count?: number): Promise<void>;
    createAgents(count: number): Promise<void>;
    runMessageTest(): Promise<TestResult>;
    generateSummary(): TestSummary;
    cleanup(): Promise<void>;
}
export {};
