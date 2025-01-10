import axios from "axios";
import OpenAI from "openai";
import { Message } from "../../../sdk/src/types";

export class MarketSentimentAgent {
  private api: ReturnType<typeof axios.create>;
  private openai: OpenAI;
  private conversationHistory: Map<
    string,
    Array<{ role: "system" | "user" | "assistant"; content: string }>
  > = new Map();

  constructor(
    apiKey: string,
    openaiApiKey: string,
    apiUrl: string = "http://localhost:3000"
  ) {
    // Initialize axios instance with base configuration
    this.api = axios.create({
      baseURL: apiUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
    });

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Set up error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error("API error:", error);
        throw error;
      }
    );
  }

  /**
   * Start the agent and begin listening for messages
   */
  async start(): Promise<void> {
    try {
      // Start polling for new messages
      this.startPolling();
      console.log("Market Sentiment Agent started successfully");
    } catch (error) {
      console.error("Failed to start agent:", error);
      throw error;
    }
  }

  /**
   * Stop the agent and cleanup
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log("Market Sentiment Agent stopped");
  }

  private pollInterval: NodeJS.Timeout | null = null;
  private lastMessageTimestamp: number = 0;

  /**
   * Start polling for new messages
   */
  private startPolling(): void {
    // Poll every 5 seconds
    this.pollInterval = setInterval(async () => {
      try {
        const response = await this.api.get("/messages", {
          params: {
            since: this.lastMessageTimestamp,
          },
        });

        const messages = response.data.messages || [];

        for (const message of messages) {
          await this.handleMessage(message);
          this.lastMessageTimestamp = Math.max(
            this.lastMessageTimestamp,
            message.timestamp
          );
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    }, 5000);
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message): Promise<void> {
    try {
      console.log("Received message:", message);

      // Process the message and generate response
      const response = await this.processMessage(message);

      // Send response back
      if (response) {
        await this.api.post("/messages", {
          toAgentId: message.fromAgentId,
          content: response,
          conversationId: message.conversationId,
        });
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  /**
   * Process incoming message and generate response using OpenAI
   */
  private async processMessage(message: Message): Promise<string | null> {
    try {
      // Get or initialize conversation history
      if (!this.conversationHistory.has(message.fromAgentId)) {
        this.conversationHistory.set(message.fromAgentId, []);
      }
      const history = this.conversationHistory.get(message.fromAgentId)!;

      // Build messages array with system prompt and history
      const messages = [
        {
          role: "system" as const,
          content: `You are a Market Sentiment Analysis agent in the OpenPond P2P network.
Your main capabilities:
- Analyze market sentiment and trends
- Provide insights on market movements
- Interpret financial news and data
Keep responses concise (2-3 sentences) but informative.
Your main traits:
- Professional and analytical
- Data-driven in your responses
- Focus on market sentiment and trends
- Expert in financial markets and crypto`,
        },
        ...history,
        {
          role: "user" as const,
          content: message.content,
        },
      ];

      // Add artificial delay to prevent rate limiting
      await this.delay(500);

      const completion = await this.openai.chat.completions.create({
        messages,
        model: "gpt-3.5-turbo",
        temperature: 0.7,
      });

      const response =
        completion.choices[0].message.content ||
        "Sorry, I couldn't process that request.";

      // Update conversation history
      history.push(
        { role: "user", content: message.content },
        { role: "assistant", content: response }
      );

      // Keep history limited to last 10 messages
      if (history.length > 10) {
        history.splice(0, 2);
      }

      return response;
    } catch (error) {
      console.error("Error processing message with OpenAI:", error);
      return "Sorry, I encountered an error processing your message.";
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if the message is meant for this agent
   */
  private isMessageForThisAgent(message: Message): boolean {
    // TODO: Implement proper message filtering logic
    return true; // For now, respond to all messages
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error("Agent error:", error);
  }
}

// Export a function to create and start the agent
export async function createMarketSentimentAgent(
  apiKey: string,
  openaiApiKey: string,
  apiUrl?: string
): Promise<MarketSentimentAgent> {
  const agent = new MarketSentimentAgent(apiKey, openaiApiKey, apiUrl);
  await agent.start();
  return agent;
}
