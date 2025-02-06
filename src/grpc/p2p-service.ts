import {
  loadPackageDefinition,
  sendUnaryData,
  Server,
  ServerCredentials,
  ServerDuplexStream,
  ServerUnaryCall,
} from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { P2PNetwork } from "../p2p";
import {
  ConnectRequest,
  Message,
  P2PEvent,
  SendResult,
  StopRequest,
  StopResponse,
} from "../proto/p2p-proto";
import { Logger } from "../utils/logger";

export class P2PGrpcService {
  private network: P2PNetwork | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activeHandlers = new Map<string, ((...args: any[]) => void)[]>();
  private activeStream: ServerDuplexStream<ConnectRequest, P2PEvent> | null =
    null;

  private forwardToStream(event: P2PEvent) {
    if (
      this.activeStream &&
      !this.activeStream.destroyed &&
      this.activeStream.writable
    ) {
      try {
        Logger.info("gRPC", "Forwarding event to stream", {
          hasMessage: !!event.message,
          messageId: event.message?.messageId,
          streamState: {
            destroyed: this.activeStream.destroyed,
            writable: this.activeStream.writable,
          },
        });
        this.activeStream.write(event);
      } catch (error) {
        Logger.error("gRPC", "Failed to forward event to stream", { error });
      }
    } else {
      Logger.debug("gRPC", "No active stream to forward event");
    }
  }

