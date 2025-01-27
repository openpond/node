import fs from "fs/promises";
import path from "path";
export class Logger {
    static logHandlers = [];
    static logFile = null;
    static initialized = false;
    static async init(agentName, options = { useStdout: true, useFile: true }) {
        try {
            // Create logs directory if it doesn't exist
            const logsDir = path.resolve(process.cwd(), "logs");
            await fs.mkdir(logsDir, { recursive: true });
            // Use agent name for the log file
            const logPath = path.resolve(logsDir, `${agentName}.log`);
            // Initialize the file with a header
            if (options.useFile) {
                await fs.writeFile(logPath, `=== Log started for ${agentName} at ${new Date().toISOString()} ===\n`);
                this.logFile = logPath;
            }
            this.initialized = true;
            // Set up stdout log handler
            if (options.useStdout) {
                this.addLogHandler((level, namespace, message, meta) => {
                    const timestamp = new Date().toISOString();
                    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
                    const logLine = `[${timestamp}] [${level}] [${namespace}] ${message}${metaStr}`;
                    // Use different console methods based on level
                    switch (level) {
                        case "ERROR":
                            console.error(logLine);
                            break;
                        case "WARN":
                            console.warn(logLine);
                            break;
                        case "DEBUG":
                            console.debug(logLine);
                            break;
                        default:
                            console.log(logLine);
                    }
                });
            }
            // Set up file log handler
            if (options.useFile) {
                this.addLogHandler(async (level, namespace, message, meta) => {
                    if (!this.logFile)
                        return;
                    const timestamp = new Date().toISOString();
                    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
                    const logLine = `[${timestamp}] [${level}] [${namespace}] ${message}${metaStr}\n`;
                    try {
                        await fs.appendFile(this.logFile, logLine);
                    }
                    catch (error) {
                        console.error("Failed to write to log file:", error);
                    }
                });
            }
            this.info("Logger", "Logging initialized", { logPath, options });
        }
        catch (error) {
            console.error("Failed to initialize logger:", error);
            throw error;
        }
    }
    static addLogHandler(handler) {
        this.logHandlers.push(handler);
    }
    static clearLogHandlers() {
        this.logHandlers = [];
    }
    static setLogHandler(handler) {
        // Clear existing handlers and set the new one
        this.clearLogHandlers();
        this.addLogHandler(handler);
    }
    static async cleanup() {
        if (this.logFile) {
            try {
                await fs.appendFile(this.logFile, `=== Log ended at ${new Date().toISOString()} ===\n`);
            }
            catch (error) {
                console.error("Failed to cleanup logger:", error);
            }
        }
    }
    static async log(level, namespace, message, meta) {
        if (!this.initialized) {
            console.warn("Logger not initialized!");
            return;
        }
        // Call all registered handlers
        for (const handler of this.logHandlers) {
            try {
                await handler(level, namespace, message, meta);
            }
            catch (error) {
                console.error("Handler failed:", error);
            }
        }
    }
    static async debug(namespace, message, meta) {
        await this.log("DEBUG", namespace, message, meta);
    }
    static async info(namespace, message, meta) {
        await this.log("INFO", namespace, message, meta);
    }
    static async warn(namespace, message, meta) {
        await this.log("WARN", namespace, message, meta);
    }
    static async error(namespace, message, meta) {
        await this.log("ERROR", namespace, message, meta);
    }
}
//# sourceMappingURL=logger.js.map