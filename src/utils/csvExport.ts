import { OrderRecord } from '../types';

/**
 * Generates and downloads an Excel/Google Sheets-compatible CSV file with UTF-8 BOM
 * and separated 'Fecha' and 'Hora' columns.
 */
export function downloadOrdersCSV(orders: OrderRecord[], filename?: string) {
  const headers = [
    'ID Orden',
    'Fecha',
    'Hora',
    'Origen',
    'Mesa / Ubicación',
    'Cliente',
    'Teléfono',
    'Tipo Entrega',
    'Dirección / Zona',
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

    const originLabel = o.origin === 'local_pos' ? 'POS Local (Salón)' : 'Web Online';
    const locationLabel = o.tableNumber ? `Mesa ${o.tableNumber}` : (o.address || o.zone || 'Local');

    return [
      `"${o.id}"`,
      `"${fecha}"`,
      `"${hora}"`,
      `"${originLabel}"`,
      `"${locationLabel.replace(/"/g, '""')}"`,
      `"${(o.customerName || 'Cliente').replace(/"/g, '""')}"`,
      `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
      `"${o.deliveryType || ''}"`,
      `"${(o.address || o.zone || '').replace(/"/g, '""')}"`,
      `"${o.paymentMethod || ''}"`,
      `"${(o.itemsSummary || '').replace(/"/g, '""')}"`,
      (o.subtotalUSD || o.totalUSD || 0).toFixed(2),
      (o.discountUSD || 0).toFixed(2),
      (o.employeeDiscountUSD || 0).toFixed(2),
      (o.deliveryCostUSD || 0).toFixed(2),
      (Number(o.tipUSD) || 0).toFixed(2),
      (o.totalUSD || 0).toFixed(2),
      (o.totalBs || 0).toFixed(2),
      `"${o.status || ''}"`,
    ];
  });

  // UTF-8 BOM '\uFEFF' ensures Excel opens accents and special characters without encoding glitches
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `vandali_reporte_ordenes_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
