import { OrderRecord, AdminConfig, CartItem, getPizzaSizeLabel } from '../types';
import { formatUSD, formatBs, SAFE_DEFAULT_EXCHANGE_RATE } from './currency';

export type TicketType = 'comanda' | 'precuenta';

export function getReceiptExchangeRate(config?: AdminConfig): number {
  const r = Number(config?.exchangeRateBs);
  return r && r > 100 ? r : SAFE_DEFAULT_EXCHANGE_RATE;
}

/**
 * XSS Sanitizer for thermal receipt strings
 */
export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats order items into structured line items for receipts.
 */
export function formatOrderItemsForReceipt(
  order: OrderRecord,
  isComanda: boolean = false
): { name: string; qty: number; price?: string; notes?: string; isTip?: boolean }[] {
  let list: { name: string; qty: number; price?: string; notes?: string; isTip?: boolean }[] = [];

  if (order.rawItems && order.rawItems.length > 0) {
    list = order.rawItems.map((it) => {
      let desc = it.name;
      if (it.type === 'half-half') {
        desc = `1/2 ${it.half1?.name || ''} + 1/2 ${it.half2?.name || ''}`;
      }
      if (it.size) {
        desc += ` (${getPizzaSizeLabel(it.size)})`;
      }
      const extrasDesc: string[] = [];
      if (it.crustSauce && it.crustSauce.trim()) {
        const isInd = it.size === 'individual';
        extrasDesc.push(`Salsa bordes: ${it.crustSauce} ${isInd ? '(+$1.50)' : '(Gratis)'}`);
      }
      if (it.extras && it.extras.length > 0) {
        it.extras.forEach((e) => extrasDesc.push(`+ ${e.name}`));
      }
      if (it.removedIngredients && it.removedIngredients.length > 0) {
        it.removedIngredients.forEach((r) => extrasDesc.push(`Sin ${r}`));
      }
      if (it.notes) {
        extrasDesc.push(`Nota: ${it.notes}`);
      }

      return {
        name: desc,
        qty: it.quantity,
        price: formatUSD(it.unitPrice * it.quantity),
        notes: extrasDesc.length > 0 ? extrasDesc.join(' | ') : undefined,
      };
    });
  } else if (order.itemsSummary) {
    const parts = order.itemsSummary.split(' | ');
    list = parts.map((p) => {
      const match = p.match(/^(\d+)x\s+(.+)$/);
      if (match) {
        return {
          qty: parseInt(match[1], 10),
          name: match[2],
        };
      }
      return { qty: 1, name: p };
    });
  } else {
    list = [{ qty: 1, name: 'Pedido Vandali' }];
  }

  // Include tip as a prominent sub-item on the exit ticket / pre-cuenta if customer tipped
  const tipAmount = Number(order.tipUSD) || 0;
  if (!isComanda && tipAmount > 0) {
    const alreadyHasTip = list.some((it) => it.name.toLowerCase().includes('propina'));
    if (!alreadyHasTip) {
      list.push({
        name: 'Propina voluntaria (Servicio)',
        qty: 1,
        price: `+${formatUSD(tipAmount)}`,
        notes: 'Aporte voluntario para el equipo de atención',
        isTip: true,
      });
    }
  }

  return list;
}

/**
 * Builds HTML template for 58mm / 80mm thermal receipt printing.
 */
