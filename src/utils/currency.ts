import { CartItem, AdminConfig, DeliveryType, PaymentMethod, getPizzaSizeLabel } from '../types';

export function formatUSD(amount: number): string {
  const num = Number(amount);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

export const SAFE_DEFAULT_EXCHANGE_RATE = 896.12;

export function formatBs(amountUSD: number, exchangeRate: number): string {
  const num = Number(amountUSD);
  const parsedRate = Number(exchangeRate);
  // Protect against 0, undefined, or obsolete rates < 100 Bs/USD
  const rate = parsedRate && parsedRate > 100 ? parsedRate : SAFE_DEFAULT_EXCHANGE_RATE;
  if (isNaN(num)) return 'Bs. 0,00';
  const bs = num * rate;
  return `Bs. ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function calculateCartItemPrice(item: CartItem): number {
  if (!item) return 0;
  let total = Number(item.unitPrice) || 0;
  if (item.extras && Array.isArray(item.extras) && item.extras.length > 0) {
    for (const extra of item.extras) {
      if (extra && typeof extra.price === 'number') {
        total += extra.price;
      }
    }
  }
  const qty = Number(item.quantity) || 1;
  return total * qty;
}

export function calculateDeliveryCost(subtotalUSD: number, deliveryType: DeliveryType, config?: AdminConfig): number {
  if (deliveryType !== 'delivery') return 0;
  const threshold = config?.freeDeliveryThresholdUSD ?? 10.0;
  const standardPrice = config?.standardDeliveryPriceUSD ?? 1.5;
  if ((Number(subtotalUSD) || 0) > threshold) {
    return 0; // FREE DELIVERY for orders > $10
  }
  return standardPrice; // $1.50 for smaller orders (<= $10)
}

/**
 * Removes any emojis or special decorative unicode symbols to ensure clean plain text.
 */
export function stripEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '');// Flags
}

/**
 * Gets exact current date and time in Venezuela (America/Caracas, UTC-4).
 */
export function getVenezuelaTime(): {
  hour: number;
  minute: number;
  totalMinutes: number;
  formatted: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isWeekend: boolean;
} {
  try {
    const now = new Date();
    // Use Intl with explicit h23 hourCycle
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    });

    const parts = dtf.formatToParts(now);
    let hour = -1;
    let minute = -1;
    let weekdayStr = '';

    for (const part of parts) {
      if (part.type === 'hour') {
        hour = parseInt(part.value, 10);
      } else if (part.type === 'minute') {
        minute = parseInt(part.value, 10);
      } else if (part.type === 'weekday') {
        weekdayStr = part.value.toLowerCase();
      }
    }

    if (hour === -1 || isNaN(hour) || minute === -1 || isNaN(minute)) {
      // Fallback calculation: Caracas is strictly UTC-4 all year round (no DST)
      const utcHours = now.getUTCHours();
      hour = (utcHours - 4 + 24) % 24;
      minute = now.getUTCMinutes();
    }

    let dayOfWeek = now.getDay();
    if (weekdayStr.startsWith('sun')) dayOfWeek = 0;
    else if (weekdayStr.startsWith('mon')) dayOfWeek = 1;
    else if (weekdayStr.startsWith('tue')) dayOfWeek = 2;
    else if (weekdayStr.startsWith('wed')) dayOfWeek = 3;
    else if (weekdayStr.startsWith('thu')) dayOfWeek = 4;
    else if (weekdayStr.startsWith('fri')) dayOfWeek = 5;
    else if (weekdayStr.startsWith('sat')) dayOfWeek = 6;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    const totalMinutes = hour * 60 + minute;
    const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return { hour, minute, totalMinutes, formatted, dayOfWeek, isWeekend };
  } catch {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const hour = (utcHours - 4 + 24) % 24;
    const minute = now.getUTCMinutes();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const totalMinutes = hour * 60 + minute;
    const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    return { hour, minute, totalMinutes, formatted, dayOfWeek, isWeekend };
  }
}

/**
 * Checks if current Venezuela time is within store working hours:
 * - Lunes a Viernes: 4:00 PM a 11:00 PM (16:00 a 23:00)
 * - Sábados y Domingos: 12:00 PM a 11:00 PM (12:00 a 23:00)
 */
export function isWithinStoreHours(config?: AdminConfig): {
  isOpen: boolean;
  currentHourVE: number;
  isWeekend: boolean;
  message?: string;
  scheduleDescription: string;
} {
  const scheduleDescription =
    'Lunes a Viernes de 4:00 PM a 11:00 PM (Martes cerrados) y Sábados y Domingos de 12:00 PM a 11:00 PM';
  try {
    const veTime = getVenezuelaTime();
    const currentHourVE = veTime.hour;
    const isWeekend = veTime.isWeekend;
    const isTuesday = veTime.dayOfWeek === 2;

    if (isTuesday) {
      return {
        isOpen: false,
        currentHourVE,
        isWeekend,
        scheduleDescription,
        message:
          'Los días martes permanecemos cerrados por descanso del equipo. Tu orden quedará registrada y se procesará el miércoles al abrir a las 4:00 PM.',
      };
    }

    // Weekend (Sat-Sun): 12:00 PM (12) to 11:00 PM (23)
    // Weekday (Mon, Wed-Fri): 4:00 PM (16) to 11:00 PM (23)
    const openingHour = isWeekend ? 12 : 16;
    const closingHour = 23; // 11:00 PM

    const isOpen = currentHourVE >= openingHour && currentHourVE < closingHour;
    return {
      isOpen,
      currentHourVE,
      isWeekend,
      scheduleDescription,
      message: isOpen
        ? undefined
        : `Estás realizando tu pedido fuera de nuestro horario de atención (${scheduleDescription}). Tu pedido quedará registrado y se procesará a la brevedad una vez iniciada la jornada.`,
    };
  } catch {
    return {
      isOpen: true,
      currentHourVE: 16,
      isWeekend: false,
      scheduleDescription,
    };
  }
}

export function generateWhatsAppOrderMessage(
  items: CartItem[],
  config: AdminConfig,
  deliveryType: DeliveryType,
  customerName: string,
  customerPhone: string,
  deliveryAddress?: string,
  deliveryReference?: string,
  paymentMethod?: PaymentMethod,
  paymentRef?: string,
  cashBillsNotes?: string,
  _generalNotes?: string,
  discountPercent: number = 0,
  _customerEmail?: string,
  tipUSD: number = 0
): string {
  let subtotalUSD = 0;
  items.forEach((it) => {
    subtotalUSD += calculateCartItemPrice(it);
  });

  const discountAmountUSD = discountPercent > 0 ? (subtotalUSD * discountPercent) / 100 : 0;
  const deliveryCostUSD = calculateDeliveryCost(subtotalUSD - discountAmountUSD, deliveryType, config);

  const totalUSD = Math.max(0, subtotalUSD - discountAmountUSD + deliveryCostUSD + (tipUSD || 0));

  const paymentLabels: Record<PaymentMethod, string> = {
    pagomovil: 'Pago Móvil',
    zelle: 'Zelle (USD)',
    efectivo_usd: 'Efectivo $',
    binance: 'Binance Pay',
  };

  const scheduleInfo = isWithinStoreHours(config);

  const lines: string[] = [];
  lines.push(`*🍕 NUEVO PEDIDO - VANDALI PIZZERIA*`);
  lines.push(``);
  lines.push(`*CLIENTE:*`);
  lines.push(`• Nombre: ${stripEmojis(customerName.trim())}`);
  lines.push(`• Teléfono: ${stripEmojis(customerPhone.trim())}`);
  
  if (deliveryType === 'delivery') {
    lines.push(`• Modalidad: Delivery a Domicilio`);
    const addr = stripEmojis(deliveryAddress?.trim() || 'No especificada');
    const ref = deliveryReference && deliveryReference.trim() ? ` (Ref: ${stripEmojis(deliveryReference.trim())})` : '';
    lines.push(`• Dirección: ${addr}${ref}`);
  } else {
    lines.push(`• Modalidad: Retiro en Local (Pick-Up)`);
  }

  if (!scheduleInfo.isOpen) {
    lines.push(``);
    lines.push(`⚠️ _Nota: Pedido fuera de horario habitual._`);
  }

  lines.push(``);
  lines.push(`*DETALLE DE LA COMANDA:*`);

  items.forEach((it, idx) => {
    const sizeFormatted = it.size ? ` (${getPizzaSizeLabel(it.size)})` : '';
    if (it.type === 'half-half') {
      lines.push(
        `${idx + 1}. PIZZA MITAD Y MITAD${sizeFormatted} x${it.quantity}`
      );
      lines.push(`   • Mitad 1: ${stripEmojis(it.half1?.name || '')}`);
      lines.push(`   • Mitad 2: ${stripEmojis(it.half2?.name || '')}`);
    } else if (it.type === 'pizza') {
      lines.push(
        `${idx + 1}. ${stripEmojis(it.name.toUpperCase())}${sizeFormatted} x${it.quantity}`
      );
    } else {
      lines.push(`${idx + 1}. ${stripEmojis(it.name)} x${it.quantity}`);
    }

    if (it.crustSauce && it.crustSauce.trim()) {
      lines.push(`   • Salsa bordes: ${stripEmojis(it.crustSauce)} (Gratis)`);
    }

    if (it.extras && it.extras.length > 0) {
      it.extras.forEach((ext) => {
        lines.push(`   • Extra: ${stripEmojis(ext.name)} (+$${ext.price.toFixed(2)})`);
      });
    }
    if (it.removedIngredients && it.removedIngredients.length > 0) {
      lines.push(`   • Sin: ${stripEmojis(it.removedIngredients.join(', '))}`);
    }
  });

  lines.push(``);
  lines.push(`*RESUMEN:*`);
  lines.push(`• Subtotal: ${formatUSD(subtotalUSD)} (${formatBs(subtotalUSD, config.exchangeRateBs)})`);
  
  if (discountAmountUSD > 0) {
    lines.push(`• Descuento Fidelidad (${discountPercent}%): -${formatUSD(discountAmountUSD)}`);
  }

  if (deliveryType === 'delivery') {
    lines.push(`• Delivery: ${deliveryCostUSD === 0 ? 'GRATIS' : `${formatUSD(deliveryCostUSD)} (${formatBs(deliveryCostUSD, config.exchangeRateBs)})`}`);
  }

  if (tipUSD > 0) {
    lines.push(`• Propina para el equipo: +${formatUSD(tipUSD)} (${formatBs(tipUSD, config.exchangeRateBs)})`);
  }

  lines.push(`• Tasa BCV: 1 USD = Bs. ${config.exchangeRateBs.toFixed(2)}`);
  lines.push(`*• TOTAL: ${formatUSD(totalUSD)} | ${formatBs(totalUSD, config.exchangeRateBs)}*`);
  
  lines.push(``);
  const paymentText = paymentMethod ? paymentLabels[paymentMethod] : 'A convenir';
  const cashDetail = paymentMethod === 'efectivo_usd' && cashBillsNotes ? ` (${stripEmojis(cashBillsNotes.trim())})` : '';
  lines.push(`*Forma de Pago:* ${paymentText}${cashDetail}`);

  return encodeURIComponent(lines.join('\n'));
}
