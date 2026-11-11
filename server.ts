import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// File persistence path
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global in-memory state with disk persistence
interface StoreState {
  version: number;
  lastUpdated: number;
  config: any;
  pizzas: any[];
  drinks: any[];
  salsas: any[];
  extras: any[];
  orders: any[];
}

let store: StoreState = {
  version: 1,
  lastUpdated: Date.now(),
  config: null,
  pizzas: [],
  drinks: [],
  salsas: [],
  extras: [],
  orders: [],
};

// Load saved data from disk if available
try {
  if (fs.existsSync(STORE_FILE)) {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    store = { ...store, ...parsed, version: (parsed.version || 1) + 1 };
  }
} catch (err) {
  console.warn('Could not read existing store.json, starting with fresh store:', err);
}

// Helper to persist store to disk
function saveStoreToDisk() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to disk:', err);
  }
}

// SSE Connected Clients Pool
interface SSEClient {
  id: number;
  res: Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastStateUpdate(eventType = 'sync', payload?: any) {
  store.version += 1;
  store.lastUpdated = Date.now();
  saveStoreToDisk();

  const dataString = JSON.stringify({
    type: eventType,
    version: store.version,
    timestamp: store.lastUpdated,
    payload: payload || store,
  });

  const deadClientIds: number[] = [];
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${dataString}\n\n`);
    } catch {
      deadClientIds.push(client.id);
    }
  });

  if (deadClientIds.length > 0) {
    sseClients = sseClients.filter((c) => !deadClientIds.includes(c.id));
  }
}

// ==========================================================
// OFFICIAL BCV EXCHANGE RATE SCRAPER & FALLBACK SYSTEM
// ==========================================================
interface CachedRate {
  bcv: number;
  paralelo: number;
  source: string;
  lastUpdated: string;
  fechaValor?: string;
  isWeekendRate: boolean;
  timestamp: number;
}

let cachedRate: CachedRate | null = null;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes cache

// Helper to scrape direct official rate from Banco Central de Venezuela (bcv.org.ve)
function scrapeBCVDirect(): Promise<{ bcv: number; fechaValor: string }> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(
      'https://www.bcv.org.ve',
      {
        agent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
        },
        timeout: 8000,
      },
      (res) => {
        let html = '';
        res.on('data', (chunk) => (html += chunk));
        res.on('end', () => {
          try {
            const dolarMatch = html.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>([\d,\.]+)<\/strong>/i);
            const fechaMatch = html.match(/Fecha Valor:[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);

            if (dolarMatch && dolarMatch[1]) {
              const cleanStr = dolarMatch[1].trim().replace(/\./g, '').replace(',', '.');
              const rate = parseFloat(cleanStr);
              if (rate > 0) {
                const fechaValor = fechaMatch ? fechaMatch[1].trim().replace(/\s+/g, ' ') : '';
                return resolve({ bcv: rate, fechaValor });
              }
            }
            reject(new Error('No se pudo extraer la tasa USD del HTML de bcv.org.ve'));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout conectando a bcv.org.ve'));
    });
  });
}

// Fallback to DolarApi (ve.dolarapi.com)
async function fetchDolarApi(): Promise<{ bcv: number; paralelo: number; fecha?: string } | null> {
  // Try /oficial endpoint first (fastest, direct BCV rate)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const bcv = data?.promedio || data?.valor || 0;
      if (bcv > 50) {
        return { bcv, paralelo: bcv, fecha: data?.fechaActualizacion };
      }
    }
  } catch {}

  // Try full list
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as any[];
      if (Array.isArray(data)) {
        const oficial = data.find((d) => d.fuente === 'oficial' || d.nombre?.toLowerCase().includes('bcv'));
        const paralelo = data.find((d) => d.fuente === 'paralelo' || d.nombre?.toLowerCase().includes('paralelo'));
        const bcv = oficial?.promedio || oficial?.valor || 0;
        const par = paralelo?.promedio || paralelo?.valor || bcv;
        if (bcv > 50) {
          return { bcv, paralelo: par, fecha: oficial?.fechaActualizacion };
        }
      }
    }
  } catch (err) {
    console.warn('DolarApi fallback error:', err);
  }

  return null;
}

// Fallback to Open Exchange Rates (open.er-api.com)
async function fetchOpenExchangeRates(): Promise<{ bcv: number; fecha?: string } | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const ves = data?.rates?.VES;
      if (ves && ves > 50) {
        return { bcv: ves, fecha: data.time_last_update_utc };
      }
    }
  } catch (err) {
    console.warn('open.er-api fallback error:', err);
  }
  return null;
}

// Fallback to ExchangeRate-API (api.exchangerate-api.com)
async function fetchExchangeRateApi(): Promise<{ bcv: number } | null> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const ves = data?.rates?.VES;
      if (ves && ves > 50) {
        return { bcv: ves };
      }
    }
  } catch (err) {
    console.warn('exchangerate-api fallback error:', err);
  }
  return null;
}

// Master Server-side Rate Getter with Caching and Multi-Source Fallbacks
async function getLatestOfficialExchangeRate(force = false): Promise<CachedRate> {
  const now = Date.now();
  if (!force && cachedRate && now - cachedRate.timestamp < 3 * 60 * 1000) {
    return cachedRate;
  }

  const nowDate = new Date();
  const dayOfWeek = nowDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 || (dayOfWeek === 1 && nowDate.getHours() < 13);
  const nowStr = nowDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  // 1. Primary: DolarApi Venezuela (direct BCV official data)
  try {
    const dApi = await fetchDolarApi();
    if (dApi && dApi.bcv > 50) {
      cachedRate = {
        bcv: dApi.bcv,
        paralelo: dApi.paralelo,
        source: 'BCV Oficial (DolarApi)',
        fechaValor: dApi.fecha,
        lastUpdated: `${nowStr} (DolarApi)`,
        isWeekendRate: isWeekend,
        timestamp: now,
      };
      console.log(`📡 [DolarApi Sync] Tasa oficial obtenida: 1 USD = Bs. ${cachedRate.bcv.toFixed(4)}`);
      return cachedRate;
    }
  } catch (err) {
    console.warn('⚠️ DolarApi fallback failed:', err);
  }

  // 2. Secondary: Open Exchange Rates (High-uptime CDN)
  try {
    const openEr = await fetchOpenExchangeRates();
    if (openEr && openEr.bcv > 50) {
      cachedRate = {
        bcv: openEr.bcv,
        paralelo: openEr.bcv,
        source: 'BCV Oficial (Open Exchange Rates)',
        fechaValor: openEr.fecha,
        lastUpdated: `${nowStr} (OpenER)`,
        isWeekendRate: isWeekend,
        timestamp: now,
      };
      console.log(`🌐 [OpenER Sync] Tasa obtenida: 1 USD = Bs. ${cachedRate.bcv.toFixed(4)}`);
      return cachedRate;
    }
  } catch (err) {
    console.warn('⚠️ Open Exchange Rates fallback failed:', err);
  }

  // 3. Tertiary: ExchangeRate-API
  try {
    const exApi = await fetchExchangeRateApi();
    if (exApi && exApi.bcv > 50) {
      cachedRate = {
        bcv: exApi.bcv,
        paralelo: exApi.bcv,
        source: 'BCV Oficial (ExchangeRate-API)',
        lastUpdated: `${nowStr} (ExchangeRate-API)`,
        isWeekendRate: isWeekend,
        timestamp: now,
      };
      console.log(`🌐 [ExchangeRateApi Sync] Tasa obtenida: 1 USD = Bs. ${cachedRate.bcv.toFixed(4)}`);
      return cachedRate;
    }
  } catch (err) {
    console.warn('⚠️ ExchangeRate-API fallback failed:', err);
  }

  // 4. Quaternary: Direct BCV Scraping (bcv.org.ve)
  try {
    const bcvDirect = await scrapeBCVDirect();
    if (bcvDirect.bcv > 50) {
      cachedRate = {
        bcv: bcvDirect.bcv,
        paralelo: bcvDirect.bcv,
        source: bcvDirect.fechaValor ? `BCV Oficial (${bcvDirect.fechaValor})` : 'Banco Central de Venezuela (Oficial)',
        fechaValor: bcvDirect.fechaValor,
        lastUpdated: `${nowStr} (${isWeekend ? 'Tasa Lunes/BCV' : 'BCV En Vivo'})`,
        isWeekendRate: isWeekend,
        timestamp: now,
      };
      console.log(`🏦 [BCV Sync] Tasa oficial directa obtenida: 1 USD = Bs. ${cachedRate.bcv.toFixed(4)}`);
      return cachedRate;
    }
  } catch (err: any) {
    console.warn('⚠️ Direct BCV scraping failed:', err?.message || err);
  }

  // 5. Retain existing cached rate if valid
  if (cachedRate && cachedRate.bcv > 50) {
    return cachedRate;
  }

  // 6. Default baseline fallback
  return {
    bcv: 842.21,
    paralelo: 842.21,
    source: 'Tasa oficial de respaldo',
    lastUpdated: nowStr,
    isWeekendRate: isWeekend,
    timestamp: now,
  };
}

// Background Task: Synchronize store.config with live BCV rate if in auto mode
async function syncServerExchangeRateWithBCV() {
  try {
    const rateData = await getLatestOfficialExchangeRate();
    if (rateData && rateData.bcv > 0) {
      if (store.config) {
        if (store.config.exchangeRateMode !== 'manual') {
          const oldRate = store.config.exchangeRateBs;
          const diff = Math.abs((oldRate || 0) - rateData.bcv);
          if (diff > 0.001 || !store.config.lastRateUpdate) {
            console.log(`🔄 [Auto-Updater] Actualizando tasa BCV en servidor: Bs. ${oldRate} -> Bs. ${rateData.bcv.toFixed(4)}`);
            store.config.exchangeRateBs = rateData.bcv;
            store.config.lastRateUpdate = rateData.fechaValor
              ? `${rateData.lastUpdated} (${rateData.source})`
              : rateData.lastUpdated;
            store.config.rateSource = 'api_bcv';
            broadcastStateUpdate('config_updated', { config: store.config });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Background exchange rate sync error:', err);
  }
}

// ==========================================================
// API ROUTES
// ==========================================================

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', version: store.version, timestamp: store.lastUpdated });
});

// 2. Full Sync State (Client & Master)
app.get('/api/sync', (req: Request, res: Response) => {
  res.json({
    success: true,
    version: store.version,
    lastUpdated: store.lastUpdated,
    config: store.config,
    pizzas: store.pizzas,
    drinks: store.drinks,
    salsas: store.salsas,
    extras: store.extras,
    orders: store.orders,
  });
});

// 3. SSE Stream for Real-Time Instant Sync Across Devices
app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = nextClientId++;
  sseClients.push({ id: clientId, res });

  // Send immediate initial sync hello
  res.write(
    `data: ${JSON.stringify({
      type: 'connected',
      version: store.version,
      timestamp: store.lastUpdated,
    })}\n\n`
  );

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Helper to forward orders to Google Sheets via Webhook (Google Apps Script)
async function forwardOrderToGoogleSheets(order: any) {
  const webhookUrl = store.config?.googleSheetsWebhookUrl;
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return;
  }

  try {
    const payload = {
      action: 'add_order',
      orderId: order.id,
      date: order.date || new Date().toLocaleString('es-VE'),
      customerName: order.customerName || 'Cliente en Local',
      customerPhone: order.customerPhone || '',
      deliveryType: order.deliveryType,
      tableNumber: order.tableNumber || '',
      address: order.address || order.zone || '',
      paymentMethod: order.paymentMethod,
      itemsSummary: order.itemsSummary,
      subtotalUSD: order.subtotalUSD || order.totalUSD,
      discountUSD: order.discountUSD || 0,
      employeeDiscountUSD: order.employeeDiscountUSD || 0,
      employeeDiscountPercent: order.employeeDiscountPercent || 0,
      deliveryCostUSD: order.deliveryCostUSD || 0,
      tipUSD: order.tipUSD || 0,
      totalUSD: order.totalUSD,
      totalBs: order.totalBs,
      status: order.status,
      origin: order.origin,
      timestamp: order.timestamp || Date.now(),
    };

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn('Async Google Sheets Webhook notification failed:', err);
    });
  } catch (err) {
    console.warn('Error preparing Google Sheets webhook payload:', err);
  }
}

// 4. Create Order (Client -> Master in Real Time)
app.post('/api/orders', (req: Request, res: Response) => {
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: 'Datos de orden inválidos' });
  }

  // Check if order already exists to avoid duplicates
  const existingIdx = store.orders.findIndex((o) => o.id === newOrder.id);
  if (existingIdx >= 0) {
    store.orders[existingIdx] = { ...store.orders[existingIdx], ...newOrder };
  } else {
    store.orders = [newOrder, ...store.orders];
  }

  broadcastStateUpdate('order_created', { order: newOrder, orders: store.orders });

  // Asynchronously dispatch to Google Sheets webhook if configured
  forwardOrderToGoogleSheets(newOrder);

  res.json({ success: true, order: newOrder, version: store.version });
});

// 5. Update Order Status / Edits (Master -> Client in Real Time)
app.patch('/api/orders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: 'Orden no encontrada' });
  }

  store.orders[idx] = { ...store.orders[idx], ...updates };
  broadcastStateUpdate('order_updated', { order: store.orders[idx], orders: store.orders });

  // Update in Google Sheets if configured
  forwardOrderToGoogleSheets(store.orders[idx]);

  res.json({ success: true, order: store.orders[idx], version: store.version });
});

// 6. Delete Order
app.delete('/api/orders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  store.orders = store.orders.filter((o) => o.id !== id);
  broadcastStateUpdate('order_deleted', { orderId: id, orders: store.orders });
  res.json({ success: true, version: store.version });
});

// 6b. Export Orders as CSV (Excel & Google Sheets Compatible)
app.get('/api/export/csv', (req: Request, res: Response) => {
  const orders = store.orders || [];

  const headers = [
    'ID Orden',
    'Fecha',
    'Hora',
    'Origen',
    'Mesa/Ubicación',
    'Cliente',
    'Teléfono',
    'Tipo Entrega',
    'Dirección/Zona',
    'Método Pago',
    'Resumen Ítems',
    'Subtotal ($)',
    'Descuento Club ($)',
    'Descuento Empleado ($)',
    'Delivery ($)',
    'Propina ($)',
    'Total ($)',
    'Total (Bs)',
    'Estatus',
  ];

  const rows = orders.map((o) => {
    let d: Date | null = null;
    if (o.timestamp && !isNaN(Number(o.timestamp))) {
      d = new Date(Number(o.timestamp));
    }
    const fecha = d && !isNaN(d.getTime())
      ? d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : (o.date && (o.date.includes('/') || o.date.includes('-')) ? o.date : new Date().toLocaleDateString('es-VE'));
    
    const hora = d && !isNaN(d.getTime())
      ? d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      : (o.date || '');

    return [
      `#${o.id}`,
      fecha,
      hora,
      o.origin === 'local_pos' ? 'POS Local' : 'Web Online',
      o.tableNumber || '',
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
      o.deliveryType || '',
      `"${(o.address || o.zone || '').replace(/"/g, '""')}"`,
      o.paymentMethod || '',
      `"${(o.itemsSummary || '').replace(/"/g, '""')}"`,
      (o.subtotalUSD || o.totalUSD || 0).toFixed(2),
      (o.discountUSD || 0).toFixed(2),
      (o.employeeDiscountUSD || 0).toFixed(2),
      (o.deliveryCostUSD || 0).toFixed(2),
      (Number(o.tipUSD) || 0).toFixed(2),
      (o.totalUSD || 0).toFixed(2),
      (o.totalBs || 0).toFixed(2),
      o.status || '',
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vandali_ordenes_${Date.now()}.csv"`);
  res.status(200).send(csvContent);
});

