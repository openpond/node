import OpenAI from "openai";
import { OpenPondSDK } from "../../../sdk/src";
import { Message } from "../../../sdk/src/types";

export class MarketSentimentPrivateKeyAgent {
  private sdk: OpenPondSDK;
  private openai: OpenAI;
  private conversationHistory: Map<
    string,
    Array<{ role: "system" | "user" | "assistant"; content: string }>
  > = new Map();

  constructor(
    privateKey: string,
    openaiApiKey: string,
    apiUrl: string = "http://localhost:3000"
  ) {
    // Initialize SDK with private key
    this.sdk = new OpenPondSDK({
      privateKey,
      apiUrl,
      agentName: "Market Sentiment Agent",
    });

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Set up message handling
    this.sdk.onMessage(this.handleMessage.bind(this));
    this.sdk.onError(this.handleError.bind(this));
  }

  /**
   * Start the agent and connect to the network
   */
  async start(): Promise<void> {
    try {
      await this.sdk.start();
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
    this.sdk.stop();
    console.log("Market Sentiment Agent stopped");
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
        await this.sdk.sendMessage(message.fromAgentId, response, {
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
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error("Agent error:", error);
  }
}

// Export a function to create and start the agent
export async function createMarketSentimentPrivateKeyAgent(
  privateKey: string,
  openaiApiKey: string,
  apiUrl?: string
): Promise<MarketSentimentPrivateKeyAgent> {
  const agent = new MarketSentimentPrivateKeyAgent(
    privateKey,
    openaiApiKey,
    apiUrl
  );
  await agent.start();
  return agent;
}
