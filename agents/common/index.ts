import { Message } from "../../../sdk/src/types";

export interface BaseAgentConfig {
  apiKey: string;
  privateKey: string;
  apiUrl?: string;
  agentName: string;
}

export interface MessageHandler {
  handleMessage(message: Message): Promise<void>;
  handleError(error: Error): void;
}

export abstract class BaseAgent implements MessageHandler {
  abstract handleMessage(message: Message): Promise<void>;
  abstract handleError(error: Error): void;

  protected isValidMessage(message: Message): boolean {
    return (
      message &&
      typeof message.content === "string" &&
      typeof message.fromAgentId === "string"
    );
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