  constructor(network?: P2PNetwork) {
    if (network) {
      Logger.info("gRPC", "Using existing P2P network instance");
      this.network = network;

      // Set up event listeners immediately
      Logger.info("gRPC", "Setting up initial event listeners", {
        networkAvailable: true,
        networkEvents: network.eventNames(),
      });

      // Store handlers for later use with gRPC streams
      const handlers = {
        ready: (peerId: string) => {
          Logger.info("gRPC", "Received ready event", { peerId });
          this.forwardToStream(P2PEvent.create({ ready: { peerId } }));
        },
        "peer:connect": (peerId: string) => {
          Logger.info("gRPC", "Received peer:connect event", { peerId });
          this.forwardToStream(P2PEvent.create({ peerConnected: { peerId } }));
        },
        message: (message: any) => {
          Logger.info("gRPC", "Received message event", {
            messageId: message.messageId,
            fromAgentId: message.fromAgentId,
            hasContent: !!message.content,
          });
          this.forwardToStream(
            P2PEvent.create({
              message: {
                messageId: message.messageId,
                from: message.fromAgentId,
                to: message.toAgentId,
                content: Buffer.from(message.content),
                timestamp: message.timestamp || Date.now(),
              },
            })
          );
        },
      };

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        Logger.info("gRPC", `Registering initial handler for ${event}`, {
          event,
          existingListeners: network.listenerCount(event),
        });

        network.on(event, handler);

        if (!this.activeHandlers.has(event)) {
          this.activeHandlers.set(event, []);
        }
        this.activeHandlers.get(event)!.push(handler);

        Logger.info("gRPC", `Handler registered for ${event}`, {
          listenerCount: network.listenerCount(event),
        });
      });
    }
  }

  private setupEventListeners(
    call: ServerDuplexStream<ConnectRequest, P2PEvent>
  ) {
    Logger.info("gRPC", "Setting up event listeners", {
      networkAvailable: !!this.network,
      networkEvents: this.network?.eventNames() || [],
      existingListeners: {
        message: this.network?.listenerCount("message") || 0,
        ready: this.network?.listenerCount("ready") || 0,
        "peer:connect": this.network?.listenerCount("peer:connect") || 0,
      },
    });

    if (!this.network) {
      Logger.error("gRPC", "No P2P network available");
      return;
    }

    const forwardEvent = (
      eventName: string,
      createEvent: (data: any) => any
    ) => {
      const handler = (data: any) => {
        if (!call.destroyed && call.writable) {
          try {
            Logger.info("gRPC", `Creating ${eventName} event`, {
              eventType: eventName,
              data: JSON.stringify(data),
            });
            const event = createEvent(data);
            Logger.info("gRPC", `Writing ${eventName} event to stream`, {
              eventType: eventName,
              hasMessage: !!event.message,
              messageId: event.message?.messageId,
              rawEvent: JSON.stringify(event),
              streamState: {
                destroyed: call.destroyed,
                writable: call.writable,
                readable: call.readable,
              },
            });
            call.write(event);
            Logger.debug("gRPC", `Forwarded ${eventName} event`, { data });
          } catch (error) {
            Logger.error("gRPC", `Failed to forward ${eventName} event`, {
              error,
              eventType: eventName,
              data: JSON.stringify(data),
            });
          }
        }
      };
      return handler;
    };

    const handlers = {
      ready: forwardEvent("ready", (peerId: string) =>
        P2PEvent.create({ ready: { peerId } })
      ),
      "peer:connect": forwardEvent("peer:connect", (peerId: string) =>
        P2PEvent.create({ peerConnected: { peerId } })
      ),
      message: forwardEvent("message", (message: any) => {
        Logger.info("gRPC", "Processing message for forwarding", {
          fromAgentId: message.fromAgentId,
          messageId: message.messageId,
          hasContent: !!message.content,
          contentType: typeof message.content,
          rawMessage: JSON.stringify(message),
        });
        return P2PEvent.create({
          message: {
            messageId: message.messageId,
            from: message.fromAgentId,
            to: message.toAgentId,
            content: Buffer.from(message.content),
            timestamp: message.timestamp || Date.now(),
          },
        });
      }),
    };

    // Remove previous handlers
    for (const [event, handlers] of this.activeHandlers.entries()) {
      Logger.info("gRPC", `Removing existing handlers for ${event}`, {
        handlersCount: handlers.length,
      });
      for (const handler of handlers) {
        this.network.removeListener(event, handler);
      }
    }
    this.activeHandlers.clear();

    // Register new handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      Logger.info("gRPC", `Registering handler for ${event}`, {
        event,
        existingListeners: this.network!.listenerCount(event),
      });
      this.network!.on(event, handler);
      if (!this.activeHandlers.has(event)) {
        this.activeHandlers.set(event, []);
      }
      this.activeHandlers.get(event)!.push(handler);
      Logger.info("gRPC", `Handler registered for ${event}`, {
        event,
        newListenerCount: this.network!.listenerCount(event),
      });
    });

    return handlers;
  }

  Connect(call: ServerDuplexStream<ConnectRequest, P2PEvent>) {
    Logger.info("gRPC", "Connect method called", {
      callDestroyed: call.destroyed,
      callWritable: call.writable,
      networkAvailable: !!this.network,
      networkEvents: this.network?.eventNames() || [],
    });

    // Store the stream for use by handlers
    this.activeStream = call;

    call.on("data", async (request: ConnectRequest) => {
      try {
        Logger.info("gRPC", "Received connect request", {
          request: JSON.stringify(request),
        });

        if (!request) {
          throw new Error("Invalid connect request");
        }

        // Check if network is available
        if (!this.network) {
          throw new Error("P2P network not initialized");
        }

        Logger.info("gRPC", "Setting up event listeners for client", {
          networkEvents: this.network.eventNames(),
          networkListeners: {
            message: this.network.listeners("message").length,
            ready: this.network.listeners("ready").length,
            "peer:connect": this.network.listeners("peer:connect").length,
            error: this.network.listeners("error").length,
          },
          activeHandlers: Array.from(this.activeHandlers.keys()),
        });

        const handlers = this.setupEventListeners(call);

        // Verify handlers are registered
        if (!handlers) {
          throw new Error("Failed to set up event handlers");
        }

        // Verify message handler is registered
        const messageListeners = this.network.listeners("message");
        if (messageListeners.length === 0) {
          throw new Error("Message handler not registered");
        }

        Logger.info("gRPC", "Event handlers registered", {
          networkEvents: this.network.eventNames(),
          networkListeners: {
            message: this.network.listeners("message").length,
            ready: this.network.listeners("ready").length,
            "peer:connect": this.network.listeners("peer:connect").length,
            error: this.network.listeners("error").length,
          },
          activeHandlers: Array.from(this.activeHandlers.keys()),
        });

        // Send ready event
        if (!call.destroyed && call.writable) {
          const readyEvent = P2PEvent.create({
            ready: { peerId: this.network.getLibp2p().peerId.toString() },
          });
          call.write(readyEvent);
          Logger.info("gRPC", "Sent ready event to client");
        }
      } catch (error) {
        Logger.error("gRPC", "Failed to handle Connect request", error);
        if (!call.destroyed && call.writable) {
          call.write(
            P2PEvent.create({
              error: {
                code: "CONNECT_FAILED",
                message: error instanceof Error ? error.message : String(error),
              },
            })
          );
        }
      }
    });
  }

  async SendMessage(
    call: ServerUnaryCall<Message, unknown>,
    callback: sendUnaryData<SendResult>
  ) {
    try {
      if (!this.network) {
        throw new Error("Network not started");
      }

      const { to, content } = call.request;
      const messageId = await this.network.sendMessage(to, content.toString());

      callback(null, { messageId });
    } catch (error) {
      Logger.error("gRPC", "Failed to send message", error);
      callback({
        code: 13, // INTERNAL
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async Stop(
    call: ServerUnaryCall<StopRequest, unknown>,
    callback: sendUnaryData<StopResponse>
  ) {
    try {
      if (this.network) {
        await this.network.stop();
        this.network = null;
      }
      callback(null, {});
    } catch (error) {
      Logger.error("gRPC", "Failed to stop network", error);
      callback({
        code: 13, // INTERNAL
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async ListAgents(
    call: ServerUnaryCall<any, unknown>,
    callback: sendUnaryData<any>
  ) {
    try {
      if (!this.network) {
        throw new Error("Network not started");
      }

      // Get records from the P2P network's DHT
      const dhtRecords = await this.network.getDHTRecords();

      // Transform records into agents array with correct field names
      const agents = Object.entries(dhtRecords).map(([ethAddr, record]) => ({
        agent_id: ethAddr,
        agent_name: record.agentName || `Agent ${ethAddr.slice(0, 6)}`,
        peer_id: record.peerId,
        connected_since: record.timestamp || Date.now(),
      }));

      // Just log the count of agents found
      Logger.info("gRPC", "Listed agents", {
        count: agents.length,
      });

      callback(null, { agents });
    } catch (error) {
      Logger.error("gRPC", "Failed to list agents", { error });
      callback({
        code: 13, // INTERNAL
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function startGrpcServer(
  port: number,
  network?: P2PNetwork
): Promise<Server> {
  const packageDefinition = await protoLoader.load(
    process.env.PROTO_PATH || "./proto/p2p.proto",
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    }
  );

  const proto = loadPackageDefinition(packageDefinition) as any;
  const server = new Server();

  const service = new P2PGrpcService(network);

  server.addService(proto.p2p.P2PNode.service, {
    Connect: service.Connect.bind(service),
    SendMessage: service.SendMessage.bind(service),
    Stop: service.Stop.bind(service),
    ListAgents: service.ListAgents.bind(service),
  });

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          reject(error);
        } else {
          Logger.info("gRPC", "Server started on port", { port });
          server.start();
          resolve();
        }
      }
    );
  });

  return server;
}