// 6c. Batch Push all Orders to Google Sheets Webhook
app.post('/api/sync/google-sheets', async (req: Request, res: Response) => {
  const webhookUrl = store.config?.googleSheetsWebhookUrl || req.body.webhookUrl;
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return res.status(400).json({ error: 'URL de webhook de Google Sheets no configurada o inválida' });
  }

  try {
    const payload = {
      action: 'bulk_sync',
      restaurant: 'Vandali Pizzería Artesanal',
      totalOrders: store.orders.length,
      orders: store.orders,
      exportedAt: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      res.json({ success: true, count: store.orders.length });
    } else {
      res.status(502).json({ error: `Google Sheets respondió con status ${response.status}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al conectar con webhook de Google Sheets' });
  }
});

// 6d. Live Official Exchange Rate Endpoint (Direct BCV scraping + fallbacks)
app.get('/api/exchange-rate', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const rateData = await getLatestOfficialExchangeRate(force);

    // If store config is in auto mode and rate changed, keep server store updated
    if (store.config && store.config.exchangeRateMode !== 'manual' && rateData.bcv > 0) {
      const diff = Math.abs((store.config.exchangeRateBs || 0) - rateData.bcv);
      if (diff > 0.001 || !store.config.lastRateUpdate) {
        store.config.exchangeRateBs = rateData.bcv;
        store.config.lastRateUpdate = rateData.fechaValor
          ? `${rateData.lastUpdated} (${rateData.source})`
          : rateData.lastUpdated;
        store.config.rateSource = 'api_bcv';
        broadcastStateUpdate('config_updated', { config: store.config });
      }
    }

    res.json({ success: true, ...rateData });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al consultar tasa oficial' });
  }
});

// 7. Update Menu Catalog (Master -> Client in Real Time)
app.post('/api/menu', (req: Request, res: Response) => {
  const { pizzas, drinks, salsas, extras } = req.body;

  if (Array.isArray(pizzas)) store.pizzas = pizzas;
  if (Array.isArray(drinks)) store.drinks = drinks;
  if (Array.isArray(salsas)) store.salsas = salsas;
  if (Array.isArray(extras)) store.extras = extras;

  broadcastStateUpdate('menu_updated', {
    pizzas: store.pizzas,
    drinks: store.drinks,
    salsas: store.salsas,
    extras: store.extras,
  });

  res.json({ success: true, version: store.version });
});

// 8. Update Admin Config (Master -> Client in Real Time)
app.post('/api/config', (req: Request, res: Response) => {
  const newConfig = req.body;
  if (newConfig) {
    // Protect manual rate mode: if server is in manual mode and an incoming request lacks explicit admin override, preserve manual mode
    if (store.config?.exchangeRateMode === 'manual' && newConfig.exchangeRateMode === 'auto' && !newConfig.forceAdminOverride) {
      console.log('🛡️ Server config is locked in manual exchange rate mode. Preserving manual rate.');
      newConfig.exchangeRateMode = 'manual';
      newConfig.exchangeRateBs = store.config.exchangeRateBs;
      newConfig.rateSource = 'manual';
      newConfig.lastRateUpdate = store.config.lastRateUpdate || 'Fijada manualmente por el administrador';
    }

    store.config = { ...store.config, ...newConfig };
    broadcastStateUpdate('config_updated', { config: store.config });
    res.json({ success: true, config: store.config, version: store.version });
  } else {
    res.status(400).json({ error: 'Configuración inválida' });
  }
});

// 9. Bulk Initial Seed / Sync Setup
app.post('/api/init-seed', (req: Request, res: Response) => {
  const { config, pizzas, drinks, salsas, extras, orders } = req.body;
  let changed = false;

  if (!store.config && config) {
    store.config = config;
    changed = true;
  }
  if ((!store.pizzas || store.pizzas.length === 0) && Array.isArray(pizzas)) {
    store.pizzas = pizzas;
    changed = true;
  }
  if ((!store.drinks || store.drinks.length === 0) && Array.isArray(drinks)) {
    store.drinks = drinks;
    changed = true;
  }
  if ((!store.salsas || store.salsas.length === 0) && Array.isArray(salsas)) {
    store.salsas = salsas;
    changed = true;
  }
  if ((!store.extras || store.extras.length === 0) && Array.isArray(extras)) {
    store.extras = extras;
    changed = true;
  }
  if ((!store.orders || store.orders.length === 0) && Array.isArray(orders) && orders.length > 0) {
    store.orders = orders;
    changed = true;
  }

  if (changed) {
    broadcastStateUpdate('init_seed');
  }

  res.json({ success: true, store, version: store.version });
});

// ==========================================================
// VITE & STATIC SERVER
// ==========================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vandali Pizza Server running on http://0.0.0.0:${PORT}`);

    // Initial background BCV sync and periodic 10-minute check
    setTimeout(() => {
      syncServerExchangeRateWithBCV().catch((e) => console.warn('Initial BCV sync error:', e));
    }, 1500);

    setInterval(() => {
      syncServerExchangeRateWithBCV().catch((e) => console.warn('Scheduled BCV sync error:', e));
    }, 10 * 60 * 1000);
  });
}

startServer();
