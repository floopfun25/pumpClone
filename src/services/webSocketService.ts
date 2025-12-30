import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface PriceUpdate {
  tokenId: string;
  price: number;
  marketCap: number;
  volume24h: number;
  timestamp: number;
}

export interface TradeUpdate {
  tokenSymbol: string;
  type: string;
  amount: number;
  price: number;
  timestamp: number;
}

type PriceCallback = (data: PriceUpdate) => void;
type TradeCallback = (data: TradeUpdate) => void;

/**
 * WebSocket Service for real-time price and trade updates
 * Uses STOMP over SockJS to connect to Spring Boot backend
 */
class WebSocketService {
  private client: Client | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private priceSubscriptions = new Map<string, PriceCallback[]>();
  private tradeSubscriptions: TradeCallback[] = [];
  private subscriptionIds = new Map<string, string>();

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      // Determine WebSocket URL based on environment
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = import.meta.env.VITE_API_URL || 'localhost:8080';
      const wsUrl = `${protocol}//${host}/api/ws`;

      console.log('[WebSocket] Connecting to:', wsUrl);

      // Create STOMP client with SockJS
      this.client = new Client({
        webSocketFactory: () => new SockJS(wsUrl) as any,

        connectHeaders: {},

        debug: (str) => {
          if (import.meta.env.DEV) {
            console.log('[WebSocket Debug]', str);
          }
        },

        reconnectDelay: this.reconnectDelay,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        onConnect: () => {
          console.log('[WebSocket] Connected successfully');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 2000; // Reset delay

          // Resubscribe to all previous subscriptions
          this.resubscribeAll();

          resolve();
        },

        onStompError: (frame) => {
          console.error('[WebSocket] STOMP error:', frame.headers['message']);
          console.error('[WebSocket] Error details:', frame.body);
          this.connected = false;
          reject(new Error(frame.headers['message'] || 'STOMP connection error'));
        },

        onWebSocketError: (event) => {
          console.error('[WebSocket] WebSocket error:', event);
          this.connected = false;
        },

        onDisconnect: () => {
          console.log('[WebSocket] Disconnected');
          this.connected = false;
          this.attemptReconnect();
        },
      });

      // Activate the client
      this.client.activate();
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(err => {
          console.error('[WebSocket] Reconnection failed:', err);
        });
      }
    }, delay);
  }

  /**
   * Resubscribe to all topics after reconnection
   */
  private resubscribeAll() {
    if (!this.client || !this.connected) return;

    // Resubscribe to price updates
    this.priceSubscriptions.forEach((callbacks, tokenId) => {
      this.subscribeToPrice(tokenId, callbacks[0]); // Resubscribe with first callback
    });

    // Resubscribe to trades
    if (this.tradeSubscriptions.length > 0) {
      this.subscribeToTrades(this.tradeSubscriptions[0]); // Resubscribe with first callback
    }

    console.log('[WebSocket] Resubscribed to all topics');
  }

  /**
   * Subscribe to price updates for a specific token
   */
  subscribeToPrice(tokenId: string, callback: PriceCallback): () => void {
    // Add callback to list
    if (!this.priceSubscriptions.has(tokenId)) {
      this.priceSubscriptions.set(tokenId, []);
    }
    this.priceSubscriptions.get(tokenId)!.push(callback);

    // Subscribe to topic if connected
    if (this.client && this.connected) {
      const topic = `/topic/price/${tokenId}`;

      // Only subscribe if not already subscribed
      if (!this.subscriptionIds.has(topic)) {
        const subscription = this.client.subscribe(topic, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            const update: PriceUpdate = {
              tokenId: String(data.tokenId),
              price: Number(data.price),
              marketCap: Number(data.marketCap),
              volume24h: Number(data.volume24h || 0),
              timestamp: Number(data.timestamp),
            };

            // Notify all callbacks for this token
            const callbacks = this.priceSubscriptions.get(tokenId);
            if (callbacks) {
              callbacks.forEach(cb => cb(update));
            }
          } catch (error) {
            console.error('[WebSocket] Error parsing price update:', error);
          }
        });

        this.subscriptionIds.set(topic, subscription.id);
        console.log('[WebSocket] Subscribed to price updates for token:', tokenId);
      }
    } else {
      // Connect first, then subscribe
      this.connect().then(() => {
        this.subscribeToPrice(tokenId, () => {}); // Will be handled by resubscribeAll
      }).catch(err => {
        console.error('[WebSocket] Failed to connect for price subscription:', err);
      });
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.priceSubscriptions.get(tokenId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }

        // Unsubscribe from topic if no more callbacks
        if (callbacks.length === 0) {
          this.priceSubscriptions.delete(tokenId);
          const topic = `/topic/price/${tokenId}`;
          const subId = this.subscriptionIds.get(topic);

          if (subId && this.client) {
            this.client.unsubscribe(subId);
            this.subscriptionIds.delete(topic);
            console.log('[WebSocket] Unsubscribed from price updates for token:', tokenId);
          }
        }
      }
    };
  }

  /**
   * Subscribe to all trade updates
   */
  subscribeToTrades(callback: TradeCallback): () => void {
    this.tradeSubscriptions.push(callback);

    if (this.client && this.connected) {
      const topic = '/topic/trades';

      if (!this.subscriptionIds.has(topic)) {
        const subscription = this.client.subscribe(topic, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            const trade: TradeUpdate = {
              tokenSymbol: data.tokenSymbol,
              type: data.type,
              amount: Number(data.amount),
              price: Number(data.price),
              timestamp: Number(data.timestamp),
            };

            this.tradeSubscriptions.forEach(cb => cb(trade));
          } catch (error) {
            console.error('[WebSocket] Error parsing trade update:', error);
          }
        });

        this.subscriptionIds.set(topic, subscription.id);
        console.log('[WebSocket] Subscribed to trade updates');
      }
    } else {
      this.connect().then(() => {
        this.subscribeToTrades(() => {});
      }).catch(err => {
        console.error('[WebSocket] Failed to connect for trade subscription:', err);
      });
    }

    // Return unsubscribe function
    return () => {
      const index = this.tradeSubscriptions.indexOf(callback);
      if (index > -1) {
        this.tradeSubscriptions.splice(index, 1);
      }

      if (this.tradeSubscriptions.length === 0) {
        const topic = '/topic/trades';
        const subId = this.subscriptionIds.get(topic);

        if (subId && this.client) {
          this.client.unsubscribe(subId);
          this.subscriptionIds.delete(topic);
          console.log('[WebSocket] Unsubscribed from trade updates');
        }
      }
    };
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.connected = false;
      this.priceSubscriptions.clear();
      this.tradeSubscriptions = [];
      this.subscriptionIds.clear();
      console.log('[WebSocket] Disconnected and cleaned up');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