export function generateReceiptHTML(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): string {
  const isComanda = type === 'comanda';
  const items = formatOrderItemsForReceipt(order, isComanda);
  const now = new Date(order.timestamp || Date.now());
  const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = order.date || now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const rawLocation = order.origin === 'local_pos' 
    ? (order.tableNumber || 'Salón / Mesa') 
    : order.deliveryType === 'delivery' 
    ? `Delivery: ${order.zone || order.address || 'Domicilio'}` 
    : 'Pick-up en Local';

  const safeOrderId = escapeHtml(order.id);
  const safeLocation = escapeHtml(rawLocation);
  const safeCustomerName = escapeHtml(order.customerName);
  const safeCustomerPhone = escapeHtml(order.customerPhone);
  const safeStoreLocation = escapeHtml(config.location || 'Av. 2 Lora, entre calles 27 y 28, Mérida, Venezuela');
  const safePhoneFormatted = escapeHtml(config.phoneFormatted || '0424-8954741');
  const safeInstagram = escapeHtml(config.instagram || 'vandali.pizzeria');

  const hasSplit = !isComanda && splitPersons && splitPersons > 1;
  const eachUSD = hasSplit ? (order.totalUSD || 0) / splitPersons : 0;
  const rate = getReceiptExchangeRate(config);
  const eachBs = hasSplit ? eachUSD * rate : 0;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${isComanda ? 'COMANDA DE COCINA' : 'CUENTA - TICKET DE SALIDA'} - ${safeOrderId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

    @page {
      margin: 0;
      size: 80mm auto;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-feature-settings: "tnum" 1, "lnum" 1;
      font-variant-numeric: tabular-nums lining-nums;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-size: 24px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      padding: 8px 12px;
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .title {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 2px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .subtitle {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: #111;
      text-transform: uppercase;
    }
    .store-info {
      font-size: 19px;
      font-weight: 600;
      line-height: 1.35;
      color: #222;
    }
    .badge {
      display: inline-block;
      border: 3px solid #000;
      padding: 6px 14px;
      font-weight: 900;
      font-size: 22px;
      margin: 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .divider {
      border-top: 2px dashed #000;
      margin: 8px 0;
    }
    .double-divider {
      border-top: 3px solid #000;
      margin: 10px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 2px 8px;
      margin-bottom: 4px;
      font-size: 22px;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 22px;
    }
    th {
      border-bottom: 2px dashed #000;
      padding: 6px 0;
      font-weight: 900;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 6px 0;
      vertical-align: top;
      word-break: break-word;
    }
    .item-qty {
      font-weight: 900;
      font-size: 24px;
      white-space: nowrap;
      padding-right: 6px;
    }
    .item-name {
      font-weight: 800;
      font-size: 22px;
      line-height: 1.25;
      word-break: break-word;
    }
    .item-price {
      font-weight: 900;
      font-size: 22px;
      white-space: nowrap;
      padding-left: 6px;
    }
    .item-notes {
      font-size: 19px;
      font-style: italic;
      padding-left: 14px;
      color: #222;
      line-height: 1.25;
      margin-top: 3px;
      word-break: break-word;
    }
    .totals-table {
      width: 100%;
      margin-top: 6px;
    }
    .totals-table td {
      padding: 4px 0;
      font-size: 22px;
      word-break: break-word;
    }
    .grand-total {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .bs-total {
      font-size: 25px;
      font-weight: 900;
    }
    .split-box {
      border: 2.5px solid #000;
      padding: 10px 12px;
      margin: 10px 0;
      background: #fbfbfb;
    }
    .footer {
      margin-top: 14px;
      font-size: 21px;
      text-align: center;
      line-height: 1.35;
      color: #111;
    }
    @media print {
      @page {
        margin: 0;
        size: 80mm auto;
      }
      *, *:before, *:after {
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }
      body {
        width: 100%;
        padding: 6px 8px;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="title">VANDALI</div>
    <div class="subtitle">PIZZERÍA ARTESANAL</div>
    <div class="store-info">
      ${safeStoreLocation}<br/>
      Tel: ${safePhoneFormatted} • IG: @${safeInstagram}
    </div>
    
    <div class="badge">
      ${isComanda ? '*** COMANDA DE COCINA ***' : '*** CUENTA / TICKET DE SALIDA ***'}
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-row">
    <span class="bold">ORDEN:</span>
    <span class="bold">#${safeOrderId}</span>
  </div>
  <div class="info-row">
    <span>FECHA:</span>
    <span>${escapeHtml(dateStr)}</span>
  </div>
  <div class="info-row">
    <span>HORA:</span>
    <span>${escapeHtml(timeStr)}</span>
  </div>
  <div class="info-row">
    <span class="bold">UBICACIÓN:</span>
    <span class="bold">${safeLocation}</span>
  </div>
  ${order.customerName ? `
  <div class="info-row">
    <span>CLIENTE:</span>
    <span class="bold">${safeCustomerName}</span>
  </div>
  ` : ''}
  ${order.customerPhone ? `
  <div class="info-row">
    <span>TELÉFONO:</span>
    <span>${safeCustomerPhone}</span>
  </div>
  ` : ''}

  <div class="double-divider"></div>

  <table>
    <thead>
      <tr>
        <th class="text-left" style="width: 15%;">CANT</th>
        <th class="text-left" style="width: ${isComanda ? '85%' : '55%'};">PRODUCTO</th>
        ${!isComanda ? '<th class="text-right" style="width: 30%;">TOTAL</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${items.map((it) => `
        <tr>
          <td class="bold text-left item-qty">${Number(it.qty) || 1}x</td>
          <td class="text-left">
            <span class="bold item-name">${escapeHtml(it.name)}</span>
            ${it.notes ? `<div class="item-notes">${escapeHtml(it.notes)}</div>` : ''}
          </td>
          ${!isComanda ? `<td class="text-right bold item-price">${escapeHtml(it.price) || '-'}</td>` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  ${!isComanda ? `
    <table class="totals-table">
      <tr>
        <td>SUBTOTAL:</td>
        <td class="text-right bold">${formatUSD(order.subtotalUSD || order.totalUSD)}</td>
      </tr>
      ${order.discountUSD > 0 ? `
      <tr>
        <td>DESCUENTO (-30%):</td>
        <td class="text-right bold">-${formatUSD(order.discountUSD)}</td>
      </tr>
      ` : ''}
      ${(order.employeeDiscountUSD && order.employeeDiscountUSD > 0) ? `
      <tr>
        <td>DESC. EMPLEADO (-${order.employeeDiscountPercent || 20}%):</td>
        <td class="text-right bold">-${formatUSD(order.employeeDiscountUSD)}</td>
      </tr>
      ` : ''}
      ${order.deliveryCostUSD > 0 ? `
      <tr>
        <td>DELIVERY:</td>
        <td class="text-right bold">${formatUSD(order.deliveryCostUSD)}</td>
      </tr>
      ` : ''}
      ${(order.tipUSD && Number(order.tipUSD) > 0) ? `
      <tr>
        <td class="bold">PROPINA VOLUNTARIA:</td>
        <td class="text-right bold">+${formatUSD(Number(order.tipUSD))}</td>
      </tr>
      ` : ''}
      <tr style="border-top: 2px dashed #000;">
        <td class="grand-total" style="padding-top: 6px;">TOTAL USD:</td>
        <td class="grand-total text-right" style="padding-top: 6px;">${formatUSD(order.totalUSD)}</td>
      </tr>
      <tr>
        <td style="font-size: 22px;">TASA BCV:</td>
        <td class="text-right" style="font-size: 22px;">Bs. ${rate.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="bs-total">TOTAL BS:</td>
        <td class="bs-total text-right">${formatBs(order.totalUSD, rate)}</td>
      </tr>
    </table>

    ${hasSplit ? `
    <div class="split-box">
      <div class="bold text-center" style="font-size: 23px; margin-bottom: 6px; text-transform: uppercase;">
        *** CUENTA DIVIDIDA (${splitPersons} PERSONAS) ***
      </div>
      <div class="info-row" style="font-size: 24px;">
        <span class="bold">CADA PERSONA PAGA:</span>
        <span class="bold" style="font-size: 28px;">${formatUSD(eachUSD)}</span>
      </div>
      <div class="info-row" style="font-size: 23px;">
        <span>EN BOLÍVARES (BCV):</span>
        <span class="bold">${formatBs(eachUSD, rate)}</span>
      </div>
    </div>
    ` : ''}

    <div class="divider"></div>

    <div class="info-row" style="font-size: 22px;">
      <span>MÉTODO DE PAGO:</span>
      <span class="bold uppercase">${escapeHtml(order.paymentMethod.replace('_', ' '))}</span>
    </div>
    ${order.paymentRef ? `
    <div style="font-size: 20px; color: #222; margin-top: 4px;">
      ${escapeHtml(order.paymentRef)}
    </div>
    ` : ''}

    <div class="double-divider"></div>

    <div class="footer">
      <p class="bold">¡GRACIAS POR SU VISITA!</p>
      <p>Masa madre con 48h de fermentación lenta</p>
      <p>Síguenos en IG: @${safeInstagram}</p>
      <p>${safeStoreLocation}</p>
      <p style="margin-top: 6px; font-size: 19px;">* Documento de consumo / Ticket de salida *</p>
    </div>
  ` : `
    <div class="footer bold" style="font-size: 25px; margin-top: 12px;">
      <p>*** DESPACHAR DE INMEDIATO ***</p>
      <p style="font-size: 20px; font-weight: normal; margin-top: 6px;">Vandali Pizzería Artesanal</p>
    </div>
  `}
</body>
</html>
  `.trim();
}

/**
 * Ensures that Plus Jakarta Sans (the digital label font) is fully loaded
 * into the browser font cache before printing or rasterizing.
 */
export async function ensureReceiptFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.allSettled([
      document.fonts.load('16px "Plus Jakarta Sans"'),
      document.fonts.load('18px "Plus Jakarta Sans"'),
      document.fonts.load('19px "Plus Jakarta Sans"'),
      document.fonts.load('20px "Plus Jakarta Sans"'),
      document.fonts.load('21px "Plus Jakarta Sans"'),
      document.fonts.load('22px "Plus Jakarta Sans"'),
      document.fonts.load('23px "Plus Jakarta Sans"'),
      document.fonts.load('24px "Plus Jakarta Sans"'),
      document.fonts.load('25px "Plus Jakarta Sans"'),
      document.fonts.load('26px "Plus Jakarta Sans"'),
      document.fonts.load('27px "Plus Jakarta Sans"'),
      document.fonts.load('28px "Plus Jakarta Sans"'),
      document.fonts.load('30px "Plus Jakarta Sans"'),
      document.fonts.load('32px "Plus Jakarta Sans"'),
      document.fonts.load('36px "Plus Jakarta Sans"'),
      document.fonts.load('44px "Plus Jakarta Sans"'),
      document.fonts.load('48px "Plus Jakarta Sans"'),
      document.fonts.load('bold 24px "Plus Jakarta Sans"'),
      document.fonts.load('800 24px "Plus Jakarta Sans"'),
      document.fonts.load('800 26px "Plus Jakarta Sans"'),
      document.fonts.load('900 28px "Plus Jakarta Sans"'),
      document.fonts.load('900 32px "Plus Jakarta Sans"'),
      document.fonts.load('900 36px "Plus Jakarta Sans"'),
      document.fonts.load('900 48px "Plus Jakarta Sans"'),
    ]);
    await document.fonts.ready;
  } catch {}
}

/**
 * Triggers standard thermal receipt printing via browser with guaranteed
 * Plus Jakarta Sans digital typography and layout matching the on-screen ticket.
 */
export async function printThermalBrowser(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): Promise<void> {
  // Pre-load font in parent window
  await ensureReceiptFontsLoaded();

  const html = generateReceiptHTML(order, type, config, splitPersons);
  
  const iframe = document.createElement('iframe');
  // Position offscreen with realistic dimensions so Chromium layout engine parses and downloads web fonts
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0px';
  iframe.style.width = '380px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Transfer font faces from parent document to iframe so it renders immediately with Plus Jakarta Sans
  if (iframe.contentWindow && (doc as any).fonts && (document as any).fonts) {
    try {
      for (const font of (document as any).fonts) {
        (doc as any).fonts.add(font);
      }
    } catch {}
  }

  // Wait for the iframe's font set to be ready
  try {
    if ((doc as any).fonts?.ready) {
      await Promise.race([
        (doc as any).fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    }
  } catch {}

  // Short tick for CSS rendering pass
  await new Promise((resolve) => setTimeout(resolve, 150));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 3000);
}

/**
 * High-Fidelity Canvas Browser Print.
 * Renders the ticket using the digital font on an HTML5 canvas and prints it directly,
 * guaranteeing 100% font match even if the printer driver forces font substitution.
 */
export async function printThermalCanvasBrowser(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): Promise<void> {
  await ensureReceiptFontsLoaded();
  const canvas = await renderThermalBitmapCanvas(order, type, config, splitPersons, 560);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket Vandali</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    html, body { margin: 0; padding: 0; background: #fff; text-align: center; }
    img { width: 100%; max-width: 80mm; display: block; margin: 0 auto; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Ticket de Salida" />
</body>
</html>
  `.trim();

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0px';
  iframe.style.width = '380px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(printHtml);
  doc.close();

  await new Promise((resolve) => setTimeout(resolve, 250));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 3000);
}

/**
 * Generates raw ESC/POS binary data for Bluetooth Thermal Printers (58mm / 80mm).
 */
export function generateEscPosBinary(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): Uint8Array {
  const isComanda = type === 'comanda';
  const items = formatOrderItemsForReceipt(order, isComanda);
  const now = new Date(order.timestamp || Date.now());
  const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = order.date || now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const locationLabel = order.origin === 'local_pos' 
    ? (order.tableNumber || 'Salon/Mesa') 
    : order.deliveryType === 'delivery' 
    ? `Delivery: ${order.zone || 'Domicilio'}` 
    : 'Pick-up Local';

  const commands: number[] = [];

  // Helper push text
  const encoder = new TextEncoder();
  const pushText = (text: string) => {
    // Clean accented characters for standard ESC/POS ASCII compat
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ñÑ]/g, 'n');
    const bytes = encoder.encode(normalized);
    for (let i = 0; i < bytes.length; i++) {
      commands.push(bytes[i]);
    }
  };

  // ESC @: Initialize
  commands.push(0x1b, 0x40);

  // ESC a 1: Center
  commands.push(0x1b, 0x61, 0x01);
  // Double height & width
  commands.push(0x1d, 0x21, 0x11);
  pushText("VANDALI\n");
  // Normal
  commands.push(0x1d, 0x21, 0x00);
  pushText("PIZZERIA ARTESANAL\n");
  pushText("Av. 2 Lora entre 27 y 28\n");
  pushText("Merida - Tel: 0424-8954741\n");
  pushText("--------------------------------\n");
  commands.push(0x1b, 0x45, 0x01); // Bold on
  pushText(isComanda ? "*** COMANDA COCINA ***\n" : "*** CUENTA / TICKET DE SALIDA ***\n");
  commands.push(0x1b, 0x45, 0x00); // Bold off
  pushText("================================\n");

  // ESC a 0: Left
  commands.push(0x1b, 0x61, 0x00);
  commands.push(0x1d, 0x21, 0x01); // Double height for order & location
  pushText(`ORDEN: #${order.id}\n`);
  pushText(`UBICACION: ${locationLabel}\n`);
  commands.push(0x1d, 0x21, 0x00); // Normal
  pushText(`FECHA: ${dateStr} ${timeStr}\n`);
  if (order.customerName) {
    pushText(`CLIENTE: ${order.customerName}\n`);
  }
  pushText("--------------------------------\n");
  pushText("CANT  DESCRIPCION\n");
  pushText("--------------------------------\n");

  items.forEach((it) => {
    const qtyPrefix = `${it.qty}x `;
    commands.push(0x1d, 0x21, 0x01); // Double height for items
    pushText(`${qtyPrefix}${it.name}\n`);
    commands.push(0x1d, 0x21, 0x00); // Normal
    if (it.notes) {
      pushText(`   * ${it.notes}\n`);
    }
    if (!isComanda && it.price) {
      pushText(`   Valor: ${it.price}\n`);
    }
  });

  pushText("--------------------------------\n");

  if (!isComanda) {
    pushText(`SUBTOTAL:         ${formatUSD(order.subtotalUSD || order.totalUSD)}\n`);
    if (order.discountUSD > 0) {
      pushText(`DESCUENTO:        -${formatUSD(order.discountUSD)}\n`);
    }
    if (order.employeeDiscountUSD && order.employeeDiscountUSD > 0) {
      pushText(`DESC. EMPLEADO:   -${formatUSD(order.employeeDiscountUSD)}\n`);
    }
    if (order.deliveryCostUSD > 0) {
      pushText(`DELIVERY:         ${formatUSD(order.deliveryCostUSD)}\n`);
    }
    if (order.tipUSD && Number(order.tipUSD) > 0) {
      pushText(`PROPINA VOLUNT.:  +${formatUSD(Number(order.tipUSD))}\n`);
    }
    commands.push(0x1b, 0x45, 0x01); // Bold on
    commands.push(0x1d, 0x21, 0x01); // Double height for totals
    pushText(`TOTAL USD:        ${formatUSD(order.totalUSD)}\n`);
    const rate = getReceiptExchangeRate(config);
    commands.push(0x1d, 0x21, 0x00); // Normal
    pushText(`TASA BCV:         Bs. ${rate.toFixed(2)}\n`);
    commands.push(0x1d, 0x21, 0x01); // Double height
    pushText(`TOTAL EN BS:      ${formatBs(order.totalUSD, rate)}\n`);
    commands.push(0x1d, 0x21, 0x00); // Normal
    commands.push(0x1b, 0x45, 0x00); // Bold off

    if (splitPersons && splitPersons > 1) {
      const eachUSD = (order.totalUSD || 0) / splitPersons;
      pushText("--------------------------------\n");
      commands.push(0x1b, 0x45, 0x01); // Bold on
      pushText(`CUENTA DIVIDIDA: ${splitPersons} PERSONAS\n`);
      pushText(`C/U PAGA: ${formatUSD(eachUSD)} USD\n`);
      pushText(`EN BS:    ${formatBs(eachUSD, rate)}\n`);
      commands.push(0x1b, 0x45, 0x00); // Bold off
    }

    pushText("--------------------------------\n");
    pushText(`PAGO: ${order.paymentMethod.toUpperCase()}\n`);
    pushText("================================\n");
    // Center
    commands.push(0x1b, 0x61, 0x01);
    pushText("¡GRACIAS POR SU VISITA!\n");
    pushText("Doc. Consumo / Ticket de Salida\n");
  } else {
    // Center
    commands.push(0x1b, 0x61, 0x01);
    commands.push(0x1b, 0x45, 0x01);
    pushText("*** DESPACHAR DE INMEDIATO ***\n");
    commands.push(0x1b, 0x45, 0x00);
  }

  // Line feeds & Cut
  commands.push(0x0a, 0x0a, 0x0a, 0x0a);
  commands.push(0x1d, 0x56, 0x41, 0x03);

  return new Uint8Array(commands);
}

/**
 * Renders a high-contrast 1:1 monochrome canvas tuned specifically for thermal POS paper
 * (384 dots for 58mm, or 576 dots for 80mm).
 * Exclusively uses Plus Jakarta Sans (identical to the digital label preview).
 */
export async function renderThermalBitmapCanvas(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number,
  targetWidthDots: number = 384
): Promise<HTMLCanvasElement> {
  await ensureReceiptFontsLoaded();

  const isComanda = type === 'comanda';
  const items = formatOrderItemsForReceipt(order, isComanda);
  const now = new Date(order.timestamp || Date.now());
  const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = order.date || now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const rawLocation = order.origin === 'local_pos' 
    ? (order.tableNumber || 'Salón / Mesa') 
    : order.deliveryType === 'delivery' 
    ? `Delivery: ${order.zone || order.address || 'Domicilio'}` 
    : 'Pick-up en Local';

  const width = targetWidthDots;
  const hasSplit = !isComanda && splitPersons && splitPersons > 1;

  // Generous height estimate to allow natural line stacking without clipping
  let estimatedHeight = 1100 + (items.length * 110);
  items.forEach((it) => {
    if (it.notes) estimatedHeight += 60;
  });
  if (!isComanda) estimatedHeight += 480;
  if (hasSplit) estimatedHeight += 220;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = estimatedHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Pure white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Safe margins: 16px protects from physical hardware border offsets
  const leftX = 16;
  const rightX = width - 16;
  const centerX = width / 2;
  const maxContentW = rightX - leftX;
  let y = 42;

  const fontMain = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  // Helper: word-wraps text within a maximum pixel width
  const wrapText = (text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
  };

  // Helper: centered text with multi-line wrapping so nothing spills off the sides
  const drawWrappedCenterText = (text: string, font: string, lineHeight: number, color = '#000000') => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    const lines = wrapText(text, maxContentW, font);
    for (const line of lines) {
      ctx.fillText(line, centerX, y);
      y += lineHeight;
    }
    ctx.textAlign = 'left';
  };

  // Helper: smart two-column row that STACKS into 2 lines if left + right would overlap!
  const drawSmartRow = (
    left: string,
    right: string,
    font: string,
    isBold = false,
    lineHeight?: number
  ) => {
    ctx.fillStyle = '#000000';
    ctx.font = font;
    const leftW = ctx.measureText(left).width;
    const rightW = right ? ctx.measureText(right).width : 0;
    const lh = lineHeight || Math.round(parseInt(font.match(/\d+px/)?.[0] || '22') * 1.25);

    // If both exist and they would collide or touch:
    if (right && (leftW + rightW + 16 > maxContentW)) {
      // Line 1: Left text
      ctx.textAlign = 'left';
      ctx.fillText(left, leftX, y);
      y += lh;
      // Line 2: Right text (right-aligned)
      ctx.textAlign = 'right';
      if (isBold) ctx.font = font.replace('normal', 'bold').replace('600', '800');
      ctx.fillText(right, rightX, y);
      ctx.textAlign = 'left';
      y += lh;
      return;
    }

    // Fits comfortably on one line
    ctx.textAlign = 'left';
    ctx.fillText(left, leftX, y);
    if (right) {
      ctx.textAlign = 'right';
      if (isBold) ctx.font = font.replace('normal', 'bold').replace('600', '800');
      ctx.fillText(right, rightX, y);
      ctx.textAlign = 'left';
    }
    y += lh;
  };

  const drawDivider = (isDashed = true) => {
    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    if (isDashed) {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // 1. Header (Large & clearly centered, with safe wrapping)
  drawWrappedCenterText('VANDALI', `900 38px ${fontMain}`, 42);
  drawWrappedCenterText('PIZZERÍA ARTESANAL', `800 20px ${fontMain}`, 26);
  y += 4;
  drawWrappedCenterText(config.location || 'Av. 2 Lora, entre calles 27 y 28, Mérida', `600 16px ${fontMain}`, 22, '#222222');
  drawWrappedCenterText(`Tel: ${config.phoneFormatted || '0424-8954741'} • IG: @${config.instagram || 'vandali.pizzeria'}`, `600 16px ${fontMain}`, 22, '#222222');
  y += 6;

  // 2. Badge (Safely fits inside roll without clipping)
  const badgeText = isComanda ? '*** COMANDA DE COCINA ***' : '*** TICKET DE SALIDA ***';
  ctx.font = `900 19px ${fontMain}`;
  const measuredBadgeW = ctx.measureText(badgeText).width;
  const badgeWidth = Math.min(measuredBadgeW + 28, maxContentW);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(centerX - badgeWidth / 2, y - 20, badgeWidth, 34);
  drawWrappedCenterText(badgeText, `900 19px ${fontMain}`, 30);
  y += 4;

  // 3. Metadata
  drawDivider(true);
  y += 24;
  drawSmartRow('ORDEN:', `#${order.id}`, `800 24px ${fontMain}`, true, 28);
  drawSmartRow('FECHA:', dateStr, `600 20px ${fontMain}`, false, 25);
  drawSmartRow('HORA:', timeStr, `600 20px ${fontMain}`, false, 25);
  
  // Ubicación (wrapped if long address)
  ctx.fillStyle = '#000000';
  ctx.font = `800 20px ${fontMain}`;
  ctx.textAlign = 'left';
  const locW = ctx.measureText(rawLocation).width;
  if (locW + 140 <= maxContentW) {
    drawSmartRow('UBICACIÓN:', rawLocation, `800 20px ${fontMain}`, true, 26);
  } else {
    ctx.fillText('UBICACIÓN:', leftX, y);
    y += 24;
    ctx.font = `800 20px ${fontMain}`;
    const locLines = wrapText(rawLocation, maxContentW - 10, `800 20px ${fontMain}`);
    for (const l of locLines) {
      ctx.fillText(`  ${l}`, leftX, y);
      y += 24;
    }
  }

  if (order.customerName) {
    drawSmartRow('CLIENTE:', order.customerName, `800 20px ${fontMain}`, false, 25);
  }
  if (order.customerPhone) {
    drawSmartRow('TELÉFONO:', order.customerPhone, `600 20px ${fontMain}`, false, 25);
  }

  y += 8;
  drawDivider(false);
  y += 24;

  // 4. Table Header
  drawSmartRow('CANT  DESCRIPCIÓN', isComanda ? '' : 'VALOR', `800 20px ${fontMain}`, true, 24);
  y += 4;
  drawDivider(true);
  y += 24;

  // 5. Items (Guaranteed ZERO overlap between name and price)
  items.forEach((it) => {
    ctx.fillStyle = '#000000';
    const itemFont = `800 22px ${fontMain}`;
    ctx.font = itemFont;
    const fullItemName = `${it.qty}x  ${it.name}`;
    const priceText = (!isComanda && it.price) ? it.price : '';
    const priceW = priceText ? ctx.measureText(priceText).width : 0;

    // Check if item name and price can comfortably fit on the exact same line
    const nameW = ctx.measureText(fullItemName).width;
    if (priceText && (nameW + priceW + 18 <= maxContentW)) {
      // Same line: name on left, price on right
      ctx.textAlign = 'left';
      ctx.fillText(fullItemName, leftX, y);
      ctx.textAlign = 'right';
      ctx.fillText(priceText, rightX, y);
      ctx.textAlign = 'left';
      y += 27;
    } else {
      // Item name wraps across full width, price on its own right-aligned line
      const nameLines = wrapText(fullItemName, maxContentW, itemFont);
      for (const line of nameLines) {
        ctx.textAlign = 'left';
        ctx.fillText(line, leftX, y);
        y += 27;
      }
      if (priceText) {
        ctx.textAlign = 'right';
        ctx.fillText(priceText, rightX, y);
        ctx.textAlign = 'left';
        y += 27;
      }
    }

    // Notes (cleanly indented and wrapped)
    if (it.notes) {
      ctx.fillStyle = '#111111';
      const notesFont = `italic 18px ${fontMain}`;
      ctx.font = notesFont;
      const noteLines = wrapText(`* ${it.notes}`, maxContentW - 14, notesFont);
      for (const nl of noteLines) {
        ctx.fillText(`   ${nl}`, leftX, y);
        y += 22;
      }
    }
    y += 8;
  });

  drawDivider(true);
  y += 24;

  // 6. Totals & Payments
  if (!isComanda) {
    const subtotal = order.subtotalUSD || order.totalUSD;
    drawSmartRow('SUBTOTAL:', formatUSD(subtotal), `600 20px ${fontMain}`, false, 26);

    if (order.discountUSD > 0) {
      drawSmartRow('DESCUENTO (-30%):', `-${formatUSD(order.discountUSD)}`, `600 20px ${fontMain}`, false, 26);
    }

    if (order.employeeDiscountUSD && order.employeeDiscountUSD > 0) {
      drawSmartRow(`DESC. EMPLEADO (-${order.employeeDiscountPercent || 20}%):`, `-${formatUSD(order.employeeDiscountUSD)}`, `800 20px ${fontMain}`, false, 26);
    }

    if (order.deliveryCostUSD > 0) {
      drawSmartRow('DELIVERY:', formatUSD(order.deliveryCostUSD), `600 20px ${fontMain}`, false, 26);
    }

    if (order.tipUSD && Number(order.tipUSD) > 0) {
      drawSmartRow('PROPINA VOLUNTARIA:', `+${formatUSD(Number(order.tipUSD))}`, `800 20px ${fontMain}`, false, 26);
    }

    y += 4;
    drawDivider(false);
    y += 28;

    const receiptRate = getReceiptExchangeRate(config);
    // TOTAL USD: Stacks if needed, never overlaps
    drawSmartRow('TOTAL USD:', formatUSD(order.totalUSD), `900 28px ${fontMain}`, true, 34);
    drawSmartRow('TASA OFICIAL BCV:', `Bs. ${receiptRate.toFixed(2)}`, `600 18px ${fontMain}`, false, 25);
    // TOTAL BOLIVARES: Big font, stacks into 2 lines cleanly so Bs amount never overlaps label
    drawSmartRow('TOTAL EN BOLÍVARES:', formatBs(order.totalUSD, receiptRate), `900 24px ${fontMain}`, true, 30);

    if (hasSplit && splitPersons) {
      const eachUSD = (order.totalUSD || 0) / splitPersons;
      const rate = receiptRate;
      y += 8;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(leftX, y, maxContentW, 90);
      y += 24;
      drawWrappedCenterText(`*** CUENTA DIVIDIDA (${splitPersons} PERSONAS) ***`, `800 18px ${fontMain}`, 24);
      drawSmartRow('CADA PERSONA:', `${formatUSD(eachUSD)} USD`, `800 22px ${fontMain}`, true, 26);
      drawSmartRow('EN BS (BCV):', formatBs(eachUSD, rate), `600 18px ${fontMain}`, false, 22);
      y += 6;
    }

    y += 6;
    drawDivider(true);
    y += 24;
    drawSmartRow('MÉTODO DE PAGO:', order.paymentMethod.replace('_', ' ').toUpperCase(), `800 20px ${fontMain}`, true, 26);
    y += 12;

    drawWrappedCenterText('¡GRACIAS POR SU PREFERENCIA!', `800 20px ${fontMain}`, 26);
    drawWrappedCenterText('Masa madre con 48h de fermentación lenta', `600 16px ${fontMain}`, 22, '#222222');
    drawWrappedCenterText('* Documento de consumo / Ticket de salida *', `normal 15px ${fontMain}`, 20, '#444444');
    y += 10;
  } else {
    drawWrappedCenterText('*** DESPACHAR DE INMEDIATO ***', `900 26px ${fontMain}`, 32);
    drawWrappedCenterText('Vandali Pizzería Artesanal', `600 18px ${fontMain}`, 24, '#222222');
    y += 10;
  }

  // Crop canvas to actual height used
  const finalHeight = Math.ceil(y + 25);
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = finalHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (croppedCtx) {
    croppedCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);
    return croppedCanvas;
  }
  return canvas;
}

/**
 * Encodes an HTMLCanvasElement into ESC/POS GS v 0 raster bit image commands.
 * Splits into vertical slices of 120 lines to prevent buffer overflow on Bluetooth thermal printers.
 */
export function canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array();

  const width = canvas.width;
  const height = canvas.height;
  const widthBytes = Math.ceil(width / 8);
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const commands: number[] = [];

  // ESC @ : Initialize printer
  commands.push(0x1b, 0x40);

  // ESC a 1: Center
  commands.push(0x1b, 0x61, 0x01);

  // Slice into bands of 120 lines to avoid buffer overrun on portable Bluetooth printers
  const maxSliceHeight = 120;
  for (let sliceY = 0; sliceY < height; sliceY += maxSliceHeight) {
    const currentSliceHeight = Math.min(maxSliceHeight, height - sliceY);

    // GS v 0 0 xL xH yL yH
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = currentSliceHeight % 256;
    const yH = Math.floor(currentSliceHeight / 256);

    commands.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let y = 0; y < currentSliceHeight; y++) {
      const globalY = sliceY + y;
      for (let byteX = 0; byteX < widthBytes; byteX++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = byteX * 8 + bit;
          if (pixelX < width) {
            const pixelIndex = (globalY * width + pixelX) * 4;
            const r = imgData[pixelIndex];
            const g = imgData[pixelIndex + 1];
            const b = imgData[pixelIndex + 2];
            const a = imgData[pixelIndex + 3];

            if (a > 120) {
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 170) {
                // 1 = black thermal dot
                byteVal |= (1 << (7 - bit));
              }
            }
          }
        }
        commands.push(byteVal);
      }
    }
  }

  // Line feeds & Cut
  commands.push(0x0a, 0x0a, 0x0a, 0x0a);
  commands.push(0x1d, 0x56, 0x41, 0x03);

  return new Uint8Array(commands);
}

/**
 * Generates raster ESC/POS binary data rendered with Plus Jakarta Sans
 * so that physical thermal printers print using the exact same font as the digital label.
 */
export async function generateEscPosRasterBinary(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number,
  targetWidthDots: number = 384
): Promise<Uint8Array> {
  const canvas = await renderThermalBitmapCanvas(order, type, config, splitPersons, targetWidthDots);
  return canvasToEscPosRaster(canvas);
}

/**
 * Connects to a Bluetooth Thermal printer and prints via Web Bluetooth API.
 * Uses high-resolution ESC/POS raster bitmap rendered with the digital label font (Plus Jakarta Sans).
 * Falls back to browser thermal print if Bluetooth is not supported or rejected.
 */
export async function printThermalBluetooth(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): Promise<{ success: boolean; message: string }> {
  // Check Web Bluetooth API availability
  const nav = navigator as any;
  if (!nav.bluetooth) {
    // Fallback directly to browser print
    await printThermalBrowser(order, type, config, splitPersons);
    return {
      success: true,
      message: 'Impresión térmica enviada mediante el controlador del sistema.',
    };
  }

  try {
    // Generate raster bitmap rendered with Plus Jakarta Sans (digital label font)
    let rawBytes: Uint8Array;
    try {
      rawBytes = await generateEscPosRasterBinary(order, type, config, splitPersons);
    } catch (rasterErr) {
      console.warn('Fallback to text ESC/POS:', rasterErr);
      rawBytes = generateEscPosBinary(order, type, config, splitPersons);
    }

    // Request Bluetooth device with typical POS/Thermal printer services
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Serial Port Service
        '0000ff00-0000-1000-8000-00805f9b34fb', // Custom POS
      ],
    });

    if (!device.gatt) {
      throw new Error('Dispositivo Bluetooth sin conexión GATT.');
    }

    const server = await device.gatt.connect();
    
    // Discover services
    const services = await server.getPrimaryServices();
    let writeChar: any = null;

    for (const s of services) {
      try {
        const characteristics = await s.getCharacteristics();
        for (const c of characteristics) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        // continue
      }
    }

    if (!writeChar) {
      throw new Error('No se encontró canal de escritura ESC/POS en la impresora Bluetooth.');
    }

    // Write in 100-byte chunks with flow control to avoid Bluetooth buffer overflow
    const chunkSize = 100;
    for (let i = 0; i < rawBytes.length; i += chunkSize) {
      const chunk = rawBytes.slice(i, i + chunkSize);
      await writeChar.writeValue(chunk);
      if (i % 600 === 0 && i > 0) {
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    return {
      success: true,
      message: `Impreso en "${device.name || 'Impresora Bluetooth'}" con fuente Plus Jakarta Sans.`,
    };
  } catch (err: any) {
    console.warn('Bluetooth print error/cancel, falling back to browser print:', err);
    await printThermalBrowser(order, type, config, splitPersons);
    return {
      success: true,
      message: 'Impresión térmica enviada a través de la ventana del sistema.',
    };
  }
}

/**
 * Renders a high-resolution, pixel-perfect thermal receipt on an HTML5 Canvas.
 */
export function renderReceiptToCanvas(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  splitPersons?: number
): HTMLCanvasElement {
  const isComanda = type === 'comanda';
  const items = formatOrderItemsForReceipt(order, isComanda);
  const now = new Date(order.timestamp || Date.now());
  const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = order.date || now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

  const rawLocation = order.origin === 'local_pos' 
    ? (order.tableNumber || 'Salón / Mesa') 
    : order.deliveryType === 'delivery' 
    ? `Delivery: ${order.zone || order.address || 'Domicilio'}` 
    : 'Pick-up en Local';

  const width = 560;
  const hasSplit = !isComanda && splitPersons && splitPersons > 1;

  // Estimate height dynamically based on items count and enlarged metadata
  let estimatedHeight = 850 + (items.length * 96);
  items.forEach(it => {
    if (it.notes) estimatedHeight += 48;
  });
  if (!isComanda) estimatedHeight += 380;
  if (hasSplit) estimatedHeight += 180;

  const canvas = document.createElement('canvas');
  const dpr = 2; // Retina sharpness
  canvas.width = width * dpr;
  canvas.height = estimatedHeight * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${estimatedHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Outer border & subtle receipt styling
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, width - 24, estimatedHeight - 24);

  let y = 48;
  const centerX = width / 2;
  const leftX = 28;
  const rightX = width - 28;

  const maxContentW = rightX - leftX;

  // Helper: word-wraps text within a maximum pixel width
  const wrapText = (text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [text];
  };

  // Helper: centered text with multi-line wrapping
  const drawWrappedCenterText = (text: string, font: string, lineHeight: number, color = '#000000') => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    const lines = wrapText(text, maxContentW, font);
    for (const line of lines) {
      ctx.fillText(line, centerX, y);
      y += lineHeight;
    }
    ctx.textAlign = 'left';
  };

  // Helper: smart row that stacks if left + right exceeds available width
  const drawSmartRow = (
    left: string,
    right: string,
    font: string,
    isBold = false,
    lineHeight?: number
  ) => {
    ctx.fillStyle = '#000000';
    ctx.font = font;
    const leftW = ctx.measureText(left).width;
    const rightW = right ? ctx.measureText(right).width : 0;
    const lh = lineHeight || Math.round(parseInt(font.match(/\d+px/)?.[0] || '24') * 1.25);

    if (right && (leftW + rightW + 18 > maxContentW)) {
      ctx.textAlign = 'left';
      ctx.fillText(left, leftX, y);
      y += lh;
      ctx.textAlign = 'right';
      if (isBold) ctx.font = font.replace('normal', 'bold');
      ctx.fillText(right, rightX, y);
      ctx.textAlign = 'left';
      y += lh;
      return;
    }

    ctx.textAlign = 'left';
    ctx.fillText(left, leftX, y);
    if (right) {
      ctx.textAlign = 'right';
      if (isBold) ctx.font = font.replace('normal', 'bold');
      ctx.fillText(right, rightX, y);
      ctx.textAlign = 'left';
    }
    y += lh;
  };

  const drawDivider = (isDashed = true) => {
    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    if (isDashed) {
      ctx.setLineDash([6, 6]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Header (100% enlarged typography)
  const fontMain = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  drawWrappedCenterText('VANDALI', `900 48px ${fontMain}`, 52);
  drawWrappedCenterText('PIZZERÍA ARTESANAL', `bold 24px ${fontMain}`, 30);
  y += 4;
  drawWrappedCenterText(config.location || 'Av. 2 Lora, entre calles 27 y 28, Mérida', `normal 20px ${fontMain}`, 26, '#333333');
  drawWrappedCenterText(`Tel: ${config.phoneFormatted || '0424-8954741'} • IG: @${config.instagram || 'vandali.pizzeria'}`, `normal 20px ${fontMain}`, 26, '#333333');
  y += 8;

  // Badge
  const badgeText = isComanda ? '*** COMANDA DE COCINA ***' : '*** TICKET DE SALIDA ***';
  ctx.font = `bold 22px ${fontMain}`;
  const badgeWidth = Math.min(ctx.measureText(badgeText).width + 36, maxContentW);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(centerX - badgeWidth / 2, y - 22, badgeWidth, 38);
  drawWrappedCenterText(badgeText, `bold 22px ${fontMain}`, 34);
  y += 6;

  // Metadata
  drawDivider(true);
  y += 28;
  drawSmartRow('ORDEN:', `#${order.id}`, `bold 26px ${fontMain}`, true, 30);
  drawSmartRow('FECHA:', dateStr, `normal 22px ${fontMain}`, false, 28);
  drawSmartRow('HORA:', timeStr, `normal 22px ${fontMain}`, false, 28);
  drawSmartRow('UBICACIÓN:', rawLocation, `bold 24px ${fontMain}`, true, 30);
  if (order.customerName) {
    drawSmartRow('CLIENTE:', order.customerName, `bold 24px ${fontMain}`, false, 28);
  }
  if (order.customerPhone) {
    drawSmartRow('TELÉFONO:', order.customerPhone, `normal 22px ${fontMain}`, false, 28);
  }

  y += 8;
  drawDivider(false);
  y += 28;

  // Table header
  drawSmartRow('CANT  DESCRIPCIÓN', isComanda ? '' : 'VALOR', `bold 23px ${fontMain}`, true, 26);
  y += 4;
  drawDivider(true);
  y += 26;

  // Items (Smart zero overlap)
  items.forEach((it) => {
    ctx.fillStyle = '#000000';
    const itemFont = `bold 24px ${fontMain}`;
    ctx.font = itemFont;
    const fullItemName = `${it.qty}x  ${it.name}`;
    const priceText = (!isComanda && it.price) ? it.price : '';
    const priceW = priceText ? ctx.measureText(priceText).width : 0;
    const nameW = ctx.measureText(fullItemName).width;

    if (priceText && (nameW + priceW + 20 <= maxContentW)) {
      ctx.textAlign = 'left';
      ctx.fillText(fullItemName, leftX, y);
      ctx.textAlign = 'right';
      ctx.fillText(priceText, rightX, y);
      ctx.textAlign = 'left';
      y += 30;
    } else {
      const nameLines = wrapText(fullItemName, maxContentW, itemFont);
      for (const line of nameLines) {
        ctx.textAlign = 'left';
        ctx.fillText(line, leftX, y);
        y += 30;
      }
      if (priceText) {
        ctx.textAlign = 'right';
        ctx.fillText(priceText, rightX, y);
        ctx.textAlign = 'left';
        y += 30;
      }
    }

    if (it.notes) {
      ctx.fillStyle = '#111111';
      const notesFont = `italic 20px ${fontMain}`;
      ctx.font = notesFont;
      const noteLines = wrapText(`* ${it.notes}`, maxContentW - 16, notesFont);
      for (const nl of noteLines) {
        ctx.fillText(`   ${nl}`, leftX, y);
        y += 24;
      }
    }
    y += 8;
  });

  drawDivider(true);
  y += 26;

  // Totals if Pre-cuenta
  if (!isComanda) {
    const subtotal = order.subtotalUSD || order.totalUSD;
    drawSmartRow('SUBTOTAL:', formatUSD(subtotal), `normal 22px ${fontMain}`, false, 28);

    if (order.discountUSD > 0) {
      drawSmartRow('DESCUENTO CLUB (-30%):', `-${formatUSD(order.discountUSD)}`, `normal 22px ${fontMain}`, false, 28);
    }

    if (order.employeeDiscountUSD && order.employeeDiscountUSD > 0) {
      drawSmartRow(`DESC. EMPLEADO (-${order.employeeDiscountPercent || 20}%):`, `-${formatUSD(order.employeeDiscountUSD)}`, `bold 22px ${fontMain}`, false, 28);
    }

    if (order.deliveryCostUSD > 0) {
      drawSmartRow('DELIVERY:', formatUSD(order.deliveryCostUSD), `normal 22px ${fontMain}`, false, 28);
    }

    if (order.tipUSD && Number(order.tipUSD) > 0) {
      drawSmartRow('PROPINA VOLUNTARIA:', `+${formatUSD(Number(order.tipUSD))}`, `bold 22px ${fontMain}`, false, 28);
    }

    y += 6;
    drawDivider(false);
    y += 30;

    const exportRate = getReceiptExchangeRate(config);
    drawSmartRow('TOTAL USD:', formatUSD(order.totalUSD), `bold 34px ${fontMain}`, true, 40);
    drawSmartRow('TASA OFICIAL BCV:', `Bs. ${exportRate.toFixed(2)}`, `normal 20px ${fontMain}`, false, 28);
    drawSmartRow('TOTAL EN BOLÍVARES:', formatBs(order.totalUSD, exportRate), `bold 28px ${fontMain}`, true, 34);

    if (hasSplit && splitPersons) {
      const eachUSD = (order.totalUSD || 0) / splitPersons;
      const rate = exportRate;
      y += 8;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(leftX, y, maxContentW, 95);
      y += 26;
      drawWrappedCenterText(`*** CUENTA DIVIDIDA (${splitPersons} PERSONAS) ***`, `bold 20px ${fontMain}`, 26);
      drawSmartRow('CADA PERSONA:', `${formatUSD(eachUSD)} USD`, `bold 24px ${fontMain}`, true, 28);
      drawSmartRow('EN BOLÍVARES (BCV):', formatBs(eachUSD, rate), `bold 20px ${fontMain}`, false, 24);
      y += 8;
    }

    y += 8;
    drawDivider(true);
    y += 26;
    drawSmartRow('MÉTODO DE PAGO:', order.paymentMethod.replace('_', ' ').toUpperCase(), `bold 22px ${fontMain}`, true, 28);
    y += 12;

    drawWrappedCenterText('¡GRACIAS POR SU PREFERENCIA!', `bold 22px ${fontMain}`, 28);
    drawWrappedCenterText('Masa madre con 48h de fermentación lenta', `normal 18px ${fontMain}`, 24, '#333333');
    drawWrappedCenterText('* Documento de consumo / Ticket de salida *', `normal 16px ${fontMain}`, 22, '#555555');
  } else {
    drawWrappedCenterText('*** DESPACHAR DE INMEDIATO ***', `bold 30px ${fontMain}`, 36);
    drawWrappedCenterText('Vandali Pizzería Artesanal', `normal 20px ${fontMain}`, 26, '#333333');
  }

  // Crop canvas to used height
  const finalHeight = Math.ceil(y + 30);
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width * dpr;
  croppedCanvas.height = finalHeight * dpr;
  croppedCanvas.style.width = `${width}px`;
  croppedCanvas.style.height = `${finalHeight}px`;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (croppedCtx) {
    croppedCtx.drawImage(canvas, 0, 0, width * dpr, finalHeight * dpr, 0, 0, width * dpr, finalHeight * dpr);
    return croppedCanvas;
  }
  return canvas;
}

/**
 * Direct export and download of Pre-Cuenta or Comanda receipt as PNG / JPG image.
 */
export async function exportReceiptAsImage(
  order: OrderRecord,
  type: TicketType,
  config: AdminConfig,
  format: 'png' | 'jpg' = 'png',
  splitPersons?: number
): Promise<void> {
  await ensureReceiptFontsLoaded();
  const canvas = renderReceiptToCanvas(order, type, config, splitPersons);
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const extension = format === 'jpg' ? 'jpg' : 'png';
  const filename = `${type === 'precuenta' ? 'Pre-Cuenta' : 'Comanda'}-${order.id}${splitPersons && splitPersons > 1 ? `-dividida-${splitPersons}p` : ''}.${extension}`;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        // Fallback with data URL
        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, 200);
    }, mimeType, 0.95);
  });
}
