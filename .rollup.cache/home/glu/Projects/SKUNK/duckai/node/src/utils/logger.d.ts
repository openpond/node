export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LogHandler = (level: LogLevel, namespace: string, message: string, meta?: any) => void;
interface LoggerOptions {
    useStdout?: boolean;
    useFile?: boolean;
}
export declare class Logger {
    private static logHandlers;
    private static logFile;
    private static initialized;
    static init(agentName: string, options?: LoggerOptions): Promise<void>;
    static addLogHandler(handler: LogHandler): void;
    static clearLogHandlers(): void;
    static setLogHandler(handler: LogHandler): void;
    static cleanup(): Promise<void>;
    private static log;
    static debug(namespace: string, message: string, meta?: any): Promise<void>;
    static info(namespace: string, message: string, meta?: any): Promise<void>;
    static warn(namespace: string, message: string, meta?: any): Promise<void>;
    static error(namespace: string, message: string, meta?: any): Promise<void>;
}
export {};
