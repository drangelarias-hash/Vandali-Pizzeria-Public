export interface ExchangeRateData {
  bcv: number;
  paralelo: number;
  lastUpdated: string;
  source: string;
  fechaValor?: string;
  isWeekendRate?: boolean;
}

// Fallback rate if network is completely unreachable
const DEFAULT_RATE = 842.21;

export async function fetchLiveExchangeRate(force = false): Promise<ExchangeRateData> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday, 1 = Monday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 || (dayOfWeek === 1 && now.getHours() < 13);
  const nowStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  // 1. Primary: Internal Express Proxy with multi-source official BCV sync
  try {
    const url = force ? '/api/exchange-rate?force=true' : '/api/exchange-rate';
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.bcv && typeof data.bcv === 'number' && data.bcv > 50) {
        return {
          bcv: data.bcv,
          paralelo: data.paralelo || data.bcv,
          lastUpdated: data.lastUpdated || nowStr,
          source: data.source || 'BCV Oficial En Vivo',
          fechaValor: data.fechaValor,
          isWeekendRate: data.isWeekendRate ?? isWeekend,
        };
      }
    }
  } catch (err) {
    console.warn('Internal /api/exchange-rate fetch timed out/failed, trying direct external APIs...', err);
  }

  // 2. Direct Fallback: DolarApi Oficial endpoint (ve.dolarapi.com/v1/dolares/oficial)
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const oficial = await response.json();
      const bcvRate = oficial?.promedio || oficial?.valor || 0;
      if (bcvRate > 50) {
        return {
          bcv: bcvRate,
          paralelo: bcvRate,
          lastUpdated: `${nowStr} (DolarApi)`,
          source: 'BCV Oficial (DolarApi)',
          fechaValor: oficial?.fechaActualizacion,
          isWeekendRate: isWeekend,
        };
      }
    }
  } catch (err) {
    console.warn('Backup DolarApi Oficial fetch failed:', err);
  }

  // 3. Fallback: Open Exchange Rates VES endpoint (open.er-api.com) - global 99.99% CDN uptime
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const data = await response.json();
      const vesRate = data?.rates?.VES;
      if (vesRate && vesRate > 50) {
        return {
          bcv: vesRate,
          paralelo: vesRate,
          lastUpdated: `${nowStr} (OpenER)`,
          source: 'BCV Oficial (Open Exchange Rates)',
          fechaValor: data?.time_last_update_utc,
          isWeekendRate: isWeekend,
        };
      }
    }
  } catch (err) {
    console.warn('Backup Open Exchange Rates fetch failed:', err);
  }

  // 4. Fallback: ExchangeRate-API (api.exchangerate-api.com/v4/latest/USD)
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const data = await response.json();
      const vesRate = data?.rates?.VES;
      if (vesRate && vesRate > 50) {
        return {
          bcv: vesRate,
          paralelo: vesRate,
          lastUpdated: `${nowStr} (ExchangeRate-API)`,
          source: 'BCV Oficial (ExchangeRate-API)',
          isWeekendRate: isWeekend,
        };
      }
    }
  } catch (err) {
    console.warn('Backup ExchangeRate-API fetch failed:', err);
  }

  // 5. Default fallback if totally offline
  return {
    bcv: DEFAULT_RATE,
    paralelo: DEFAULT_RATE,
    lastUpdated: nowStr,
    source: 'Tasa oficial de respaldo',
    isWeekendRate: isWeekend,
  };
}
