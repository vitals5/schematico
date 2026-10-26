// src/ai/bridge/bridgeClient.ts
// Local WebSocket MCP Bridge Client for Schematico Browser App

import { McpToolRegistry, defaultToolRegistry, CanvasStateManager } from '../mcp-tools';

export type BridgeConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface BridgeClientOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  toolRegistry?: McpToolRegistry;
}

export type StatusListener = (status: BridgeConnectionStatus, detail?: string) => void;

export class SchematicoBridgeClient {
  private url: string;
  private ws: WebSocket | null = null;
  private status: BridgeConnectionStatus = 'disconnected';
  private reconnectInterval: number;
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private shouldReconnect: boolean = true;
  private toolRegistry: McpToolRegistry;
  private stateManager: CanvasStateManager | null = null;
  private listeners = new Set<StatusListener>();

  constructor(options: BridgeClientOptions = {}) {
    this.url = options.url || 'ws://localhost:3333';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;

    if (options.autoConnect !== false) {
      this.connect(false);
    }
  }

  public setStateManager(manager: CanvasStateManager): void {
    this.stateManager = manager;
  }

  public getStatus(): BridgeConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(newStatus: BridgeConnectionStatus, detail?: string): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      for (const listener of this.listeners) {
        try {
          listener(newStatus, detail);
        } catch (e) {
          console.error('[BridgeClient] Error in status listener:', e);
        }
      }
    }
  }

  public connect(isUserInitiated: boolean = false): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    if (typeof WebSocket === 'undefined') {
      this.setStatus('error', 'WebSockets not supported in this environment');
      return;
    }

    // Only broadcast 'connecting' status if user explicitly clicked or requested it
    if (isUserInitiated && this.status !== 'connected') {
      this.setStatus('connecting');
    }
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Send hello handshake with registered tools
        this.send({
          jsonrpc: '2.0',
          method: 'schematico/hello',
          params: {
            app: 'Schematico',
            version: '1.2.47',
            tools: this.toolRegistry.getToolDefinitions().map(t => t.name)
          }
        });
      };

      this.ws.onmessage = async (event) => {
        await this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (this.status !== 'disconnected') {
          this.setStatus('disconnected');
        }
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Quietly fail; onclose handles reconnection
      };
    } catch {
      if (this.status !== 'disconnected') {
        this.setStatus('disconnected');
      }
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff: 5s, 8s, 12s, 18s, 27s up to 60s max
    const delay = Math.min(5000 * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 6)), 60000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect(false); // Quiet background reconnect, avoids UI flickering
      }
    }, delay);
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private async handleMessage(rawData: string): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(rawData);
    } catch {
      return;
    }

    if (!msg || typeof msg !== 'object') return;

    const { id, method, params } = msg;

    // Handle Ping
    if (method === 'ping') {
      this.send({ jsonrpc: '2.0', id, result: 'pong' });
      return;
    }

    // Handle tools/list
    if (method === 'tools/list') {
      const tools = this.toolRegistry.getToolDefinitions();
      this.send({
        jsonrpc: '2.0',
        id,
        result: { tools }
      });
      return;
    }

    // Handle tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      if (!this.stateManager) {
        this.send({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: 'Canvas state manager not initialized in Schematico browser tab.'
          }
        });
        return;
      }

      try {
        const result = await this.toolRegistry.executeTool(toolName, toolArgs, this.stateManager);
        this.send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ],
            isError: result?.success === false
          }
        });
      } catch (err: any) {
        this.send({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: err?.message || String(err)
          }
        });
      }
    }
  }
}

/** Global default bridge client instance */
export const defaultBridgeClient = new SchematicoBridgeClient({ autoConnect: true });
