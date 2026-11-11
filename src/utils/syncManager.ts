import { AdminConfig, PizzaItem, MenuItem, OrderRecord } from '../types';
import {
  saveOrderToFirestore,
  updateOrderInFirestore,
  deleteOrderFromFirestore,
  saveConfigToFirestore,
  saveMenuToFirestore,
} from '../firebase';

export interface RemoteSyncState {
  version: number;
  lastUpdated: number;
  config?: AdminConfig | null;
  pizzas?: PizzaItem[];
  drinks?: MenuItem[];
  salsas?: MenuItem[];
  extras?: MenuItem[];
  orders?: OrderRecord[];
}

type SyncListener = (state: RemoteSyncState, eventType: string) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private eventSource: EventSource | null = null;
  private channel: BroadcastChannel | null = null;
  private currentVersion = 0;
  private pollingInterval: any = null;
  private isConnecting = false;
  private lastState: RemoteSyncState | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.channel = new BroadcastChannel('vandali_realtime_sync');
          this.channel.onmessage = (event) => {
            if (event.data && event.data.payload) {
              this.notifyListeners(event.data.payload, event.data.type || 'channel_sync');
            }
          };
        }
      } catch (err) {
        console.warn('BroadcastChannel not available:', err);
      }

      this.initSSE();
      this.startPolling();
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);

    // If we already have a cached state from server, deliver immediately
    if (this.lastState) {
      try {
        listener(this.lastState, 'initial_cached');
      } catch (e) {
        console.error('Error in initial sync listener:', e);
      }
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(state: RemoteSyncState, eventType: string) {
    if (state.version && state.version >= this.currentVersion) {
      this.currentVersion = state.version;
    }
    this.lastState = { ...this.lastState, ...state };
    this.listeners.forEach((listener) => {
      try {
        listener(state, eventType);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  private broadcastLocal(type: string, payload: any) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, payload });
      } catch {
        // ignore
      }
    }
  }

  private initSSE() {
    if (this.isConnecting || typeof window === 'undefined') return;
    this.isConnecting = true;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/events');

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.payload) {
            this.notifyListeners(parsed.payload, parsed.type || 'sse_event');
          }
        } catch (err) {
          console.warn('Error parsing SSE message:', err);
        }
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.isConnecting = false;
        setTimeout(() => this.initSSE(), 5000);
      };

      this.eventSource.onopen = () => {
        this.isConnecting = false;
      };
    } catch (err) {
      this.isConnecting = false;
      console.warn('Could not initialize SSE:', err);
    }
  }

  private startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    // Poll fallback every 10 seconds for secondary server mirroring
    this.pollingInterval = setInterval(() => {
      this.fetchFullState(false);
    }, 10000);
  }

  public async fetchFullState(forceNotify = false): Promise<RemoteSyncState | null> {
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) return null;
      const data: RemoteSyncState = await res.json();
      this.lastState = data;

      if (forceNotify && data.version && data.version > this.currentVersion) {
        this.currentVersion = data.version;
        this.notifyListeners(data, 'poll_sync');
      }
      return data;
    } catch {
      return null;
    }
  }

  public async triggerGoogleSheetsSync(webhookUrl?: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const res = await fetch('/api/sync/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión' };
    }
  }

  public async initSeedIfEmpty(initialData: {
    config: AdminConfig;
    pizzas: PizzaItem[];
    drinks: MenuItem[];
    salsas: MenuItem[];
    extras: MenuItem[];
    orders: OrderRecord[];
  }) {
    try {
      const res = await fetch('/api/init-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialData),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.store && data.version) {
          this.currentVersion = data.version;
        }
      }
    } catch (err) {
      console.warn('Init seed server sync warning:', err);
    }
  }

  // --- CLIENT -> MASTER: PUSH ORDER ---
  public async createOrder(order: OrderRecord): Promise<boolean> {
    try {
      const currentOrders = this.lastState?.orders || [];
      const updatedOrders = [order, ...currentOrders.filter((o) => o.id !== order.id)];
      this.broadcastLocal('order_created', { order, orders: updatedOrders });

      // 1. Persist directly to durable Cloud Firestore (Master DB)
      const firestoreSaved = await saveOrderToFirestore(order);
      if (!firestoreSaved) {
        console.warn('Direct Firestore saveOrder returned false, retrying...');
        saveOrderToFirestore(order).catch(() => {});
      }

      // 2. Persist to local server / SSE channel for server endpoints (CSV & Google Sheets)
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      }).catch((err) => console.warn('Server mirror order error:', err));

      return true;
    } catch (err) {
      console.error('Error creating order:', err);
      saveOrderToFirestore(order).catch(() => {});
      return true;
    }
  }

  // --- MASTER -> CLIENT: UPDATE ORDER STATUS / EDITS ---
  public async updateOrder(orderId: string, updates: Partial<OrderRecord>): Promise<boolean> {
    try {
      const currentOrders = this.lastState?.orders || [];
      const updatedOrders = currentOrders.map((o) => (o.id === orderId ? { ...o, ...updates } : o));
      this.broadcastLocal('order_updated', {
        orderId,
        updates,
        order: updatedOrders.find((o) => o.id === orderId),
        orders: updatedOrders,
      });

      // 1. Update in Cloud Firestore immediately
      await updateOrderInFirestore(orderId, updates);

      // 2. Update local server mirror
      fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch((err) => console.warn('Server mirror update order error:', err));

      return true;
    } catch (err) {
      console.error('Error updating order:', err);
      updateOrderInFirestore(orderId, updates).catch(() => {});
      return true;
    }
  }

  // --- DELETE ORDER ---
  public async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const currentOrders = this.lastState?.orders || [];
      const updatedOrders = currentOrders.filter((o) => o.id !== orderId);
      this.broadcastLocal('order_deleted', { orderId, orders: updatedOrders });

      // 1. Delete from Cloud Firestore immediately
      await deleteOrderFromFirestore(orderId);

      // 2. Delete from server mirror
      fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      }).catch((err) => console.warn('Server mirror delete order error:', err));

      return true;
    } catch (err) {
      console.error('Error deleting order:', err);
      deleteOrderFromFirestore(orderId).catch(() => {});
      return true;
    }
  }

  // --- MASTER -> CLIENT: UPDATE MENU CATALOG ---
  public async updateMenu(menu: {
    pizzas?: PizzaItem[];
    drinks?: MenuItem[];
    salsas?: MenuItem[];
    extras?: MenuItem[];
  }): Promise<boolean> {
    try {
      this.broadcastLocal('menu_updated', menu);

      // 1. Save to Cloud Firestore
      await saveMenuToFirestore(menu);

      // 2. Mirror to server
      fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menu),
      }).catch((err) => console.warn('Server mirror menu update error:', err));

      return true;
    } catch (err) {
      console.error('Error updating menu:', err);
      saveMenuToFirestore(menu).catch(() => {});
      return false;
    }
  }

  // --- MASTER -> CLIENT: UPDATE CONFIG / EXCHANGE RATE ---
  public async updateConfig(config: AdminConfig, forceAdminOverride = false): Promise<boolean> {
    try {
      const payload = { ...config, forceAdminOverride };
      this.broadcastLocal('config_updated', { config: payload });

      // 1. Save to Cloud Firestore
      await saveConfigToFirestore(payload, forceAdminOverride);

      // 2. Mirror to server
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.warn('Server mirror config update error:', err));

      return true;
    } catch (err) {
      console.error('Error updating config:', err);
      saveConfigToFirestore(config, forceAdminOverride).catch(() => {});
      return false;
    }
  }
}

export const syncManager = new SyncManager();

