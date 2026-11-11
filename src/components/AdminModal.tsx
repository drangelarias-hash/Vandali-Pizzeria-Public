import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Settings,
  DollarSign,
  Clock,
  Phone,
  Power,
  PackageCheck,
  ShoppingBag,
  CreditCard,
  MapPin,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Save,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  UtensilsCrossed,
  Printer,
  Sparkles,
  Award,
  ChevronRight,
  Filter,
  Flame,
  Lock,
  LogOut,
  CupSoda,
  Layers,
  Bluetooth,
  FileText,
  Check,
  Download,
  Image as ImageIcon,
  Database,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  Percent,
  Tag,
  AlertCircle,
  AlertTriangle,
  Minus,
  Droplets,
  Receipt,
  Users,
  Share2,
  Calculator,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Heart,
  Split,
  Search,
  Truck,
  Info,
} from 'lucide-react';
import { AdminConfig, PizzaItem, MenuItem, OrderRecord, PizzaSize, PaymentMethod, CartItem, COMPLIMENTARY_CRUST_SAUCES, CRUST_SAUCE_EXTRA_PRICE, getPizzaPrice, getPizzaSizeLabel } from '../types';
import { formatUSD, formatBs, stripEmojis, calculateDeliveryCost, SAFE_DEFAULT_EXCHANGE_RATE } from '../utils/currency';
import { TicketType, printThermalBrowser, printThermalCanvasBrowser, printThermalBluetooth, formatOrderItemsForReceipt, exportReceiptAsImage } from '../utils/printReceipt';
import { downloadOrdersCSV } from '../utils/csvExport';
import { updateAdminPin, restoreDefaultAdminPin, ADMIN_RECOVERY_EMAIL } from '../utils/security';
import { syncManager } from '../utils/syncManager';
import { HalfAndHalfModal } from './HalfAndHalfModal';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AdminConfig;
  onUpdateConfig: (newConfig: AdminConfig) => void;
  pizzas: PizzaItem[];
  onUpdatePizzas: (pizzas: PizzaItem[]) => void;
  drinks: MenuItem[];
  onUpdateDrinks: (drinks: MenuItem[]) => void;
  salsas: MenuItem[];
  onUpdateSalsas: (salsas: MenuItem[]) => void;
  extras: MenuItem[];
  onUpdateExtras: (extras: MenuItem[]) => void;
  orders: OrderRecord[];
  onUpdateOrderStatus: (orderId: string, status: OrderRecord['status']) => void;
  onUpdateOrder?: (orderId: string, updatedOrderData: Partial<OrderRecord>) => void;
  onDeleteOrder?: (orderId: string) => void;
  onAddLocalOrder: (order: OrderRecord) => void;
  onRefreshLiveRate: (forceAuto?: boolean) => void;
  isUpdatingRate: boolean;
  onLogoutAdmin: () => void;
}

type AdminTab = 'stats' | 'pos' | 'orders' | 'menu' | 'config';
type CatalogCategory = 'pizzas' | 'bebidas' | 'extras';
type StatFilter = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'custom' | 'week' | 'month';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  pizzas,
  onUpdatePizzas,
  drinks,
  onUpdateDrinks,
  salsas,
  onUpdateSalsas,
  extras,
  onUpdateExtras,
  orders,
  onUpdateOrderStatus,
  onUpdateOrder,
  onDeleteOrder,
  onAddLocalOrder,
  onRefreshLiveRate,
  isUpdatingRate,
  onLogoutAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [catalogSubTab, setCatalogSubTab] = useState<CatalogCategory>('pizzas');
  const [formData, setFormData] = useState<AdminConfig>({ ...config });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Single source of truth for exchange rate in AdminModal
  const isAutoRate =
    (formData.exchangeRateMode || config.exchangeRateMode) !== 'manual' &&
    localStorage.getItem('vandali_exchange_rate_mode') !== 'manual';

  const effectiveExchangeRate = isAutoRate
    ? (config.exchangeRateBs && config.exchangeRateBs > 100
        ? config.exchangeRateBs
        : (formData.exchangeRateBs && formData.exchangeRateBs > 100 ? formData.exchangeRateBs : SAFE_DEFAULT_EXCHANGE_RATE))
    : (formData.exchangeRateBs && formData.exchangeRateBs > 100
        ? formData.exchangeRateBs
        : (config.exchangeRateBs && config.exchangeRateBs > 100 ? config.exchangeRateBs : SAFE_DEFAULT_EXCHANGE_RATE));

  // Auto-refresh rate when AdminModal opens if in auto mode
  useEffect(() => {
    if (isOpen && isAutoRate) {
      onRefreshLiveRate(false);
    }
  }, [isOpen, isAutoRate]);

  // Sync formData when parent config changes
  useEffect(() => {
    setFormData((prev) => {
      const mode =
        (config.exchangeRateMode || prev.exchangeRateMode) === 'manual' ||
        localStorage.getItem('vandali_exchange_rate_mode') === 'manual'
          ? 'manual'
          : 'auto';
      if (mode === 'manual' && !config.forceAdminOverride) {
        return {
          ...config,
          exchangeRateMode: 'manual',
          exchangeRateBs:
            prev.exchangeRateBs && prev.exchangeRateBs > 100
              ? prev.exchangeRateBs
              : (config.exchangeRateBs && config.exchangeRateBs > 100 ? config.exchangeRateBs : SAFE_DEFAULT_EXCHANGE_RATE),
          rateSource: 'manual',
          lastRateUpdate: prev.lastRateUpdate || 'Fijada manualmente por el administrador',
        };
      }
      return {
        ...config,
        exchangeRateMode: 'auto',
        exchangeRateBs:
          config.exchangeRateBs && config.exchangeRateBs > 100
            ? config.exchangeRateBs
            : SAFE_DEFAULT_EXCHANGE_RATE,
      };
    });
  }, [config]);

  // --- EMPLOYEE DISCOUNT CONFIRMATION MODAL STATE ---
  const [confirmDiscountTarget, setConfirmDiscountTarget] = useState<
    | { order: OrderRecord; percent: number }
    | { isPos: true; percent: number }
    | null
  >(null);

  // --- ORDER EDITING (MODIFICAR COMANDAS) STATE ---
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [editingItems, setEditingItems] = useState<CartItem[]>([]);
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [editingCustomerPhone, setEditingCustomerPhone] = useState('');
  const [editingTableNumber, setEditingTableNumber] = useState('');
  const [editingAddress, setEditingAddress] = useState('');
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod>('pagomovil');
  const [editingDeliveryCostUSD, setEditingDeliveryCostUSD] = useState(0);
  const [editingTipUSD, setEditingTipUSD] = useState(0);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingApplyDiscount, setEditingApplyDiscount] = useState(false);
  const [editingStatus, setEditingStatus] = useState<OrderRecord['status']>('recibido');
  const [showAllHistoricalDays, setShowAllHistoricalDays] = useState(false);
  const [confirmSaveOrderModal, setConfirmSaveOrderModal] = useState(false);
  const [showEditHalfModal, setShowEditHalfModal] = useState(false);

  // Quick item addition helpers in Order Editor
  const [editSelectedPizzaId, setEditSelectedPizzaId] = useState<string>('');
  const [editSelectedPizzaSize, setEditSelectedPizzaSize] = useState<PizzaSize>('mediana');
  const [editSelectedPizzaSauce, setEditSelectedPizzaSauce] = useState<string>(
    COMPLIMENTARY_CRUST_SAUCES[0].name
  );
  const [editSelectedDrinkId, setEditSelectedDrinkId] = useState<string>('');
  const [editSelectedSalsaId, setEditSelectedSalsaId] = useState<string>('');
  const [editSelectedExtraId, setEditSelectedExtraId] = useState<string>('');
  const [editCustomItemName, setEditCustomItemName] = useState('');
  const [editCustomItemPrice, setEditCustomItemPrice] = useState<string>('');
  const [editSuccessToast, setEditSuccessToast] = useState<string | null>(null);

  // --- STATS FILTER STATE ---
  const [statFilter, setStatFilter] = useState<StatFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // --- POS / LOCAL ORDER STATE ---
  const [posOrderType, setPosOrderType] = useState<'mesa' | 'delivery' | 'pickup'>('mesa');
  const [posTable, setPosTable] = useState('Mesa 1');
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posDeliveryAddress, setPosDeliveryAddress] = useState('');
  const [posItems, setPosItems] = useState<
    {
      name: string;
      size?: PizzaSize;
      basePrice?: number;
      unitPrice: number;
      quantity: number;
      crustSauce?: string;
      type?: 'pizza' | 'item' | 'half-half';
      half1?: any;
      half2?: any;
      extras?: any[];
    }[]
  >([]);
  const [posPaymentMethod, setPosPaymentMethod] = useState<PaymentMethod>('pagomovil');
  const [posNotes, setPosNotes] = useState('');
  const [posApplyEmployeeDiscount, setPosApplyEmployeeDiscount] = useState(false);
  const [posSuccessMsg, setPosSuccessMsg] = useState(false);
  const [showPosHalfModal, setShowPosHalfModal] = useState(false);
  const [posTipUSD, setPosTipUSD] = useState<number>(0);
  const [posCustomTipInput, setPosCustomTipInput] = useState<string>('');
  const [posIsCustomTip, setPosIsCustomTip] = useState<boolean>(false);

  // --- ORDER STATUS CHANGE CONFIRMATION STATE ---
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    order: OrderRecord;
    newStatus: OrderRecord['status'];
  } | null>(null);

  // --- ORDERS MONITOR FILTERS ---
  const [ordersScope, setOrdersScope] = useState<'today' | 'yesterday' | 'all'>('today');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'recibido' | 'entregado' | 'cancelado'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // --- HISTORICAL CLOSING DETAILS STATE ---
  const [expandedClosingDate, setExpandedClosingDate] = useState<string | null>(null);

  // --- GOOGLE SHEETS & DATABASE STATE ---
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsSyncMsg, setSheetsSyncMsg] = useState<string | null>(null);
  const [showAppsScriptHelp, setShowAppsScriptHelp] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // --- THERMAL RECEIPT & CUENTA MODAL STATE ---
  const [orderToDelete, setOrderToDelete] = useState<OrderRecord | null>(null);
  const [activePrintOrder, setActivePrintOrder] = useState<{
    order: OrderRecord;
    type: TicketType;
  } | null>(null);
  const [receiptTab, setReceiptTab] = useState<'cuenta' | 'cocina'>('cuenta');
  const [selectedSplitCount, setSelectedSplitCount] = useState<number>(1);
  const [confirmedSplitCount, setConfirmedSplitCount] = useState<number>(1);
  const [showTicketViewer, setShowTicketViewer] = useState<boolean>(false);
  const [copiedSplitText, setCopiedSplitText] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  const handleCopySplitText = (order: OrderRecord, count: number) => {
    const totalUSD = order.totalUSD || 0;
    const rate = effectiveExchangeRate;
    const locationStr = order.origin === 'local_pos'
      ? order.tableNumber || 'Salón'
      : order.deliveryType === 'delivery'
      ? `Delivery (${order.zone || 'Domicilio'})`
      : 'Para Llevar';

    const breakdownLines: string[] = [];
    if (order.subtotalUSD && Math.abs(order.subtotalUSD - totalUSD) > 0.01) {
      breakdownLines.push(`Subtotal: ${formatUSD(order.subtotalUSD)}`);
    }
    if (order.discountUSD && order.discountUSD > 0) {
      breakdownLines.push(`Descuento: -${formatUSD(order.discountUSD)}`);
    }
    if (order.employeeDiscountUSD && order.employeeDiscountUSD > 0) {
      breakdownLines.push(`Desc. Empleado: -${formatUSD(order.employeeDiscountUSD)}`);
    }
    if (order.deliveryCostUSD && order.deliveryCostUSD > 0) {
      breakdownLines.push(`Delivery: +${formatUSD(order.deliveryCostUSD)}`);
    }
    if (order.tipUSD && Number(order.tipUSD) > 0) {
      breakdownLines.push(`Propina voluntaria: +${formatUSD(Number(order.tipUSD))}`);
    }
    const breakdownSection = breakdownLines.length > 0 ? `${breakdownLines.join('\n')}\n\n` : '';

    let text = '';
    if (count > 1) {
      const eachUSD = totalUSD / count;
      const eachBs = eachUSD * rate;
      text = `*VANDALI PIZZERÍA - CUENTA DIVIDIDA*
Comanda: #${order.id}
Ubicación: ${locationStr}
Cliente: ${order.customerName || 'Cliente'}

${breakdownSection}*TOTAL GENERAL:* ${formatUSD(totalUSD)} | ${formatBs(totalUSD, rate)}
*Dividido entre:* ${count} personas
*CADA PERSONA PAGA:*
*${formatUSD(eachUSD)} USD*  o  *${formatBs(eachUSD, rate)}*

¡Gracias por compartir con nosotros en Vandali!`;
    } else {
      text = `*VANDALI PIZZERÍA - RESUMEN DE CUENTA*
Comanda: #${order.id}
Ubicación: ${locationStr}
Cliente: ${order.customerName || 'Cliente'}

${breakdownSection}*TOTAL A PAGAR:*
*${formatUSD(totalUSD)} USD*  o  *${formatBs(totalUSD, rate)}*

¡Gracias por su visita a Vandali Pizzería!`;
    }

    navigator.clipboard.writeText(stripEmojis(text));
    setCopiedSplitText(true);
    setTimeout(() => setCopiedSplitText(false), 3000);
  };

  const handlePrintThermal = async (
    order: OrderRecord,
    type: TicketType,
    mode: 'bluetooth' | 'browser' | 'browser_graphic',
    splitPersons?: number
  ) => {
    setPrintFeedback(null);
    if (mode === 'bluetooth') {
      setIsBluetoothPrinting(true);
      setPrintFeedback('Conectando y enviando ticket térmico con fuente Plus Jakarta Sans...');
      try {
        const res = await printThermalBluetooth(order, type, config, splitPersons);
        setPrintFeedback(res.message);
        setTimeout(() => setPrintFeedback(null), 4000);
      } catch (err: any) {
        setPrintFeedback(err?.message || 'Error al conectar impresora Bluetooth.');
      } finally {
        setIsBluetoothPrinting(false);
      }
    } else if (mode === 'browser_graphic') {
      setPrintFeedback('Generando impresión gráfica en alta resolución...');
      try {
        await printThermalCanvasBrowser(order, type, config, splitPersons);
        setPrintFeedback('Ticket enviado al controlador del sistema.');
        setTimeout(() => setPrintFeedback(null), 3000);
      } catch (err: any) {
        setPrintFeedback('Error al generar la impresión gráfica.');
      }
    } else {
      setPrintFeedback('Enviando comanda a la impresora con fuente Plus Jakarta Sans...');
      try {
        await printThermalBrowser(order, type, config, splitPersons);
        setTimeout(() => setPrintFeedback(null), 3000);
      } catch (err: any) {
        setPrintFeedback('Error al enviar la comanda a la impresora.');
      }
    }
  };

  const handleExportReceiptImage = async (
    order: OrderRecord,
    type: TicketType,
    format: 'png' | 'jpg',
    splitPersons?: number
  ) => {
    setIsExportingImage(true);
    setPrintFeedback(`Generando archivo de imagen ${format.toUpperCase()}...`);
    try {
      await exportReceiptAsImage(order, type, config, format, splitPersons);
      setPrintFeedback(`¡${type === 'precuenta' ? 'Pre-Cuenta' : 'Comanda'} descargada como imagen ${format.toUpperCase()}!`);
      setTimeout(() => setPrintFeedback(null), 3500);
    } catch (err) {
      console.error('Error exporting receipt image:', err);
      setPrintFeedback('No se pudo generar la imagen del ticket.');
    } finally {
      setIsExportingImage(false);
    }
  };

  // --- EMPLOYEE DISCOUNT TOGGLE & CONFIRMATION ---
  const handleToggleEmployeeDiscount = (order: OrderRecord) => {
    const currentDiscount = order.employeeDiscountUSD || 0;
    if (currentDiscount > 0) {
      // Remove discount directly if already applied
      const subtotal = order.subtotalUSD || order.totalUSD;
      const regularDiscount = order.discountUSD || 0;
      const deliveryCost = order.deliveryCostUSD || 0;
      const totalUSD = Math.max(0, subtotal - regularDiscount + deliveryCost);
      const totalBs = totalUSD * effectiveExchangeRate;

      const updates: Partial<OrderRecord> = {
        employeeDiscountUSD: 0,
        employeeDiscountPercent: 0,
        totalUSD,
        totalBs,
      };

      if (onUpdateOrder) {
        onUpdateOrder(order.id, updates);
      } else {
        syncManager.updateOrder(order.id, updates);
      }
    } else {
      // Require explicit admin confirmation before applying
      setConfirmDiscountTarget({
        order,
        percent: config.employeeDiscountDefaultPercent || 20,
      });
    }
  };

  const handleApplyConfirmedEmployeeDiscount = () => {
    if (!confirmDiscountTarget) return;

    if ('isPos' in confirmDiscountTarget && confirmDiscountTarget.isPos) {
      setPosApplyEmployeeDiscount(true);
      setConfirmDiscountTarget(null);
      return;
    }

    if ('order' in confirmDiscountTarget && confirmDiscountTarget.order) {
      const order = confirmDiscountTarget.order;
      const discountPercent =
        confirmDiscountTarget.percent || config.employeeDiscountDefaultPercent || 20;
      const subtotal = order.subtotalUSD || order.totalUSD;
      const employeeDiscountUSD = (subtotal * discountPercent) / 100;
      const regularDiscount = order.discountUSD || 0;
      const deliveryCost = order.deliveryCostUSD || 0;

      const totalUSD = Math.max(
        0,
        subtotal - regularDiscount - employeeDiscountUSD + deliveryCost
      );
      const totalBs = totalUSD * effectiveExchangeRate;

      const updates: Partial<OrderRecord> = {
        employeeDiscountUSD,
        employeeDiscountPercent: discountPercent,
        totalUSD,
        totalBs,
      };

      if (onUpdateOrder) {
        onUpdateOrder(order.id, updates);
      } else {
        syncManager.updateOrder(order.id, updates);
      }
      setConfirmDiscountTarget(null);
    }
  };

  // --- ORDER EDITING (MODIFICAR COMANDAS) HANDLERS ---
  const handleStartEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setEditingCustomerName(order.customerName || '');
    setEditingCustomerPhone(order.customerPhone || '');
    setEditingTableNumber(order.tableNumber || '');
    setEditingAddress(order.address || '');
    setEditingPaymentMethod(order.paymentMethod || 'pagomovil');
    setEditingDeliveryCostUSD(order.deliveryCostUSD || 0);
    setEditingTipUSD(order.tipUSD || 0);
    setEditingNotes(
      order.paymentRef?.startsWith('Nota:')
        ? order.paymentRef.replace('Nota:', '').trim()
        : ''
    );
    setEditingApplyDiscount(Boolean(order.employeeDiscountUSD && order.employeeDiscountUSD > 0));
    setEditingStatus(order.status === 'preparando' || order.status === 'en_camino' ? 'recibido' : order.status);

    // Clone or reconstruct raw items
    if (order.rawItems && order.rawItems.length > 0) {
      setEditingItems(JSON.parse(JSON.stringify(order.rawItems)));
    } else {
      setEditingItems([
        {
          cartId: `edit-legacy-${Date.now()}`,
          id: 'legacy-item',
          name: order.itemsSummary || 'Comanda Original',
          unitPrice: order.subtotalUSD || order.totalUSD,
          quantity: 1,
          type: 'item',
          extras: [],
        },
      ]);
    }
  };

  const handleEditAddPizza = () => {
    if (!editSelectedPizzaId) return;
    const pizza = pizzas.find((p) => p.id === editSelectedPizzaId);
    if (!pizza) return;
    const unitPrice = getPizzaPrice(pizza, editSelectedPizzaSize);
    const newItem: CartItem = {
      cartId: `edit-pizza-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: pizza.id,
      name: pizza.name,
      type: 'pizza',
      size: editSelectedPizzaSize,
      unitPrice,
      quantity: 1,
      extras: [],
      crustSauce: editSelectedPizzaSauce,
    };
    setEditingItems((prev) => [...prev, newItem]);
    setEditSelectedPizzaId('');
  };

  const handleEditAddDrink = () => {
    if (!editSelectedDrinkId) return;
    const drink = drinks.find((d) => d.id === editSelectedDrinkId);
    if (!drink) return;
    const newItem: CartItem = {
      cartId: `edit-drink-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: drink.id,
      name: drink.name,
      type: 'item',
      unitPrice: drink.price,
      quantity: 1,
      extras: [],
    };
    setEditingItems((prev) => [...prev, newItem]);
    setEditSelectedDrinkId('');
  };

  const handleEditAddSalsa = () => {
    if (!editSelectedSalsaId) return;
    const salsa = salsas.find((s) => s.id === editSelectedSalsaId);
    if (!salsa) return;
    const newItem: CartItem = {
      cartId: `edit-salsa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: salsa.id,
      name: salsa.name,
      type: 'item',
      unitPrice: salsa.price,
      quantity: 1,
      extras: [],
    };
    setEditingItems((prev) => [...prev, newItem]);
    setEditSelectedSalsaId('');
  };

  const handleEditAddExtra = () => {
    if (!editSelectedExtraId) return;
    const extra = extras.find((e) => e.id === editSelectedExtraId);
    if (!extra) return;
    const newItem: CartItem = {
      cartId: `edit-extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: extra.id,
      name: extra.name,
      type: 'item',
      unitPrice: extra.price,
      quantity: 1,
      extras: [],
    };
    setEditingItems((prev) => [...prev, newItem]);
    setEditSelectedExtraId('');
  };

  const handleEditAddCustomItem = () => {
    if (!editCustomItemName.trim()) return;
    const price = Math.max(0, parseFloat(editCustomItemPrice.toString()) || 0);
    const newItem: CartItem = {
      cartId: `edit-custom-${Date.now()}`,
      id: `custom-${Date.now()}`,
      name: editCustomItemName.trim(),
      type: 'item',
      unitPrice: price,
      quantity: 1,
      extras: [],
    };
    setEditingItems((prev) => [...prev, newItem]);
    setEditCustomItemName('');
    setEditCustomItemPrice('');
  };

  const handleEditUpdateItemQuantity = (cartId: string, delta: number) => {
    setEditingItems((prev) =>
      prev
        .map((it) => {
          if (it.cartId === cartId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleEditRemoveItem = (cartId: string) => {
    setEditingItems((prev) => prev.filter((it) => it.cartId !== cartId));
  };

  // Live calculations for Order Editing
  const editingSubtotalUSD = useMemo(() => {
    return editingItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  }, [editingItems]);

  const editingDiscountPercent = editingApplyDiscount
    ? config.employeeDiscountDefaultPercent || 20
    : 0;

  const editingEmployeeDiscountUSD = (editingSubtotalUSD * editingDiscountPercent) / 100;
  const editingTotalUSD = Math.max(
    0,
    editingSubtotalUSD - editingEmployeeDiscountUSD + editingDeliveryCostUSD + (editingTipUSD || 0)
  );
  const editingTotalBs = editingTotalUSD * effectiveExchangeRate;

  const handleConfirmSaveEditedOrder = () => {
    if (!editingOrder) return;

    // Generate readable items summary
    const summary =
      editingItems
        .map((it) => {
          const typeLabel = it.type === 'half-half' ? `Mitad&Mitad (${it.name})` : it.name;
          const sizeLabel = it.size ? ` [${getPizzaSizeLabel(it.size)}]` : '';
          const sauceLabel = it.crustSauce ? ` [Bordes: ${it.crustSauce}]` : '';
          const extrasLabel =
            it.extras && it.extras.length > 0
              ? ` (+${it.extras.map((e) => e.name).join(', ')})`
              : '';
          return `${it.quantity}x ${typeLabel}${sizeLabel}${sauceLabel}${extrasLabel}`;
        })
        .join(' | ') || editingOrder.itemsSummary;

    const updatedData: Partial<OrderRecord> = {
      customerName: editingCustomerName.trim() || editingOrder.customerName,
      customerPhone: editingCustomerPhone.trim() || editingOrder.customerPhone,
      tableNumber: editingTableNumber.trim() || editingOrder.tableNumber,
      address: editingAddress.trim() || editingOrder.address,
      paymentMethod: editingPaymentMethod,
      status: editingStatus,
      paymentRef: editingNotes.trim() ? `Nota: ${editingNotes.trim()}` : editingOrder.paymentRef,
      itemsSummary: summary,
      rawItems: editingItems,
      subtotalUSD: editingSubtotalUSD,
      deliveryCostUSD: editingDeliveryCostUSD,
      tipUSD: editingTipUSD > 0 ? editingTipUSD : undefined,
      employeeDiscountUSD: editingEmployeeDiscountUSD > 0 ? editingEmployeeDiscountUSD : 0,
      employeeDiscountPercent: editingDiscountPercent > 0 ? editingDiscountPercent : 0,
      totalUSD: editingTotalUSD,
      totalBs: editingTotalBs,
    };

    if (onUpdateOrder) {
      onUpdateOrder(editingOrder.id, updatedData);
    } else {
      syncManager.updateOrder(editingOrder.id, updatedData);
    }

    setConfirmSaveOrderModal(false);
    setEditingOrder(null);
    setEditSuccessToast(`✅ Comanda #${editingOrder.id} modificada y sincronizada con éxito.`);
    setTimeout(() => setEditSuccessToast(null), 4000);
  };

  // --- GOOGLE SHEETS & CSV EXPORT HANDLERS ---
  const handleExportCSV = () => {
    downloadOrdersCSV(orders, `vandali_reporte_pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSyncGoogleSheets = async () => {
    if (!formData.googleSheetsWebhookUrl?.trim()) {
      setSheetsSyncMsg('⚠️ Por favor ingresa la URL de Webhook de Google Apps Script en la casilla de abajo.');
      setTimeout(() => setSheetsSyncMsg(null), 5000);
      return;
    }
    setIsSyncingSheets(true);
    setSheetsSyncMsg(null);
    try {
      const res = await fetch('/api/sync/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: formData.googleSheetsWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setSheetsSyncMsg(`✅ ¡${data.count || orders.length} órdenes sincronizadas con tu Google Sheet!`);
      } else {
        setSheetsSyncMsg(`⚠️ Advertencia: ${data.message || 'No se pudo conectar con el webhook.'}`);
      }
    } catch (err: any) {
      setSheetsSyncMsg(`❌ Error de conexión: ${err?.message || 'Error al sincronizar'}`);
    } finally {
      setIsSyncingSheets(false);
      setTimeout(() => setSheetsSyncMsg(null), 6000);
    }
  };

  const sampleAppsScript = `// === GOOGLE APPS SCRIPT PARA VANDALI PIZZERÍA ===
// Instrucciones:
// 1. En tu Google Sheets, abre Extensiones > Apps Script
// 2. Borra todo y pega este código
// 3. Haz clic en "Implementar" > "Nueva implementación"
// 4. Selecciona Tipo: "Aplicación web"
// 5. Configura "Quién tiene acceso": "Cualquier persona" (Anyone)
// 6. Haz clic en "Implementar" y copia la URL web que termina en /exec
// 7. Pega esa URL en el campo "Webhook de Google Sheets" en el Administrador de Vandali.

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Si la hoja está vacía, agregar encabezados con Fecha y Hora separadas
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID Pedido",
        "Fecha",
        "Hora",
        "Origen",
        "Cliente",
        "Teléfono",
        "Tipo",
        "Ubicación / Mesa",
        "Método de Pago",
        "Resumen de Ítems",
        "Subtotal ($)",
        "Descuento Empleado ($)",
        "Delivery ($)",
        "Total ($)",
        "Total (Bs)",
        "Estado",
        "Timestamp"
      ]);
      sheet.getRange("A1:Q1").setFontWeight("bold").setBackground("#B71C1C").setFontColor("#FFFFFF");
    }

    var data = JSON.parse(e.postData.contents);
    var order = data.order || data;
    var ts = order.timestamp ? new Date(order.timestamp) : new Date();
    var timeZone = Session.getScriptTimeZone() || "America/Caracas";
    var fechaStr = Utilities.formatDate(ts, timeZone, "dd/MM/yyyy");
    var horaStr = Utilities.formatDate(ts, timeZone, "hh:mm:ss a");

    sheet.appendRow([
      order.id || "",
      fechaStr,
      horaStr,
      order.origin === "local_pos" ? "POS Local" : "Web Online",
      order.customerName || "",
      order.customerPhone || "",
      order.deliveryType || "",
      order.tableNumber ? ("Mesa " + order.tableNumber) : (order.address || ""),
      order.paymentMethod || "",
      order.itemsSummary || "",
      order.subtotalUSD || 0,
      order.employeeDiscountUSD || 0,
      order.deliveryCostUSD || 0,
      order.totalUSD || 0,
      order.totalBs || 0,
      order.status || "",
      new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  // --- MENU EDITOR STATE: PIZZAS ---
  const [isAddingPizza, setIsAddingPizza] = useState(false);
  const [newPizzaName, setNewPizzaName] = useState('');
  const [newPizzaTagline, setNewPizzaTagline] = useState('');
  const [newPizzaDesc, setNewPizzaDesc] = useState('');
  const [newPizzaSauce, setNewPizzaSauce] = useState<'napolitana' | 'blanca'>('napolitana');
  const [newPizzaIngredients, setNewPizzaIngredients] = useState('');
  const [newPizzaPriceIndividual, setNewPizzaPriceIndividual] = useState(7.0);
  const [newPizzaPriceL, setNewPizzaPriceL] = useState(10.0);
  const [newPizzaPriceXL, setNewPizzaPriceXL] = useState(16.0);
  const [editingPizza, setEditingPizza] = useState<PizzaItem | null>(null);

  // --- MENU EDITOR STATE: GENERIC ITEM (DRINKS, SALSAS, EXTRAS) ---
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemVolume, setNewItemVolume] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(1.5);
  const [editingGenericItem, setEditingGenericItem] = useState<MenuItem | null>(null);

  // --- ADMIN SECURITY & PIN STATE ---
  const [customPinInput, setCustomPinInput] = useState('');
  const [customPinConfirm, setCustomPinConfirm] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string | null>(null);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const handleUpdateCustomPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);
    setPinChangeError(null);

    if (!customPinInput.trim() || customPinInput.length < 4) {
      setPinChangeError('El nuevo PIN debe tener al menos 4 dígitos.');
      return;
    }
    if (customPinInput !== customPinConfirm) {
      setPinChangeError('Las confirmaciones del nuevo PIN no coinciden.');
      return;
    }

    setIsUpdatingPin(true);
    try {
      const res = await updateAdminPin(customPinInput);
      if (res.success) {
        setPinChangeMsg('¡PIN de administrador actualizado con éxito!');
        setCustomPinInput('');
        setCustomPinConfirm('');
        setTimeout(() => setPinChangeMsg(null), 4000);
      } else {
        setPinChangeError(res.error || 'Error al actualizar PIN.');
      }
    } catch {
      setPinChangeError('Error inesperado al guardar el nuevo PIN.');
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleRestoreDefaultPin = () => {
    restoreDefaultAdminPin();
    setPinChangeMsg('PIN restaurado al valor predeterminado de fábrica (24682023).');
    setPinChangeError(null);
    setTimeout(() => setPinChangeMsg(null), 4000);
  };

  // Save config
  const handleSaveConfig = () => {
    const isManual = formData.exchangeRateMode === 'manual';
    const toSave: AdminConfig = {
      ...formData,
      exchangeRateMode: isManual ? 'manual' : 'auto',
      exchangeRateBs: isManual
        ? (formData.exchangeRateBs && formData.exchangeRateBs > 100 ? formData.exchangeRateBs : SAFE_DEFAULT_EXCHANGE_RATE)
        : effectiveExchangeRate,
      rateSource: isManual ? 'manual' : (config.rateSource || 'api_bcv'),
      lastRateUpdate: isManual ? 'Fijada manualmente por el administrador' : (config.lastRateUpdate || 'BCV Oficial'),
      forceAdminOverride: true,
    };
    if (isManual) {
      localStorage.setItem('vandali_exchange_rate_mode', 'manual');
      if (toSave.exchangeRateBs) {
        localStorage.setItem('vandali_manual_exchange_rate', toSave.exchangeRateBs.toString());
      }
    } else {
      localStorage.setItem('vandali_exchange_rate_mode', 'auto');
      localStorage.removeItem('vandali_manual_exchange_rate');
    }
    setFormData(toSave);
    onUpdateConfig(toSave);
    syncManager.updateConfig(toSave, true);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Helper to check if an order belongs to today
  const isOrderFromToday = (order: OrderRecord) => {
    const now = new Date();
    const orderDate = new Date(order.timestamp || Date.now());
    return (
      orderDate.getDate() === now.getDate() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getFullYear() === now.getFullYear()
    );
  };

  // Orders of today only for the Live Kitchen Monitor
  const ordersToday = useMemo(() => {
    return orders.filter(isOrderFromToday);
  }, [orders]);

  // Filtered orders for the Comandas tab (support Today, Yesterday, All, Status, and Search)
  const filteredComandas = useMemo(() => {
    let list = orders;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();

    if (ordersScope === 'today') {
      list = list.filter((o) => {
        const t = o.timestamp || Date.now();
        return t >= startOfToday && t <= endOfToday;
      });
    } else if (ordersScope === 'yesterday') {
      list = list.filter((o) => {
        const t = o.timestamp || Date.now();
        return t >= startOfYesterday && t <= endOfYesterday;
      });
    }

    if (orderStatusFilter !== 'all') {
      list = list.filter((o) => {
        if (orderStatusFilter === 'recibido') {
          return o.status === 'recibido' || o.status === 'preparando' || o.status === 'en_camino';
        }
        return o.status === orderStatusFilter;
      });
    }

    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        return (
          o.id?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customerPhone?.toLowerCase().includes(q) ||
          o.itemsSummary?.toLowerCase().includes(q) ||
          (o.tableNumber && o.tableNumber.toLowerCase().includes(q))
        );
      });
    }

    // Sort newest to oldest
    return [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [orders, ordersScope, orderStatusFilter, orderSearchQuery]);

  // --- STATS PERIOD DEFINITIONS & BOUNDARIES ---
  const statsPeriodInfo = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dayOfWeek = startOfToday.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const daysSinceMonday = (dayOfWeek + 6) % 7; // Lunes = 0, Martes = 1, ..., Domingo = 6

    // 3. Esta semana: desde el lunes hasta el domingo actual
    const mondayThisWeek = new Date(startOfToday);
    mondayThisWeek.setDate(startOfToday.getDate() - daysSinceMonday);
    mondayThisWeek.setHours(0, 0, 0, 0);

    const sundayThisWeek = new Date(mondayThisWeek);
    sundayThisWeek.setDate(mondayThisWeek.getDate() + 6);
    sundayThisWeek.setHours(23, 59, 59, 999);

    // 4. Semana pasada: desde el lunes hasta el domingo pasado
    const mondayLastWeek = new Date(mondayThisWeek);
    mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
    mondayLastWeek.setHours(0, 0, 0, 0);

    const sundayLastWeek = new Date(mondayLastWeek);
    sundayLastWeek.setDate(mondayLastWeek.getDate() + 6);
    sundayLastWeek.setHours(23, 59, 59, 999);

    // 5. Este mes: desde el 1ro del mes actual hasta el día final del mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 2. Ayer: 00:00:00 a 23:59:59.999
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(startOfYesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    let startMs = 0;
    let endMs = Infinity;
    let label = 'Hoy';
    let rangeText = '';

    const formatD = (d: Date) =>
      d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formatShort = (d: Date) =>
      d.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' });

    if (statFilter === 'today') {
      startMs = startOfToday.getTime();
      endMs = endOfToday.getTime();
      label = 'Hoy';
      rangeText = formatD(startOfToday);
    } else if (statFilter === 'yesterday') {
      startMs = startOfYesterday.getTime();
      endMs = endOfYesterday.getTime();
      label = 'Ayer';
      rangeText = formatD(startOfYesterday);
    } else if (statFilter === 'this_week' || statFilter === 'week') {
      startMs = mondayThisWeek.getTime();
      endMs = sundayThisWeek.getTime();
      label = 'Esta Semana';
      rangeText = `${formatShort(mondayThisWeek)} — ${formatShort(sundayThisWeek)}`;
    } else if (statFilter === 'last_week') {
      startMs = mondayLastWeek.getTime();
      endMs = sundayLastWeek.getTime();
      label = 'Semana Pasada';
      rangeText = `${formatShort(mondayLastWeek)} — ${formatShort(sundayLastWeek)}`;
    } else if (statFilter === 'this_month' || statFilter === 'month') {
      startMs = startOfMonth.getTime();
      endMs = endOfMonth.getTime();
      label = 'Este Mes';
      rangeText = `${formatD(startOfMonth)} al ${formatD(endOfMonth)}`;
    } else if (statFilter === 'custom') {
      if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-').map(Number);
        startMs = new Date(sy, (sm || 1) - 1, sd || 1, 0, 0, 0, 0).getTime();
      }
      if (customEndDate) {
        const [ey, em, ed] = customEndDate.split('-').map(Number);
        endMs = new Date(ey, (em || 1) - 1, ed || 1, 23, 59, 59, 999).getTime();
      }
      label = 'Personalizado';
      rangeText = `${customStartDate} al ${customEndDate}`;
    }

    return { startMs, endMs, label, rangeText };
  }, [statFilter, customStartDate, customEndDate]);

  // --- STATS FILTERING LOGIC ---
  const filteredOrders = useMemo(() => {
    const { startMs, endMs } = statsPeriodInfo;

    return orders.filter((o) => {
      if (o.status === 'cancelado') return false;
      const orderTime = o.timestamp || Date.now();
      return orderTime >= startMs && orderTime <= endMs;
    });
  }, [orders, statsPeriodInfo]);

  // Aggregate Stats (totalSalesBs sums the frozen historical totalBs per order)
  const totalSalesUSD = filteredOrders.reduce((sum, o) => sum + (o.totalUSD || 0), 0);
  const totalSalesBs = filteredOrders.reduce((sum, o) => {
    return sum + (o.totalBs || (o.totalUSD * effectiveExchangeRate));
  }, 0);
  const totalOrdersCount = filteredOrders.length;
  const averageTicketUSD = totalOrdersCount > 0 ? totalSalesUSD / totalOrdersCount : 0;

  // Breakdown by Origin
  const localOrdersCount = filteredOrders.filter(
    (o) => o.deliveryType === 'mesa' || o.origin === 'local_pos'
  ).length;
  const deliveryOrdersCount = filteredOrders.filter((o) => o.deliveryType === 'delivery').length;

  // Breakdown by Pizza Item / Size / Flavor
  const pizzaBreakdown = useMemo(() => {
    let totalPizzas = 0;
    const pizzaMap: Record<string, { count: number; name: string; size?: string }> = {};

    filteredOrders.forEach((o) => {
      if (o.rawItems && o.rawItems.length > 0) {
        o.rawItems.forEach((it) => {
          const qty = it.quantity || 1;
          if (it.type === 'pizza' || it.type === 'half-half' || it.size) {
            totalPizzas += qty;
            const sizeSuffix = it.size ? ` ${it.size}` : '';
            const key = `${it.name}${sizeSuffix}`.trim();
            if (!pizzaMap[key]) {
              pizzaMap[key] = { count: 0, name: it.name, size: it.size };
            }
            pizzaMap[key].count += qty;
          }
        });
      } else if (o.itemsSummary) {
        const parts = o.itemsSummary.split('|').map((p) => p.trim());
        parts.forEach((part) => {
          const match = part.match(/^(\d+)x\s+(.+)$/);
          if (match) {
            const qty = parseInt(match[1], 10) || 1;
            const name = match[2].trim();
            totalPizzas += qty;
            if (!pizzaMap[name]) {
              pizzaMap[name] = { count: 0, name };
            }
            pizzaMap[name].count += qty;
          }
        });
      }
    });

    const list = Object.entries(pizzaMap)
      .map(([key, val]) => ({
        key,
        name: val.name,
        size: val.size,
        count: val.count,
      }))
      .sort((a, b) => b.count - a.count);

    const summaryText =
      list.length > 0
        ? list.map((p) => `${p.count} ${p.name}${p.size ? ` ${p.size}` : ''}`).join(', ')
        : '0 pizzas';

    return {
      totalPizzas,
      list,
      summaryText,
    };
  }, [filteredOrders]);

  // Historical Daily Closings (Preserves the exact daily rate, orders array, and closing sum)
  const dailyClosingsHistory = useMemo(() => {
    const map: Record<
      string,
      {
        dateKey: string;
        displayDate: string;
        timestamp: number;
        ordersCount: number;
        cancelledCount: number;
        pizzasCount: number;
        pizzasSummary: string;
        totalUSD: number;
        totalBs: number;
        totalTipsUSD: number;
        orders: OrderRecord[];
        paymentBreakdown: {
          pagomovil: { count: number; totalUSD: number };
          zelle: { count: number; totalUSD: number };
          efectivo_usd: { count: number; totalUSD: number };
          binance: { count: number; totalUSD: number };
        };
        originBreakdown: {
          local_pos: { count: number; totalUSD: number };
          web_delivery: { count: number; totalUSD: number };
          web_pickup: { count: number; totalUSD: number };
        };
      }
    > = {};

    orders.forEach((o) => {
      const d = new Date(o.timestamp || Date.now());
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const displayDate = d.toLocaleDateString('es-VE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (!map[dateKey]) {
        map[dateKey] = {
          dateKey,
          displayDate,
          timestamp: d.getTime(),
          ordersCount: 0,
          cancelledCount: 0,
          pizzasCount: 0,
          pizzasSummary: '',
          totalUSD: 0,
          totalBs: 0,
          totalTipsUSD: 0,
          orders: [],
          paymentBreakdown: {
            pagomovil: { count: 0, totalUSD: 0 },
            zelle: { count: 0, totalUSD: 0 },
            efectivo_usd: { count: 0, totalUSD: 0 },
            binance: { count: 0, totalUSD: 0 },
          },
          originBreakdown: {
            local_pos: { count: 0, totalUSD: 0 },
            web_delivery: { count: 0, totalUSD: 0 },
            web_pickup: { count: 0, totalUSD: 0 },
          },
        };
      }

      map[dateKey].orders.push(o);

      if (o.status === 'cancelado') {
        map[dateKey].cancelledCount += 1;
        return; // Cancelled orders do NOT contribute to sales, counts, or payment breakdown
      }

      map[dateKey].ordersCount += 1;
      map[dateKey].totalUSD += o.totalUSD || 0;
      map[dateKey].totalBs += o.totalBs || (o.totalUSD * effectiveExchangeRate);
      if (o.tipUSD && o.tipUSD > 0) {
        map[dateKey].totalTipsUSD += o.tipUSD;
      }

      // Payment breakdown
      if (map[dateKey].paymentBreakdown[o.paymentMethod]) {
        map[dateKey].paymentBreakdown[o.paymentMethod].count += 1;
        map[dateKey].paymentBreakdown[o.paymentMethod].totalUSD += o.totalUSD || 0;
      }

      // Origin breakdown
      if (o.origin === 'local_pos' || o.deliveryType === 'mesa' || o.tableNumber) {
        map[dateKey].originBreakdown.local_pos.count += 1;
        map[dateKey].originBreakdown.local_pos.totalUSD += o.totalUSD || 0;
      } else if (o.deliveryType === 'delivery') {
        map[dateKey].originBreakdown.web_delivery.count += 1;
        map[dateKey].originBreakdown.web_delivery.totalUSD += o.totalUSD || 0;
      } else {
        map[dateKey].originBreakdown.web_pickup.count += 1;
        map[dateKey].originBreakdown.web_pickup.totalUSD += o.totalUSD || 0;
      }

      // Count pizzas for this day
      if (o.rawItems && o.rawItems.length > 0) {
        o.rawItems.forEach((it) => {
          if (it.type === 'pizza' || it.type === 'half-half' || it.size) {
            map[dateKey].pizzasCount += it.quantity || 1;
          }
        });
      }
    });

    const result = Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    // Sort individual orders from newest to oldest within each day
    result.forEach((day) => {
      day.orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });
    return result;
  }, [orders, effectiveExchangeRate]);

  // Displayed Daily Closings: filtered according to selected stats period (or all if toggled)
  const displayedDailyClosings = useMemo(() => {
    if (showAllHistoricalDays) return dailyClosingsHistory;
    const { startMs, endMs } = statsPeriodInfo;
    return dailyClosingsHistory.filter((day) => {
      return day.timestamp >= startMs && day.timestamp <= endMs;
    });
  }, [dailyClosingsHistory, showAllHistoricalDays, statsPeriodInfo]);

  // Breakdown by Payment Method
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { count: number; totalUSD: number }> = {
      pagomovil: { count: 0, totalUSD: 0 },
      zelle: { count: 0, totalUSD: 0 },
      efectivo_usd: { count: 0, totalUSD: 0 },
      binance: { count: 0, totalUSD: 0 },
    };

    filteredOrders.forEach((o) => {
      if (map[o.paymentMethod]) {
        map[o.paymentMethod].count += 1;
        map[o.paymentMethod].totalUSD += o.totalUSD;
      }
    });
    return map;
  }, [filteredOrders]);

  // --- POS HANDLERS ---
  const handleAddPosPizza = (pizza: PizzaItem, size: PizzaSize, crustSauce?: string) => {
    const basePrice = getPizzaPrice(pizza, size);
    const sizeLabel = getPizzaSizeLabel(size);
    const isInd = size === 'individual';
    // Individual pizzas do NOT include free sauce. Defaults to undefined (Sin salsa).
    // Mediana and Familiar include complimentary sauce by default.
    const sauce = crustSauce !== undefined ? crustSauce : (isInd ? undefined : COMPLIMENTARY_CRUST_SAUCES[0].name);
    const sauceExtra = (isInd && sauce && sauce !== 'sin_salsa') ? CRUST_SAUCE_EXTRA_PRICE : 0;
    const unitPrice = basePrice + sauceExtra;

    setPosItems([
      ...posItems,
      {
        name: `${pizza.name} [${sizeLabel}]`,
        size,
        basePrice,
        unitPrice,
        quantity: 1,
        crustSauce: sauce,
        type: 'pizza',
      },
    ]);
  };

  const handleAddPosHalfAndHalf = (item: CartItem) => {
    const isInd = item.size === 'individual';
    const sauceExtra = (isInd && item.crustSauce && item.crustSauce !== 'sin_salsa') ? CRUST_SAUCE_EXTRA_PRICE : 0;
    const basePrice = item.unitPrice - sauceExtra;
    setPosItems((prev) => [
      ...prev,
      {
        name: item.name,
        size: item.size,
        basePrice,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        crustSauce: item.crustSauce,
        type: 'half-half',
        half1: item.half1,
        half2: item.half2,
        extras: item.extras,
      },
    ]);
  };

  const handleAddPosGenericItem = (item: MenuItem) => {
    const existingIndex = posItems.findIndex((it) => it.name === item.name);
    if (existingIndex >= 0) {
      const updated = [...posItems];
      updated[existingIndex].quantity += 1;
      setPosItems(updated);
    } else {
      setPosItems([...posItems, { name: item.name, unitPrice: item.price, quantity: 1, type: 'item' }]);
    }
  };

  const handleCreateLocalOrder = () => {
    if (posItems.length === 0) return;

    const subtotal = posItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
    const summaryItems = posItems.map((it) => {
      const typeLabel = it.type === 'half-half' ? `Mitad & Mitad (${it.name})` : it.name;
      const isInd = it.size === 'individual';
      const sauceLabel = it.crustSauce
        ? ` [Salsa: ${it.crustSauce}${isInd ? ` (+${formatUSD(CRUST_SAUCE_EXTRA_PRICE)})` : ''}]`
        : '';
      const extrasLabel = it.extras && it.extras.length > 0 ? ` (+${it.extras.map((e: any) => e.name).join(', ')})` : '';
      return `${it.quantity}x ${typeLabel}${sauceLabel}${extrasLabel}`;
    });

    if (posTipUSD > 0) {
      summaryItems.push(`1x Propina voluntaria (Servicio) (+${formatUSD(posTipUSD)})`);
    }

    const summary = summaryItems.join(' | ');

    const rawPosItems: CartItem[] = posItems.map((it, idx) => ({
      cartId: `pos-${idx}-${Date.now()}`,
      type: it.type || (it.size ? 'pizza' : 'item'),
      id: `pos-item-${idx}`,
      name: it.name,
      size: it.size,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      extras: it.extras || [],
      crustSauce: it.crustSauce,
      half1: it.half1,
      half2: it.half2,
      notes: posNotes.trim() || undefined,
    }));

    const isDelivery = posOrderType === 'delivery' || posTable.toLowerCase().includes('delivery');
    const isPickup = posOrderType === 'pickup' || posTable.toLowerCase().includes('pick up') || posTable.toLowerCase().includes('pickup');

    const deliveryCostUSD = isDelivery ? calculateDeliveryCost(subtotal, 'delivery', config) : 0;
    const employeeDiscountPercent = posApplyEmployeeDiscount ? (config.employeeDiscountDefaultPercent || 20) : 0;
    const employeeDiscountUSD = (subtotal * employeeDiscountPercent) / 100;
    const totalUSD = Math.max(0, subtotal - employeeDiscountUSD + deliveryCostUSD + (posTipUSD || 0));

    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    const idPrefix = isDelivery ? 'DEL' : (isPickup ? 'PCK' : 'MES');
    const newLocalOrder: OrderRecord = {
      id: `${idPrefix}-${Date.now().toString().slice(-4)}`,
      date: `${formattedDate} ${formattedTime}`,
      timestamp: Date.now(),
      customerName: posCustomerName.trim() || (isDelivery ? `Cliente Delivery (${posTable})` : `Cliente (${posTable})`),
      customerPhone: posCustomerPhone.trim() || (isDelivery ? 'Delivery' : 'En Salón'),
      deliveryType: isDelivery ? 'delivery' : (isPickup ? 'pickup' : 'mesa'),
      tableNumber: isDelivery || isPickup ? undefined : posTable,
      zone: isDelivery ? (posDeliveryAddress.trim() || posTable) : undefined,
      address: isDelivery 
        ? (posDeliveryAddress.trim() || `Delivery Vandali - ${posTable}`) 
        : (isPickup ? 'Para Llevar / Pick-up' : `Salón Vandali - ${posTable}`),
      paymentMethod: posPaymentMethod,
      paymentRef: posNotes ? `Nota: ${posNotes}` : (isDelivery ? 'Comanda Delivery' : 'Comanda en mesa'),
      itemsSummary: summary,
      rawItems: rawPosItems,
      subtotalUSD: subtotal,
      deliveryCostUSD,
      tipUSD: posTipUSD > 0 ? Number(posTipUSD) : 0,
      discountUSD: 0,
      employeeDiscountUSD: employeeDiscountUSD > 0 ? employeeDiscountUSD : undefined,
      employeeDiscountPercent: employeeDiscountPercent > 0 ? employeeDiscountPercent : undefined,
      totalUSD,
      totalBs: totalUSD * effectiveExchangeRate,
      origin: 'local_pos',
      status: 'preparando',
    };

    onAddLocalOrder(newLocalOrder);
    setPosItems([]);
    setPosCustomerName('');
    setPosCustomerPhone('');
    setPosDeliveryAddress('');
    setPosPaymentMethod('pagomovil');
    setPosNotes('');
    setPosTipUSD(0);
    setPosCustomTipInput('');
    setPosIsCustomTip(false);
    setPosApplyEmployeeDiscount(false);
    setPosSuccessMsg(true);
    // Open thermal print modal immediately for kitchen ticket & pre-cuenta
    setActivePrintOrder({ order: newLocalOrder, type: 'comanda' });
    setReceiptTab('cocina');
    setSelectedSplitCount(1);
    setConfirmedSplitCount(1);
    setShowTicketViewer(false);
    setTimeout(() => setPosSuccessMsg(false), 3500);
  };

  // --- MENU EDITOR HANDLERS: PIZZAS ---
  const handleTogglePizza = (id: string) => {
    const updated = pizzas.map((p) =>
      p.id === id ? { ...p, isAvailable: !p.isAvailable } : p
    );
    onUpdatePizzas(updated);
  };

  const handleUpdatePizzaPrice = (
    id: string,
    field: 'priceIndividual' | 'priceL' | 'priceXL' | 'name' | 'description',
    value: any
  ) => {
    const updated = pizzas.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    onUpdatePizzas(updated);
  };

  const handleStartEditPizza = (pizza: PizzaItem) => {
    setEditingPizza({ ...pizza, ingredients: [...pizza.ingredients] });
  };

  const handleSaveEditedPizza = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPizza || !editingPizza.name.trim()) return;

    const updated = pizzas.map((p) =>
      p.id === editingPizza.id
        ? {
            ...editingPizza,
            name: editingPizza.name.trim().toUpperCase(),
            tagline: editingPizza.tagline?.trim() || 'Especial Vandali',
            description: editingPizza.description?.trim() || '',
            priceIndividual: editingPizza.priceIndividual !== undefined ? Number(editingPizza.priceIndividual) : undefined,
            priceL: Number(editingPizza.priceL),
            priceXL: Number(editingPizza.priceXL),
          }
        : p
    );

    onUpdatePizzas(updated);
    setEditingPizza(null);
  };

  const handleCreateNewPizza = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPizzaName.trim()) return;

    const newP: PizzaItem = {
      id: `pizza-${Date.now()}`,
      name: newPizzaName.trim().toUpperCase(),
      tagline: newPizzaTagline.trim() || 'Especial Vandali',
      description:
        newPizzaDesc.trim() ||
        'Pizza estilo napolitano con masa de fermentación lenta de al menos 48 horas.',
      sauce: newPizzaSauce,
      ingredients: newPizzaIngredients
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean),
      priceIndividual: Number(newPizzaPriceIndividual),
      priceL: Number(newPizzaPriceL),
      priceXL: Number(newPizzaPriceXL),
      isAvailable: true,
    };

    onUpdatePizzas([...pizzas, newP]);
    setIsAddingPizza(false);
    setNewPizzaName('');
    setNewPizzaTagline('');
    setNewPizzaDesc('');
    setNewPizzaIngredients('');
  };

  const handleDeletePizza = (id: string) => {
    onUpdatePizzas(pizzas.filter((p) => p.id !== id));
  };

  // --- MENU EDITOR HANDLERS: DRINKS, SALSAS, EXTRAS ---
  const getActiveGenericList = (): MenuItem[] => {
    if (catalogSubTab === 'bebidas') return drinks;
    if (catalogSubTab === 'salsas') return salsas;
    return extras;
  };

  const updateActiveGenericList = (newList: MenuItem[]) => {
    if (catalogSubTab === 'bebidas') onUpdateDrinks(newList);
    else if (catalogSubTab === 'salsas') onUpdateSalsas(newList);
    else onUpdateExtras(newList);
  };

  const handleToggleGenericItem = (id: string) => {
    const list = getActiveGenericList();
    const updated = list.map((item) =>
      item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
    );
    updateActiveGenericList(updated);
  };

  const handleUpdateGenericItemPrice = (id: string, price: number) => {
    const list = getActiveGenericList();
    const updated = list.map((item) => (item.id === id ? { ...item, price } : item));
    updateActiveGenericList(updated);
  };

  const handleStartEditGenericItem = (item: MenuItem) => {
    setEditingGenericItem({ ...item });
  };

  const handleSaveEditedGenericItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGenericItem || !editingGenericItem.name.trim()) return;

    const list = getActiveGenericList();
    const updated = list.map((item) =>
      item.id === editingGenericItem.id
        ? {
            ...editingGenericItem,
            name: editingGenericItem.name.trim(),
            description: editingGenericItem.description?.trim() || '',
            price: Number(editingGenericItem.price),
            volumeOrSize: editingGenericItem.volumeOrSize?.trim() || undefined,
          }
        : item
    );

    updateActiveGenericList(updated);
    setEditingGenericItem(null);
  };

  const handleDeleteGenericItem = (id: string) => {
    const list = getActiveGenericList();
    updateActiveGenericList(list.filter((item) => item.id !== id));
  };

  const handleCreateNewGenericItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const list = getActiveGenericList();
    const newItem: MenuItem = {
      id: `${catalogSubTab}-${Date.now()}`,
      name: newItemName.trim(),
      category: catalogSubTab,
      description: newItemDesc.trim() || 'Producto Vandali',
      price: Number(newItemPrice),
      volumeOrSize: newItemVolume.trim() || undefined,
      isAvailable: true,
    };

    updateActiveGenericList([...list, newItem]);
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemDesc('');
    setNewItemVolume('');
    setNewItemPrice(1.5);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl bg-[#0F0F0F] border-2 border-[#D4AF37]/30 shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#181818] via-[#121212] to-[#0A0A0A] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B71C1C] flex items-center justify-center text-white font-bold shadow-md">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-bold text-lg text-white font-serif"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  Módulo Administrativo & POS
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#D4AF37] text-black font-mono text-[10px] font-bold">
                  VANDALI PRO
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Estadísticas de venta, comandas de mesas, edición de menú y tasa en vivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onLogoutAdmin();
                onClose();
              }}
              title="Cerrar sesión de administrador"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-4 py-2 bg-[#0A0A0A] border-b border-white/10 text-xs">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'stats'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#181818]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
            <span>Estadísticas & Cierre</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'pos'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#181818]'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-[#D4AF37]" />
            <span>Comandas de Salón (POS)</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'orders'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#181818]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#D4AF37]" />
            <span>Monitor de Comandas ({ordersToday.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'menu'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#181818]'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Catálogo & Precios</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'config'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#181818]'
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#D4AF37]" />
            <span>Tasa & Ajustes</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
          {/* ==================================================== */}
          {/* TAB 1: ESTADÍSTICAS & CIERRE DE CAJA                 */}
          {/* ==================================================== */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Filter Buttons */}
              <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#141414] border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center text-xs font-bold text-[#D4AF37] mr-1">
                      <Filter className="w-3.5 h-3.5 mr-1" />
                      Filtro:
                    </div>
                    <button
                      onClick={() => setStatFilter('today')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'today'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setStatFilter('yesterday')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'yesterday'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Ayer
                    </button>
                    <button
                      onClick={() => setStatFilter('this_week')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'this_week' || statFilter === 'week'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => setStatFilter('last_week')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'last_week'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Semana pasada
                    </button>
                    <button
                      onClick={() => setStatFilter('this_month')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'this_month' || statFilter === 'month'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Este mes
                    </button>
                    <button
                      onClick={() => setStatFilter('custom')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statFilter === 'custom'
                          ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#1C1C1C] text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded bg-[#1C1C1C] border border-white/10 text-zinc-300">
                      📅 {statsPeriodInfo.label}: <strong className="text-[#D4AF37]">{statsPeriodInfo.rangeText}</strong>
                    </span>
                  </div>
                </div>

                {statFilter === 'custom' && (
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-zinc-400">Rango de fechas:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-white outline-none focus:border-[#D4AF37]"
                    />
                    <span className="text-zinc-500">hasta</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block font-mono">
                    FACTURACIÓN TOTAL
                  </span>
                  <div className="font-mono font-black text-2xl text-white">
                    {formatUSD(totalSalesUSD)}
                  </div>
                  <div className="font-mono text-xs text-[#D4AF37] font-semibold">
                    {formatBs(totalSalesUSD, effectiveExchangeRate)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">
                    COMANDAS COMPLETADAS
                  </span>
                  <div className="font-mono font-black text-2xl text-white">
                    {totalOrdersCount}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {deliveryOrdersCount} Delivery | {localOrdersCount} Mesas
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">
                    TICKET PROMEDIO
                  </span>
                  <div className="font-mono font-black text-2xl text-white">
                    {formatUSD(averageTicketUSD)}
                  </div>
                  <div className="font-mono text-xs text-zinc-400">por comanda</div>
                </div>

                <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">
                      TASA DE CAMBIO
                    </span>
                    <button
                      type="button"
                      onClick={() => onRefreshLiveRate(true)}
                      disabled={isUpdatingRate}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                      title="Sincronizar tasa oficial con BCV ahora"
                    >
                      <RefreshCw className={`w-3 h-3 ${isUpdatingRate ? 'animate-spin' : ''}`} />
                      <span>{isUpdatingRate ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                  </div>
                  <div className="font-mono font-black text-xl text-white">
                    {effectiveExchangeRate.toFixed(2)} Bs/$
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-between">
                    <span>{isAutoRate ? 'BCV Oficial (En vivo)' : 'Manual fijada'}</span>
                    <span className="text-zinc-400 font-mono text-[9px] truncate max-w-[120px]">
                      {config.lastRateUpdate || 'Al día'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Human-Readable Closing Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#1A1A1A] via-[#141414] to-[#1A1A1A] border border-[#D4AF37]/40 space-y-2">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-[#D4AF37]" />
                  <h4 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                    Resumen Detallado de Cierre ({statsPeriodInfo.label} — {statsPeriodInfo.rangeText})
                  </h4>
                </div>
                <div className="p-3 rounded-lg bg-[#0C0C0E] border border-white/10 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                  {totalOrdersCount === 0 ? (
                    <span className="text-zinc-500 italic">No se registraron ventas en este periodo.</span>
                  ) : (
                    <>
                      Se vendieron <strong className="text-white font-mono">{totalOrdersCount} comandas</strong> para un total de <strong className="text-[#D4AF37] font-mono">{pizzaBreakdown.totalPizzas} pizzas</strong>: {pizzaBreakdown.summaryText}.
                    </>
                  )}
                </div>

                {/* Grid breakdown of pizzas sold in this period */}
                {pizzaBreakdown.list.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2 font-mono">
                      Desglose por Especialidad & Tamaño
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {pizzaBreakdown.list.map((it) => (
                        <div
                          key={it.key}
                          className="p-2 rounded-lg bg-[#181818] border border-white/5 flex items-center justify-between gap-1"
                        >
                          <span className="text-xs font-semibold text-zinc-200 truncate" title={it.name}>
                            {it.name} {it.size ? `[${it.size}]` : ''}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#B71C1C] text-white text-[11px] font-mono font-bold shrink-0">
                            {it.count}x
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods Breakdown */}
              <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-3">
                <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#D4AF37]" /> Desglose por Método de Pago
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#181818] border border-white/5 space-y-1">
                    <span className="text-zinc-400 block">Pago Móvil</span>
                    <span className="font-mono font-bold text-white block">
                      {formatUSD(paymentBreakdown.pagomovil.totalUSD)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {paymentBreakdown.pagomovil.count} pedidos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#181818] border border-white/5 space-y-1">
                    <span className="text-zinc-400 block">Zelle USD</span>
                    <span className="font-mono font-bold text-white block">
                      {formatUSD(paymentBreakdown.zelle.totalUSD)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {paymentBreakdown.zelle.count} pedidos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#181818] border border-white/5 space-y-1">
                    <span className="text-zinc-400 block">Efectivo USD</span>
                    <span className="font-mono font-bold text-white block">
                      {formatUSD(paymentBreakdown.efectivo_usd.totalUSD)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {paymentBreakdown.efectivo_usd.count} pedidos
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#181818] border border-white/5 space-y-1">
                    <span className="text-zinc-400 block">Binance Pay</span>
                    <span className="font-mono font-bold text-white block">
                      {formatUSD(paymentBreakdown.binance.totalUSD)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {paymentBreakdown.binance.count} pedidos
                    </span>
                  </div>
                </div>
              </div>

              {/* Historical Daily Closings Section with Clickable Order Breakdown */}
              <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#D4AF37]" /> Cierres Diarios
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                        {showAllHistoricalDays ? 'Todos' : statsPeriodInfo.label} ({displayedDailyClosings.length} {displayedDailyClosings.length === 1 ? 'día' : 'días'})
                      </span>
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Haz clic sobre cualquier fecha para ver, auditar o modificar pedidos de ese día
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAllHistoricalDays(!showAllHistoricalDays)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1F1F24] hover:bg-[#2A2A32] text-xs font-bold text-zinc-300 border border-white/10 hover:border-[#D4AF37]/40 transition-all flex items-center gap-1.5"
                    >
                      {showAllHistoricalDays ? (
                        <>
                          <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Filtrar por {statsPeriodInfo.label}</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Ver Todo el Histórico</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {displayedDailyClosings.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-xl bg-[#181818] border border-white/5 space-y-2">
                    <p className="text-xs text-zinc-400">
                      No hay cierres ni comandas registradas en el período <strong>{statsPeriodInfo.label}</strong> ({statsPeriodInfo.rangeText}).
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAllHistoricalDays(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#B71C1C] hover:bg-[#c62828] text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Ver todos los cierres históricos ({dailyClosingsHistory.length} días)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedDailyClosings.map((day) => {
                      const isExpanded = expandedClosingDate === day.dateKey;
                      const averageTicket = day.ordersCount > 0 ? day.totalUSD / day.ordersCount : 0;

                      return (
                        <div
                          key={day.dateKey}
                          className={`rounded-xl border transition-all overflow-hidden ${
                            isExpanded
                              ? 'bg-[#18181C] border-[#D4AF37]/50 shadow-lg shadow-black/40'
                              : 'bg-[#181818] border-white/10 hover:border-[#D4AF37]/30'
                          }`}
                        >
                          {/* Clickable Header Row */}
                          <button
                            type="button"
                            onClick={() => setExpandedClosingDate(isExpanded ? null : day.dateKey)}
                            className="w-full p-3.5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors hover:bg-white/[0.02]"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white text-sm capitalize flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  {day.displayDate}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold">
                                  {day.ordersCount} {day.ordersCount === 1 ? 'comanda' : 'comandas'}
                                </span>
                                {day.cancelledCount > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 text-[10px] font-mono font-bold">
                                    {day.cancelledCount} {day.cancelledCount === 1 ? 'anulada' : 'anuladas'}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-[#B71C1C]/20 border border-[#B71C1C]/40 text-[#D4AF37] text-[10px] font-mono font-bold">
                                  {day.pizzasCount} {day.pizzasCount === 1 ? 'pizza' : 'pizzas'}
                                </span>
                                {day.totalTipsUSD > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-[10px] font-mono font-bold">
                                    Propinas: {formatUSD(day.totalTipsUSD)}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-mono">
                                  Ticket Prom: {formatUSD(averageTicket)}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {isExpanded
                                  ? 'Mostrando desglose completo de comandas y pagos ↓'
                                  : 'Toca aquí para ver todos los pedidos y clientes de este día'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 sm:text-right">
                              <div>
                                <span className="font-mono font-extrabold text-sm text-white block">
                                  {formatUSD(day.totalUSD)}
                                </span>
                                <span className="font-mono text-[11px] text-[#D4AF37] block font-semibold">
                                  Bs. {day.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                                  isExpanded
                                    ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                                    : 'bg-zinc-800 text-zinc-300 border-white/10'
                                }`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Expanded Day Breakdown Body */}
                          {isExpanded && (
                            <div className="p-4 border-t border-white/10 bg-[#121215] space-y-4 animate-in fade-in duration-200">
                              {/* Day Sub-Metrics Bar */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-white/5 space-y-0.5">
                                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                                    Pago Móvil
                                  </span>
                                  <span className="font-mono font-bold text-white text-xs block">
                                    {formatUSD(day.paymentBreakdown.pagomovil.totalUSD)}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {day.paymentBreakdown.pagomovil.count} pedidos
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-white/5 space-y-0.5">
                                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                                    Zelle USD
                                  </span>
                                  <span className="font-mono font-bold text-white text-xs block">
                                    {formatUSD(day.paymentBreakdown.zelle.totalUSD)}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {day.paymentBreakdown.zelle.count} pedidos
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-white/5 space-y-0.5">
                                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                                    Efectivo $
                                  </span>
                                  <span className="font-mono font-bold text-white text-xs block">
                                    {formatUSD(day.paymentBreakdown.efectivo_usd.totalUSD)}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {day.paymentBreakdown.efectivo_usd.count} pedidos
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-white/5 space-y-0.5">
                                  <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                                    Binance USDT
                                  </span>
                                  <span className="font-mono font-bold text-white text-xs block">
                                    {formatUSD(day.paymentBreakdown.binance.totalUSD)}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {day.paymentBreakdown.binance.count} pedidos
                                  </span>
                                </div>
                              </div>

                              {/* Action Bar for this Specific Day */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-white/5 pb-3">
                                <div className="flex items-center gap-2 text-xs text-zinc-300">
                                  <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  <span className="font-bold">
                                    Comandas Registradas ({day.orders.length})
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadOrdersCSV(day.orders, `vandali_cierre_${day.dateKey}.csv`);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#1F1F24] hover:bg-[#2A2A32] text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  <span>Exportar Pedidos del Día (Excel / CSV)</span>
                                </button>
                              </div>

                              {/* Individual Orders List for This Day */}
                              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                                {day.orders.map((o) => {
                                  const orderTime = o.date?.includes(' ')
                                    ? o.date.split(' ').slice(1).join(' ')
                                    : o.timestamp
                                    ? new Date(o.timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                                    : o.date;

                                  return (
                                    <div
                                      key={o.id}
                                      className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                                        o.status === 'cancelado'
                                          ? 'bg-[#0E0B0D] border-rose-900/40 opacity-80'
                                          : 'bg-[#0D0D10] border-white/10 hover:border-white/20'
                                      }`}
                                    >
                                      {/* Order Left: ID, Table/Delivery, Customer, Items */}
                                      <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono font-extrabold text-[#D4AF37] text-xs sm:text-sm">
                                            #{o.id}
                                          </span>

                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                              o.deliveryType === 'mesa' || o.tableNumber
                                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                                : o.deliveryType === 'delivery'
                                                ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                            }`}
                                          >
                                            {o.deliveryType === 'mesa' || o.tableNumber
                                              ? `Mesa ${o.tableNumber || 'S/N'}`
                                              : o.deliveryType === 'delivery'
                                              ? 'Delivery'
                                              : 'Pick-up'}
                                          </span>

                                          {o.status === 'cancelado' && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-950 border border-rose-800 text-rose-300">
                                              ANULADA / NO COBRADA
                                            </span>
                                          )}

                                          {o.customerName && (
                                            <span className="font-bold text-white truncate text-xs">
                                              {o.customerName}
                                            </span>
                                          )}

                                          {o.customerPhone && o.customerPhone !== 'En Salón' && (
                                            <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                                              <Phone className="w-3 h-3 text-zinc-500" />
                                              {o.customerPhone}
                                            </span>
                                          )}

                                          <span className="text-[10.5px] text-zinc-500 font-mono ml-auto sm:ml-0 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {orderTime}
                                          </span>
                                        </div>

                                        {/* Items Summary Breakdown */}
                                        <div className="text-xs text-zinc-200">
                                          {o.rawItems && o.rawItems.length > 0 ? (
                                            <div className="space-y-0.5">
                                              {o.rawItems.map((it, idx) => (
                                                <div
                                                  key={it.cartId || idx}
                                                  className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-200"
                                                >
                                                  <span className="font-mono font-bold text-[#D4AF37]">
                                                    {it.quantity}x
                                                  </span>
                                                  <span className="font-semibold text-white">
                                                    {it.type === 'half-half'
                                                      ? `Mitad & Mitad (${it.name})`
                                                      : it.name}
                                                  </span>
                                                  {it.size && (
                                                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono font-bold text-zinc-300">{getPizzaSizeLabel(it.size)}</span>
                                                  )}
                                                  {it.crustSauce && (
                                                    <span className="text-[11px] text-amber-300/90 font-medium">
                                                      • Salsa: {it.crustSauce}
                                                    </span>
                                                  )}
                                                  {it.extras && it.extras.length > 0 && (
                                                    <span className="text-[11px] text-zinc-400">
                                                      • Extras: {it.extras.map((e) => e.name).join(', ')}
                                                    </span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-zinc-300 leading-relaxed">
                                              {o.itemsSummary}
                                            </p>
                                          )}
                                        </div>

                                        {/* Financial Breakdown line */}
                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 font-mono pt-1">
                                          <span>Subtotal: {formatUSD(o.subtotalUSD || o.totalUSD)}</span>
                                          {((o.discountUSD || 0) > 0 || (o.employeeDiscountUSD || 0) > 0) && (
                                            <span className="text-emerald-400">
                                              Desc: -{formatUSD((o.discountUSD || 0) + (o.employeeDiscountUSD || 0))}
                                            </span>
                                          )}
                                          {(o.deliveryCostUSD || 0) > 0 && (
                                            <span>Delivery: {formatUSD(o.deliveryCostUSD)}</span>
                                          )}
                                          {o.tipUSD && o.tipUSD > 0 && (
                                            <span className="text-emerald-400 font-semibold">
                                              Propina: +{formatUSD(o.tipUSD)}
                                            </span>
                                          )}
                                          <span className="capitalize px-1.5 py-0.2 rounded bg-zinc-900 border border-white/5 text-zinc-300">
                                            {o.paymentMethod === 'pagomovil'
                                              ? 'Pago Móvil'
                                              : o.paymentMethod === 'efectivo_usd'
                                              ? 'Efectivo $'
                                              : o.paymentMethod === 'zelle'
                                              ? 'Zelle'
                                              : 'Binance'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Order Right: Financial Total, Status & Action Buttons */}
                                      <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-2 shrink-0 border-t md:border-t-0 border-white/5 pt-2 md:pt-0">
                                        <div className="text-left md:text-right">
                                          <span
                                            className={`font-mono font-extrabold text-sm block ${
                                              o.status === 'cancelado' ? 'text-zinc-500 line-through' : 'text-white'
                                            }`}
                                          >
                                            {formatUSD(o.totalUSD)}
                                          </span>
                                          <span
                                            className={`font-mono text-[10.5px] block font-semibold ${
                                              o.status === 'cancelado' ? 'text-zinc-600 line-through' : 'text-[#D4AF37]'
                                            }`}
                                          >
                                            Bs. {(o.totalBs || (o.totalUSD * effectiveExchangeRate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                          {o.tipUSD && o.tipUSD > 0 && o.status !== 'cancelado' && (
                                            <span className="font-mono text-[9.5px] text-emerald-400 block">
                                              Propina: +{formatUSD(o.tipUSD)}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {/* Botón Editar Comanda Pasada */}
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditOrder(o)}
                                            className="px-2 py-1 rounded-lg bg-[#1F1F24] hover:bg-[#D4AF37] hover:text-black text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all active:scale-95"
                                            title="Editar esta comanda pasada (modificar productos, datos o anular)"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                            <span>Editar</span>
                                          </button>

                                          {/* Print / View Receipt Button */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActivePrintOrder({
                                                order: o,
                                                type: o.deliveryType === 'mesa' ? 'pre_cuenta' : 'comanda',
                                              });
                                              setReceiptTab('cuenta');
                                              setSelectedSplitCount(1);
                                              setConfirmedSplitCount(1);
                                              setShowTicketViewer(true);
                                            }}
                                            className="px-2 py-1 rounded-lg bg-[#1F1F24] hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                                            title="Ver o imprimir Ticket Térmico / Pre-cuenta"
                                          >
                                            <Printer className="w-3 h-3 text-[#D4AF37]" />
                                            <span>Ticket</span>
                                          </button>

                                          {/* Status Selector with Confirmation Modal */}
                                          <select
                                            value={o.status === 'preparando' || o.status === 'en_camino' ? 'recibido' : o.status}
                                            onChange={(e) => {
                                              const newStatus = e.target.value as OrderRecord['status'];
                                              if (newStatus !== o.status) {
                                                setPendingStatusChange({ order: o, newStatus });
                                              }
                                            }}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold outline-none border transition-colors cursor-pointer ${
                                              o.status === 'entregado'
                                                ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300'
                                                : o.status === 'cancelado'
                                                ? 'bg-rose-950/80 border-rose-600/50 text-rose-300'
                                                : 'bg-amber-950/80 border-amber-600/50 text-amber-300'
                                            }`}
                                            title="Cambiar estado de la orden (requiere confirmación)"
                                          >
                                            <option value="recibido" className="bg-[#18181B] text-white">Recibido</option>
                                            <option value="entregado" className="bg-[#18181B] text-white">Entregado</option>
                                            <option value="cancelado" className="bg-[#18181B] text-white">Anulado / Cancelado</option>
                                          </select>

                                          {/* Eliminar Comanda Pasada */}
                                          {onDeleteOrder && (
                                            <button
                                              type="button"
                                              onClick={() => setOrderToDelete(o)}
                                              title="Eliminar comanda permanentemente"
                                              className="p-1 rounded-lg bg-zinc-900 hover:bg-rose-950/80 text-zinc-500 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-all active:scale-95"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: POS COMANDAS DE SALÓN / MESAS                 */}
          {/* ==================================================== */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Quick Menu Items Picker */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
                    Seleccionar Ítems del Menú
                  </h4>
                  <span className="text-xs text-zinc-400">Clic para agregar</span>
                </div>

                {/* Pizzas */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#D4AF37] uppercase font-mono">
                      Pizzas Artesanales
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      L (30cm) / XL (40cm)
                    </span>
                  </div>

                  {/* Botón Destacado: Pizza Mitad y Mitad */}
                  <button
                    type="button"
                    onClick={() => setShowPosHalfModal(true)}
                    className="w-full p-3 rounded-xl bg-gradient-to-r from-[#201A12] via-[#2A2218] to-[#1E1710] hover:from-[#2A2218] hover:to-[#352B1E] border border-[#D4AF37]/50 hover:border-[#D4AF37] text-left transition-all shadow-md group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-105 transition-transform">
                        <Split className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-[#D4AF37] transition-colors">
                          Armar Pizza Mitad y Mitad (2 Sabores)
                        </span>
                        <span className="text-[10.5px] text-zinc-300 block">
                          Elige 2 especialidades, tamaño L o XL, salsas para bordes y extras
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-[#D4AF37] group-hover:bg-[#e2bd46] text-black font-extrabold text-[11px] shrink-0 shadow-sm flex items-center gap-1">
                      + Armar
                    </span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pizzas.map((p) => {
                      const isAvailable = p.isAvailable !== false;
                      return (
                        <div
                          key={p.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isAvailable
                              ? 'bg-[#141414] border-white/10'
                              : 'bg-[#181111] border-rose-900/40'
                          }`}
                        >
                          <div className="truncate flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-xs text-white block truncate">
                                {p.name}
                              </span>
                              {!isAvailable && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/40 text-rose-300 text-[8.5px] font-mono font-bold shrink-0">
                                  Oculta en Web
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono block">
                              Ind: {formatUSD(p.priceIndividual ?? p.priceL)} | Med: {formatUSD(p.priceL)} | Fam: {formatUSD(p.priceXL)}
                            </span>
                          </div>

                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddPosPizza(p, 'individual')}
                              className="px-1.5 py-1 rounded bg-[#1C1C1C] hover:bg-[#B71C1C] text-[10px] font-bold text-white transition-colors"
                              title="Individual (20cm)"
                            >
                              + Ind
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddPosPizza(p, 'mediana')}
                              className="px-1.5 py-1 rounded bg-[#1C1C1C] hover:bg-[#B71C1C] text-[10px] font-bold text-white transition-colors"
                              title="Mediana (30cm)"
                            >
                              + Med
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddPosPizza(p, 'familiar')}
                              className="px-1.5 py-1 rounded bg-[#1C1C1C] hover:bg-[#B71C1C] text-[10px] font-bold text-white transition-colors"
                              title="Familiar (40cm)"
                            >
                              + Fam
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Drinks */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-[#D4AF37] uppercase font-mono">
                    Bebidas
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {drinks.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddPosGenericItem(item)}
                        className="p-2 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 text-left transition-all"
                      >
                        <div className="font-bold text-xs text-white truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#D4AF37]">
                          {formatUSD(item.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extras & Toppings */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-[#D4AF37] uppercase font-mono">
                    Extras & Toppings
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {extras.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddPosGenericItem(item)}
                        className="p-2 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-white/10 text-left transition-all"
                      >
                        <div className="font-bold text-xs text-white truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#D4AF37]">
                          {formatUSD(item.price)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Active Table Ticket Builder */}
              <div className="lg:col-span-5 bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {(() => {
                    const isPosDelivery = posOrderType === 'delivery' || posTable.toLowerCase().includes('delivery');
                    const posItemsSubtotal = posItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
                    const freeThreshold = config.freeDeliveryThresholdUSD || 10.0;
                    const standardPrice = config.standardDeliveryPriceUSD || 1.5;
                    const isFree = posItemsSubtotal > freeThreshold;

                    return (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                          <h4 className="font-bold text-sm text-white font-serif flex items-center gap-1.5">
                            {isPosDelivery ? (
                              <Truck className="w-4 h-4 text-amber-400" />
                            ) : posOrderType === 'pickup' || posTable.startsWith('Pick up') ? (
                              <span>🛍️</span>
                            ) : (
                              <UtensilsCrossed className="w-4 h-4 text-rose-400" />
                            )}
                            <span>
                              {isPosDelivery
                                ? 'Nueva Comanda Delivery'
                                : posOrderType === 'pickup' || posTable.startsWith('Pick up')
                                ? 'Nueva Comanda Para Llevar'
                                : 'Nueva Comanda de Salón'}
                            </span>
                          </h4>
                          {posSuccessMsg && (
                            <span className="text-xs text-emerald-400 font-bold animate-pulse">
                              Comanda enviada a cocina
                            </span>
                          )}
                        </div>

                        {/* Selector Rápido de Tipo de Comanda */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1A1A1E] rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setPosOrderType('mesa');
                              if (!posTable.startsWith('Mesa') && !posTable.startsWith('Espera')) {
                                setPosTable('Mesa 1');
                              }
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              posOrderType === 'mesa' && !posTable.startsWith('Delivery') && !posTable.startsWith('Pick up')
                                ? 'bg-[#B71C1C] text-white shadow'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            <span>Salón</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPosOrderType('delivery');
                              if (!posTable.startsWith('Delivery')) {
                                setPosTable('Delivery 1');
                              }
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              isPosDelivery
                                ? 'bg-amber-500 text-black shadow'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Delivery</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPosOrderType('pickup');
                              if (!posTable.startsWith('Pick up')) {
                                setPosTable('Pick up 1');
                              }
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              posOrderType === 'pickup' || posTable.startsWith('Pick up')
                                ? 'bg-emerald-600 text-white shadow'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span>🛍️ Llevar</span>
                          </button>
                        </div>

                        {/* Selector de Mesa o Destino */}
                        <div>
                          <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                            {isPosDelivery ? 'Puesto / Slot de Delivery' : 'Mesa / Ubicación'}
                          </label>
                          <select
                            value={posTable}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPosTable(val);
                              if (val.startsWith('Delivery')) {
                                setPosOrderType('delivery');
                              } else if (val.startsWith('Pick up')) {
                                setPosOrderType('pickup');
                              } else {
                                setPosOrderType('mesa');
                              }
                            }}
                            className="w-full p-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none"
                          >
                            <optgroup label="🍽️ Mesas en Salón (3 disponibles)">
                              <option value="Mesa 1">Mesa 1</option>
                              <option value="Mesa 2">Mesa 2</option>
                              <option value="Mesa 3">Mesa 3</option>
                            </optgroup>
                            <optgroup label="⏳ Espera de Mesa">
                              <option value="Espera de mesa 1">Espera de mesa 1</option>
                              <option value="Espera de mesa 2">Espera de mesa 2</option>
                              <option value="Espera de mesa 3">Espera de mesa 3</option>
                            </optgroup>
                            <optgroup label="🛵 Delivery">
                              <option value="Delivery 1">Delivery 1</option>
                              <option value="Delivery 2">Delivery 2</option>
                              <option value="Delivery 3">Delivery 3</option>
                              <option value="Delivery 4">Delivery 4</option>
                              <option value="Delivery 5">Delivery 5</option>
                            </optgroup>
                            <optgroup label="🛍️ Pick up / Para Llevar">
                              <option value="Pick up 1">Pick up 1</option>
                              <option value="Pick up 2">Pick up 2</option>
                              <option value="Pick up 3">Pick up 3</option>
                            </optgroup>
                          </select>
                        </div>

                        {/* Datos del Cliente */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                              Nombre del Cliente {isPosDelivery && <span className="text-amber-400">*</span>}
                            </label>
                            <input
                              type="text"
                              value={posCustomerName}
                              onChange={(e) => setPosCustomerName(e.target.value)}
                              placeholder={isPosDelivery ? 'Ej: Carlos Pérez' : 'Ej: Carlos'}
                              className="w-full px-3 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none"
                            />
                          </div>
                          {isPosDelivery && (
                            <div>
                              <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase flex items-center gap-1">
                                <Phone className="w-3 h-3 text-amber-400" /> Teléfono (Opcional)
                              </label>
                              <input
                                type="text"
                                value={posCustomerPhone}
                                onChange={(e) => setPosCustomerPhone(e.target.value)}
                                placeholder="0414-1234567"
                                className="w-full px-3 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none font-mono"
                              />
                            </div>
                          )}
                        </div>

                        {/* Dirección de Entrega (solo si es delivery) */}
                        {isPosDelivery && (
                          <div>
                            <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-400" /> Dirección / Destino Delivery
                            </label>
                            <input
                              type="text"
                              value={posDeliveryAddress}
                              onChange={(e) => setPosDeliveryAddress(e.target.value)}
                              placeholder="Ej: Av. Las Américas, Edif. Altamira, Apto 4B"
                              className="w-full px-3 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none"
                            />
                          </div>
                        )}

                        {/* Box Regla de Delivery */}
                        {isPosDelivery && (
                          <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/25 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                Regla de Delivery:
                              </span>
                              {isFree ? (
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] border border-emerald-500/30 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> ¡Delivery GRATIS! ($0.00)
                                </span>
                              ) : (
                                <span className="font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded text-[11px] border border-amber-500/30">
                                  Costo extra: +${standardPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-zinc-300 leading-snug">
                              {isFree ? (
                                <span className="text-emerald-300">
                                  ✓ Aplica <strong>Delivery Gratis</strong> porque la orden (${posItemsSubtotal.toFixed(2)}) supera los ${freeThreshold.toFixed(2)}.
                                </span>
                              ) : (
                                <span>
                                  • Delivery gratis solo para órdenes mayores a <strong>${freeThreshold.toFixed(2)}</strong>. Orden actual: <strong>${posItemsSubtotal.toFixed(2)}</strong> (aplica recargo de <strong>+${standardPrice.toFixed(2)}</strong>).
                                  {posItemsSubtotal > 0 && (
                                    <span className="block text-amber-200/90 text-[10px] mt-0.5">
                                      Faltan ${(Math.max(0, freeThreshold - posItemsSubtotal) + 0.01).toFixed(2)} en productos para delivery gratis.
                                    </span>
                                  )}
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Pos Items List */}
                  <div className="max-h-56 overflow-y-auto space-y-2 pt-2">
                    {posItems.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic text-center py-4">
                        Selecciona productos a la izquierda para armar la comanda
                      </p>
                    ) : (
                      posItems.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-[#1A1A1A] border border-white/10 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white">{it.quantity}x </span>
                                {it.type === 'half-half' && (
                                  <span className="px-1.5 py-0.2 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-[9.5px] font-extrabold uppercase">
                                    Mitad & Mitad
                                  </span>
                                )}
                                <span className="text-zinc-200 font-medium">{it.name}</span>
                                {it.size && (
                                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-white/10 text-[9.5px] font-mono font-bold text-zinc-300">{getPizzaSizeLabel(it.size)}</span>
                                )}
                              </div>
                              {it.extras && it.extras.length > 0 && (
                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                  Extras: {it.extras.map((e: any) => e.name).join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#D4AF37]">
                                {formatUSD(it.unitPrice * it.quantity)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...posItems];
                                  copy.splice(idx, 1);
                                  setPosItems(copy);
                                }}
                                className="text-rose-400 hover:text-rose-200 font-bold px-1"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Crust Sauce Selector for Pizzas */}
                          {it.size && (
                            <div className="pt-1.5 border-t border-white/5 space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400 font-medium flex items-center gap-1">
                                  <Droplets className="w-3 h-3 text-emerald-400" /> Salsa para bordes:
                                </span>
                                {it.size === 'individual' ? (
                                  it.crustSauce && it.crustSauce !== 'sin_salsa' ? (
                                    <span className="text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9.5px]">
                                      +{formatUSD(CRUST_SAUCE_EXTRA_PRICE)} Extra
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500 text-[9.5px]">
                                      (Sin salsa gratis en individual)
                                    </span>
                                  )
                                ) : (
                                  <span className="text-emerald-400 font-medium text-[9.5px]">
                                    (Gratis incluida)
                                  </span>
                                )}
                              </div>
                              <select
                                value={it.crustSauce || 'sin_salsa'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newSauce = val === 'sin_salsa' ? undefined : val;
                                  const copy = [...posItems];
                                  const curr = copy[idx];
                                  const isInd = curr.size === 'individual';
                                  const base = curr.basePrice ?? (curr.size ? (curr.unitPrice - (isInd && curr.crustSauce && curr.crustSauce !== 'sin_salsa' ? CRUST_SAUCE_EXTRA_PRICE : 0)) : curr.unitPrice);
                                  const sauceExtra = (isInd && newSauce) ? CRUST_SAUCE_EXTRA_PRICE : 0;
                                  copy[idx] = {
                                    ...curr,
                                    basePrice: base,
                                    crustSauce: newSauce,
                                    unitPrice: base + sauceExtra,
                                  };
                                  setPosItems(copy);
                                }}
                                className="w-full bg-[#121214] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-zinc-200 outline-none truncate"
                              >
                                {COMPLIMENTARY_CRUST_SAUCES.map((sauce) => (
                                  <option key={sauce.id} value={sauce.name}>
                                    {sauce.shortName} {it.size === 'individual' ? `(+${formatUSD(CRUST_SAUCE_EXTRA_PRICE)} Extra)` : '(Gratis)'}
                                  </option>
                                ))}
                                <option value="sin_salsa">
                                  Sin salsa para bordes {it.size === 'individual' ? '($0.00)' : ''}
                                </option>
                              </select>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                      Método de Pago Acordado
                    </label>
                    <select
                      value={posPaymentMethod}
                      onChange={(e) => setPosPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full p-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none"
                    >
                      <option value="pagomovil">Pago Móvil</option>
                      <option value="efectivo_usd">Efectivo Divisas ($)</option>
                      <option value="zelle">Zelle</option>
                      <option value="binance">Binance Pay</option>
                    </select>
                  </div>

                  {/* Propina para el Personal (Variable) */}
                  <div className="p-2.5 rounded-xl bg-[#16161A] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-300 uppercase flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-emerald-400" /> Propina para el Personal
                      </label>
                      {posTipUSD > 0 && (
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          +{formatUSD(posTipUSD)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-zinc-400 leading-snug">
                      Propina variable voluntaria de salón. Se suma al total y se registra en métricas y cierres.
                    </p>

                    {/* Botones de propina rápida + monto libre */}
                    <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                      {[0, 1, 2, 3].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setPosTipUSD(val);
                            setPosIsCustomTip(false);
                            setPosCustomTipInput('');
                          }}
                          className={`py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                            !posIsCustomTip && posTipUSD === val
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-[#222228] text-zinc-300 hover:bg-[#2c2c34]'
                          }`}
                        >
                          {val === 0 ? 'Sin prop.' : `$${val}`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setPosIsCustomTip(true);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                          posIsCustomTip
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-[#222228] text-zinc-300 hover:bg-[#2c2c34]'
                        }`}
                      >
                        Otro $
                      </button>
                    </div>

                    {/* Input de monto variable libre */}
                    {posIsCustomTip && (
                      <div className="pt-1 flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400">$</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={posCustomTipInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPosCustomTipInput(val);
                            const parsed = parseFloat(val);
                            setPosTipUSD(isNaN(parsed) || parsed < 0 ? 0 : parsed);
                          }}
                          placeholder="Monto de propina variable"
                          className="flex-1 px-3 py-1.5 bg-[#0E0E12] border border-emerald-500/40 focus:border-emerald-500 rounded-lg text-xs font-mono text-white outline-none"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {/* Employee Discount Toggle */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1C1C20] border border-[#D4AF37]/30 cursor-pointer hover:bg-[#25252b] transition-colors">
                      <input
                        type="checkbox"
                        checked={posApplyEmployeeDiscount}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfirmDiscountTarget({
                              isPos: true,
                              percent: config.employeeDiscountDefaultPercent || 20,
                            });
                          } else {
                            setPosApplyEmployeeDiscount(false);
                          }
                        }}
                        className="rounded text-[#B71C1C] focus:ring-0 w-4 h-4 bg-black border-white/20"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Aplicar Descuento Empleado (-{config.employeeDiscountDefaultPercent || 20}%)
                        </span>
                        <span className="text-[10.5px] text-zinc-400 block">
                          Aplica sobre el subtotal de consumo en salón.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  {(() => {
                    const posSubtotal = posItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
                    const posDiscountPercent = posApplyEmployeeDiscount ? (config.employeeDiscountDefaultPercent || 20) : 0;
                    const posDiscountUSD = (posSubtotal * posDiscountPercent) / 100;
                    const isDelivery = posOrderType === 'delivery' || posTable.toLowerCase().includes('delivery');
                    const posDeliveryCostUSD = isDelivery ? calculateDeliveryCost(posSubtotal, 'delivery', config) : 0;
                    const posTotalUSD = Math.max(0, posSubtotal - posDiscountUSD + posDeliveryCostUSD + (posTipUSD || 0));
                    const freeThreshold = config.freeDeliveryThresholdUSD || 10.0;

                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs text-zinc-300">
                          <span>Subtotal Productos:</span>
                          <span className="font-mono font-bold">{formatUSD(posSubtotal)}</span>
                        </div>
                        {isDelivery && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-300 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-amber-400" /> Costo Delivery:
                            </span>
                            {posDeliveryCostUSD === 0 ? (
                              <span className="font-mono font-bold text-emerald-400">
                                ¡GRATIS! (Orden &gt; ${freeThreshold.toFixed(2)})
                              </span>
                            ) : (
                              <span className="font-mono font-bold text-amber-400">
                                +{formatUSD(posDeliveryCostUSD)}
                              </span>
                            )}
                          </div>
                        )}
                        {posDiscountUSD > 0 && (
                          <div className="flex justify-between items-center text-xs text-emerald-400">
                            <span>Descuento Empleado (-{posDiscountPercent}%):</span>
                            <span className="font-mono font-bold">-{formatUSD(posDiscountUSD)}</span>
                          </div>
                        )}
                        {posTipUSD > 0 && (
                          <div className="flex justify-between items-center text-xs text-emerald-400">
                            <span>Propina Voluntaria:</span>
                            <span className="font-mono font-bold">+{formatUSD(posTipUSD)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm font-bold text-white pt-1 border-t border-white/10">
                          <span>{isDelivery ? 'Total Comanda Delivery:' : 'Total Mesa:'}</span>
                          <div className="text-right">
                            <span className="font-mono text-[#D4AF37] text-base block leading-none">
                              {formatUSD(posTotalUSD)}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-400">
                              {formatBs(posTotalUSD, effectiveExchangeRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    disabled={posItems.length === 0}
                    onClick={handleCreateLocalOrder}
                    className="w-full py-3 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
                  >
                    {posOrderType === 'delivery' || posTable.toLowerCase().includes('delivery')
                      ? 'Registrar Comanda Delivery & Enviar a Cocina'
                      : 'Registrar & Enviar a Cocina'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: MONITOR DE COMANDAS                           */}
          {/* ==================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#141414] border border-white/10">
                <div>
                  <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#D4AF37]" /> Monitor de Comandas
                    <span className="px-2 py-0.5 rounded-full bg-[#181818] border border-[#D4AF37]/30 text-xs font-mono font-bold text-[#D4AF37]">
                      {filteredComandas.length} {filteredComandas.length === 1 ? 'comanda' : 'comandas'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Gestiona pedidos de Hoy, Ayer o históricos. Edita, anula o imprime cuentas sin restricción de horario.
                  </p>
                </div>

                {/* Day Filter Scope */}
                <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setOrdersScope('today')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      ordersScope === 'today'
                        ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersScope('yesterday')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      ordersScope === 'yesterday'
                        ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Ayer
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersScope('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      ordersScope === 'all'
                        ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todas ({orders.length})
                  </button>
                </div>
              </div>

              {/* Status & Search Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrderStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      orderStatusFilter === 'all'
                        ? 'bg-zinc-700 text-white'
                        : 'bg-[#181818] text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    Todos ({ordersScope === 'today' ? ordersToday.length : ordersScope === 'yesterday' ? orders.filter((o) => {
                      const d = new Date(o.timestamp || 0);
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
                    }).length : orders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderStatusFilter('recibido')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      orderStatusFilter === 'recibido'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#181818] text-amber-400 hover:text-white border border-amber-500/20'
                    }`}
                  >
                    En Cocina / Recibido
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderStatusFilter('entregado')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      orderStatusFilter === 'entregado'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#181818] text-emerald-400 hover:text-white border border-emerald-500/20'
                    }`}
                  >
                    Entregados
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderStatusFilter('cancelado')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      orderStatusFilter === 'cancelado'
                        ? 'bg-rose-700 text-white'
                        : 'bg-[#181818] text-rose-400 hover:text-white border border-rose-500/20'
                    }`}
                  >
                    Anuladas / Canceladas
                  </button>
                </div>

                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Buscar por #, cliente, teléfono..."
                    className="w-full px-3 py-1.5 pl-8 bg-[#181818] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-[#D4AF37]"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {filteredComandas.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-xl bg-[#141418] border border-white/5 space-y-2">
                    <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-zinc-400 text-xs font-bold">
                      No hay comandas que coincidan con los filtros seleccionados.
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {ordersScope === 'today'
                        ? 'No hay comandas activas del día de hoy.'
                        : ordersScope === 'yesterday'
                        ? 'No se encontraron comandas del día de ayer con estos criterios.'
                        : 'No se encontraron comandas.'}
                    </p>
                  </div>
                ) : (
                  filteredComandas.map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 rounded-xl bg-[#141418] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-white/20 transition-all"
                    >
                      {/* Left: Order #, Table/Type, Customer Name & Order Details */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Header Line: 1. Order #, 2. Table/Type, 3. Customer Name */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 1. Número de Orden */}
                          <span className="font-mono font-extrabold text-sm text-[#D4AF37]">
                            #{o.id}
                          </span>

                          {/* 2. Número de mesa (si aplica) o si es delivery o pickup */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              o.deliveryType === 'mesa' || o.tableNumber
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : o.deliveryType === 'delivery'
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {o.deliveryType === 'mesa' || o.tableNumber
                              ? `Mesa ${o.tableNumber || 'S/N'}`
                              : o.deliveryType === 'delivery'
                              ? 'Delivery'
                              : 'Pick-up'}
                          </span>

                          {/* 3. Nombre de cliente (si aplica) */}
                          {o.customerName && o.customerName.trim() && (
                            <span className="text-xs sm:text-sm font-bold text-white truncate">
                              {o.customerName}
                            </span>
                          )}

                          <span className="text-[11px] text-zinc-500 font-mono ml-auto sm:ml-0">
                            {o.date}
                          </span>
                        </div>

                        {/* 4. Detalles de la orden (pizza, tamaño, salsa, bebidas y cualquier extra) */}
                        <div className="text-xs text-zinc-200">
                          {o.rawItems && o.rawItems.length > 0 ? (
                            <div className="space-y-0.5">
                              {o.rawItems.map((it, idx) => (
                                <div
                                  key={it.cartId || idx}
                                  className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-200"
                                >
                                  <span className="font-mono font-bold text-[#D4AF37]">
                                    {it.quantity}x
                                  </span>
                                  <span className="font-semibold text-white">
                                    {it.type === 'half-half'
                                      ? `Mitad & Mitad (${it.name})`
                                      : it.name}
                                  </span>
                                  {it.size && (
                                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono font-bold text-zinc-300">{getPizzaSizeLabel(it.size)}</span>
                                  )}
                                  {it.crustSauce && (
                                    <span className="text-[11px] text-amber-300/90 font-medium">
                                      • Salsa: {it.crustSauce}
                                    </span>
                                  )}
                                  {it.extras && it.extras.length > 0 && (
                                    <span className="text-[11px] text-zinc-400">
                                      • Extras: {it.extras.map((e) => e.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {o.itemsSummary}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: 5. Botón Editar, 6. Botón PNG, 7. Estado Seleccionable (recibido, entregado, cancelado) */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5 justify-between md:justify-end">
                        {/* 5. Boton para editar la orden */}
                        <button
                          type="button"
                          title="Modificar o agregar extras a esta comanda"
                          onClick={() => handleStartEditOrder(o)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1F1F24] hover:bg-[#D4AF37] hover:text-black text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30 transition-all active:scale-95"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {/* 6. Boton de Cuenta */}
                        <button
                          type="button"
                          title="Gestionar Cuenta: Pre-Cuenta, División de personas o Comanda de Cocina"
                          onClick={() => {
                            setActivePrintOrder({ order: o, type: 'precuenta' });
                            setReceiptTab('cuenta');
                            setSelectedSplitCount(1);
                            setConfirmedSplitCount(1);
                            setShowTicketViewer(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1F1F24] hover:bg-[#D4AF37] hover:text-black text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30 transition-all active:scale-95 shadow-sm"
                        >
                          <Receipt className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Cuenta</span>
                        </button>

                        {/* 7. Estado de la orden: Simplificado a Recibido, Entregado, Cancelado con Confirmación */}
                        <select
                          value={o.status === 'preparando' || o.status === 'en_camino' ? 'recibido' : o.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as OrderRecord['status'];
                            if (newStatus !== o.status) {
                              setPendingStatusChange({ order: o, newStatus });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none border transition-colors cursor-pointer ${
                            o.status === 'entregado'
                              ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300'
                              : o.status === 'cancelado'
                              ? 'bg-rose-950/80 border-rose-600/50 text-rose-300'
                              : 'bg-amber-950/80 border-amber-600/50 text-amber-300'
                          }`}
                        >
                          <option value="recibido" className="bg-[#18181B] text-white">
                            Recibido
                          </option>
                          <option value="entregado" className="bg-[#18181B] text-white">
                            Entregado
                          </option>
                          <option value="cancelado" className="bg-[#18181B] text-white">
                            Cancelado
                          </option>
                        </select>

                        {/* 8. Eliminar Comanda con Confirmación */}
                        {onDeleteOrder && (
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(o)}
                            title="Eliminar comanda de la base de datos"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/80 text-zinc-500 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: EDITOR DE CATÁLOGO & PRECIOS                  */}
          {/* ==================================================== */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              {/* Category Segment Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-1.5 p-1 bg-[#141418] rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSubTab('pizzas');
                      setIsAddingPizza(false);
                      setIsAddingItem(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      catalogSubTab === 'pizzas'
                        ? 'bg-[#B71C1C] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Pizzas ({pizzas.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSubTab('bebidas');
                      setIsAddingPizza(false);
                      setIsAddingItem(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      catalogSubTab === 'bebidas'
                        ? 'bg-[#B71C1C] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Bebidas ({drinks.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSubTab('extras');
                      setIsAddingPizza(false);
                      setIsAddingItem(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      catalogSubTab === 'extras'
                        ? 'bg-[#B71C1C] text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Extras & Toppings ({extras.length})
                  </button>
                </div>

                {catalogSubTab === 'pizzas' ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingPizza(!isAddingPizza)}
                    className="px-3 py-1.5 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nueva Pizza</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(!isAddingItem)}
                    className="px-3 py-1.5 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Nuevo {catalogSubTab === 'bebidas' ? 'Refresco/Bebida' : 'Extra/Topping'}
                    </span>
                  </button>
                )}
              </div>

              {/* PIZZAS SUB-TAB */}
              {catalogSubTab === 'pizzas' && (
                <div className="space-y-4">
                  {/* Add New Pizza Form */}
                  {isAddingPizza && (
                    <form
                      onSubmit={handleCreateNewPizza}
                      className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/40 space-y-3"
                    >
                      <h5 className="font-bold text-xs text-[#D4AF37] uppercase font-mono">
                        Agregar Nueva Pizza al Catálogo
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Nombre</label>
                          <input
                            type="text"
                            required
                            value={newPizzaName}
                            onChange={(e) => setNewPizzaName(e.target.value)}
                            placeholder="Ej: 4 QUESOS ANDINOS"
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Slogan / Tagline</label>
                          <input
                            type="text"
                            value={newPizzaTagline}
                            onChange={(e) => setNewPizzaTagline(e.target.value)}
                            placeholder="Ej: Cremosa e intensa"
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Base de Salsa</label>
                          <select
                            value={newPizzaSauce}
                            onChange={(e) => setNewPizzaSauce(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                          >
                            <option value="napolitana">Base Napolitana</option>
                            <option value="blanca">Base Blanca</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">
                          Ingredientes (separados por coma)
                        </label>
                        <input
                          type="text"
                          value={newPizzaIngredients}
                          onChange={(e) => setNewPizzaIngredients(e.target.value)}
                          placeholder="Mozzarella, Queso de Cabra, Parmesano, Miel picante"
                          className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Individual 20cm ($)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={newPizzaPriceIndividual}
                            onChange={(e) => setNewPizzaPriceIndividual(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Mediana 30cm ($)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={newPizzaPriceL}
                            onChange={(e) => setNewPizzaPriceL(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Familiar 40cm ($)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={newPizzaPriceXL}
                            onChange={(e) => setNewPizzaPriceXL(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingPizza(false)}
                          className="px-3 py-1 text-xs text-zinc-400"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs"
                        >
                          Guardar Pizza
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Info Notice about Visibility */}
                  <div className="p-3 rounded-xl bg-[#14141A] border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Disponibilidad y Visibilidad en el Menú Web</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                        Al marcar una pizza como <strong>"No disponible"</strong>, se retira de inmediato del menú web para los clientes evitando pedidos no deseados. Sin embargo, como administrador podrás seguir agregándola con total normalidad a las comandas de salón o delivery en el módulo POS.
                      </p>
                    </div>
                  </div>

                  {/* Pizzas List */}
                  <div className="space-y-2.5">
                    {pizzas.map((p) => {
                      const isEditing = editingPizza?.id === p.id;
                      if (isEditing && editingPizza) {
                        return (
                          <form
                            key={p.id}
                            onSubmit={handleSaveEditedPizza}
                            className="p-4 rounded-xl bg-[#181818] border-2 border-[#D4AF37] space-y-3 animate-in fade-in"
                          >
                            <div className="flex items-center justify-between pb-1 border-b border-white/10">
                              <span className="font-bold text-xs text-[#D4AF37] uppercase font-mono">
                                Editando Pizza: {p.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingPizza(null)}
                                className="text-xs text-zinc-400 hover:text-white"
                              >
                                Cancelar
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Nombre</label>
                                <input
                                  type="text"
                                  required
                                  value={editingPizza.name}
                                  onChange={(e) =>
                                    setEditingPizza({ ...editingPizza, name: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white uppercase font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Tagline / Lema</label>
                                <input
                                  type="text"
                                  value={editingPizza.tagline || ''}
                                  onChange={(e) =>
                                    setEditingPizza({ ...editingPizza, tagline: e.target.value })
                                  }
                                  placeholder="Ej: La Reina Clásica"
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Salsa Base</label>
                                <select
                                  value={editingPizza.sauce}
                                  onChange={(e) =>
                                    setEditingPizza({
                                      ...editingPizza,
                                      sauce: e.target.value as 'napolitana' | 'blanca',
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                                >
                                  <option value="napolitana">Salsa Napolitana</option>
                                  <option value="blanca">Salsa Blanca</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Individual 20cm ($)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editingPizza.priceIndividual ?? editingPizza.priceL}
                                  onChange={(e) =>
                                    setEditingPizza({
                                      ...editingPizza,
                                      priceIndividual: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Mediana 30cm ($)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editingPizza.priceL}
                                  onChange={(e) =>
                                    setEditingPizza({
                                      ...editingPizza,
                                      priceL: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Familiar 40cm ($)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editingPizza.priceXL}
                                  onChange={(e) =>
                                    setEditingPizza({
                                      ...editingPizza,
                                      priceXL: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1">
                                Ingredientes (separados por coma)
                              </label>
                              <input
                                type="text"
                                value={(editingPizza.ingredients || []).join(', ')}
                                onChange={(e) =>
                                  setEditingPizza({
                                    ...editingPizza,
                                    ingredients: e.target.value
                                      .split(',')
                                      .map((i) => i.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1">Descripción</label>
                              <input
                                type="text"
                                value={editingPizza.description || ''}
                                onChange={(e) =>
                                  setEditingPizza({ ...editingPizza, description: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingPizza(null)}
                                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:bg-[#c49f2e] transition-colors"
                              >
                                Guardar Cambios
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-white/20 transition-all"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white font-serif">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                ({p.sauce === 'blanca' ? 'Base Blanca' : 'Base Napolitana'})
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-snug">{p.description}</p>
                            {p.ingredients && p.ingredients.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {p.ingredients.map((ing, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] px-1.5 py-0.5 bg-black/40 text-zinc-300 rounded border border-white/5"
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-zinc-500 text-[10px]" title="Individual (20cm)">Ind: $</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={p.priceIndividual ?? p.priceL}
                                  onChange={(e) =>
                                    handleUpdatePizzaPrice(p.id, 'priceIndividual', Number(e.target.value))
                                  }
                                  className="w-14 px-1.5 py-1 bg-[#1C1C1C] border border-white/10 rounded text-white font-mono font-bold text-xs"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-zinc-500 text-[10px]" title="Mediana (30cm)">Med: $</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={p.priceL}
                                  onChange={(e) =>
                                    handleUpdatePizzaPrice(p.id, 'priceL', Number(e.target.value))
                                  }
                                  className="w-14 px-1.5 py-1 bg-[#1C1C1C] border border-white/10 rounded text-white font-mono font-bold text-xs"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-zinc-500 text-[10px]" title="Familiar (40cm)">Fam: $</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={p.priceXL}
                                  onChange={(e) =>
                                    handleUpdatePizzaPrice(p.id, 'priceXL', Number(e.target.value))
                                  }
                                  className="w-14 px-1.5 py-1 bg-[#1C1C1C] border border-white/10 rounded text-white font-mono font-bold text-xs"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartEditPizza(p)}
                              className="p-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Editar detalles completos de la pizza"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePizza(p.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                                p.isAvailable !== false
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900'
                                  : 'bg-rose-950/80 text-rose-300 border border-rose-700/60 hover:bg-rose-900'
                              }`}
                              title={
                                p.isAvailable !== false
                                  ? 'Visible para los clientes en la web. Clic para marcar No Disponible y ocultarla.'
                                  : 'Oculta en la web para los clientes (aún disponible para comandas en POS). Clic para volver a mostrarla.'
                              }
                            >
                              {p.isAvailable !== false ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Disponible (Web)</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>No disponible (Oculta)</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePizza(p.id)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400"
                              title="Eliminar pizza"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BEBIDAS, SALSAS, EXTRAS SUB-TABS */}
              {catalogSubTab !== 'pizzas' && (
                <div className="space-y-4">
                  {/* Add New Generic Item Form */}
                  {isAddingItem && (
                    <form
                      onSubmit={handleCreateNewGenericItem}
                      className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/40 space-y-3"
                    >
                      <h5 className="font-bold text-xs text-[#D4AF37] uppercase font-mono">
                        Agregar Nuevo Ítem a {catalogSubTab.toUpperCase()}
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">Nombre</label>
                          <input
                            type="text"
                            required
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="Ej: Refresco / Salsa Especial"
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            Presentación / Volumen
                          </label>
                          <input
                            type="text"
                            value={newItemVolume}
                            onChange={(e) => setNewItemVolume(e.target.value)}
                            placeholder="Ej: Lata 355 ml / Pote 2 oz"
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            Precio en Dólares ($)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Descripción</label>
                        <input
                          type="text"
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                          placeholder="Descripción breve del producto..."
                          className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingItem(false)}
                          className="px-3 py-1 text-xs text-zinc-400"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs"
                        >
                          Guardar Producto
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Generic Items List */}
                  <div className="space-y-2.5">
                    {getActiveGenericList().map((item) => {
                      const isEditing = editingGenericItem?.id === item.id;
                      if (isEditing && editingGenericItem) {
                        return (
                          <form
                            key={item.id}
                            onSubmit={handleSaveEditedGenericItem}
                            className="p-4 rounded-xl bg-[#181818] border-2 border-[#D4AF37] space-y-3 animate-in fade-in"
                          >
                            <div className="flex items-center justify-between pb-1 border-b border-white/10">
                              <span className="font-bold text-xs text-[#D4AF37] uppercase font-mono">
                                Editando {catalogSubTab.slice(0, -1)}: {item.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingGenericItem(null)}
                                className="text-xs text-zinc-400 hover:text-white"
                              >
                                Cancelar
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Nombre</label>
                                <input
                                  type="text"
                                  required
                                  value={editingGenericItem.name}
                                  onChange={(e) =>
                                    setEditingGenericItem({
                                      ...editingGenericItem,
                                      name: e.target.value,
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                  Presentación / Volumen
                                </label>
                                <input
                                  type="text"
                                  value={editingGenericItem.volumeOrSize || ''}
                                  onChange={(e) =>
                                    setEditingGenericItem({
                                      ...editingGenericItem,
                                      volumeOrSize: e.target.value,
                                    })
                                  }
                                  placeholder="Ej: Lata 355 ml / Pote 2 oz"
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                  Precio ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editingGenericItem.price}
                                  onChange={(e) =>
                                    setEditingGenericItem({
                                      ...editingGenericItem,
                                      price: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white font-mono font-bold"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1">Descripción</label>
                              <input
                                type="text"
                                value={editingGenericItem.description || ''}
                                onChange={(e) =>
                                  setEditingGenericItem({
                                    ...editingGenericItem,
                                    description: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 bg-[#121212] border border-white/10 rounded-lg text-xs text-white"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingGenericItem(null)}
                                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:bg-[#c49f2e] transition-colors"
                              >
                                Guardar Cambios
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-white/20 transition-all"
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{item.name}</span>
                              {item.volumeOrSize && (
                                <span className="text-[10px] text-zinc-400 font-mono bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-white/5">
                                  {item.volumeOrSize}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400">{item.description}</p>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-zinc-500 text-[10px]">Precio: $</span>
                              <input
                                type="number"
                                step="0.1"
                                value={item.price}
                                onChange={(e) =>
                                  handleUpdateGenericItemPrice(item.id, Number(e.target.value))
                                }
                                className="w-16 px-2 py-1 bg-[#1C1C1C] border border-white/10 rounded text-white font-mono font-bold text-xs"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartEditGenericItem(item)}
                              className="p-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Editar detalles completos del producto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleGenericItem(item.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                item.isAvailable
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {item.isAvailable ? 'Disponible' : 'Agotado'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteGenericItem(item.id)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: TASA & CONFIGURACIÓN                          */}
          {/* ==================================================== */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              {/* Rate Sync Card & Mode Switcher */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#D4AF37]" /> Tasa de Cambio Oficial (Bs/$)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Gestiona la sincronización automática con BCV o fija una tasa manual para fines de semana
                    </p>
                  </div>

                  {/* Mode Selector Buttons */}
                  <div className="flex items-center p-1 bg-[#1C1C20] rounded-xl border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('vandali_manual_exchange_rate');
                        localStorage.setItem('vandali_exchange_rate_mode', 'auto');
                        const updated: AdminConfig = {
                          ...formData,
                          exchangeRateMode: 'auto',
                          exchangeRateBs: effectiveExchangeRate,
                          rateSource: 'api_bcv',
                          forceAdminOverride: true,
                        };
                        setFormData(updated);
                        onUpdateConfig(updated);
                        syncManager.updateConfig(updated, true);
                        onRefreshLiveRate(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        formData.exchangeRateMode !== 'manual'
                          ? 'bg-[#D4AF37] text-black shadow-md font-extrabold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingRate ? 'animate-spin' : ''}`} />
                      <span>Tasa Automática (BCV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const updated: AdminConfig = {
                          ...formData,
                          exchangeRateMode: 'manual',
                          exchangeRateBs: effectiveExchangeRate,
                          rateSource: 'manual',
                          lastRateUpdate: 'Fijada manualmente por el administrador',
                          forceAdminOverride: true,
                        };
                        localStorage.setItem('vandali_exchange_rate_mode', 'manual');
                        localStorage.setItem('vandali_manual_exchange_rate', (updated.exchangeRateBs || SAFE_DEFAULT_EXCHANGE_RATE).toString());
                        setFormData(updated);
                        onUpdateConfig(updated);
                        syncManager.updateConfig(updated, true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        formData.exchangeRateMode === 'manual'
                          ? 'bg-[#B71C1C] text-white shadow-md font-extrabold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Tasa Manual (Bloqueada)</span>
                    </button>
                  </div>
                </div>

                {/* Status indicator banner */}
                {formData.exchangeRateMode === 'manual' ? (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">Modo Manual Permanente Activado:</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold">
                          1$ = Bs. {effectiveExchangeRate.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        La tasa está fija y <strong>bloqueada contra reversiones automáticas</strong>. Ninguna consulta de BCV, reinicio de servidor ni conexión de clientes modificará esta tasa hasta que el administrador decida pulsar <strong>"Tasa Automática (BCV)"</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-300">Modo Automático en Vivo (BCV Oficial):</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-bold">
                          1$ = Bs. {effectiveExchangeRate.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        La tasa se actualiza periódicamente según la tasa oficial del BCV. Si deseas fijar una tasa personalizada para el fin de semana o feriado, pulsa <strong>"Tasa Manual (Bloqueada)"</strong>.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Valor Tasa de Cambio (Bs por 1 USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.exchangeRateMode === 'manual' ? (formData.exchangeRateBs || effectiveExchangeRate) : effectiveExchangeRate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated: AdminConfig = {
                          ...formData,
                          exchangeRateBs: val,
                          exchangeRateMode: 'manual',
                          rateSource: 'manual',
                          lastRateUpdate: 'Fijada manualmente por el administrador',
                          forceAdminOverride: true,
                        };
                        setFormData(updated);
                        localStorage.setItem('vandali_exchange_rate_mode', 'manual');
                        localStorage.setItem('vandali_manual_exchange_rate', val.toString());
                        onUpdateConfig(updated);
                        syncManager.updateConfig(updated, true);
                      }}
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-sm font-mono font-bold text-white outline-none focus:border-[#D4AF37]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mt-1.5 text-[11px] text-zinc-400">
                      <span className="truncate">
                        Última sync: <strong className="text-zinc-300 font-mono">{formData.lastRateUpdate || 'BCV Oficial'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRefreshLiveRate(true)}
                        disabled={isUpdatingRate}
                        className="inline-flex items-center gap-1 text-[#D4AF37] hover:text-amber-300 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        title="Consultar tasa oficial directamente en bcv.org.ve"
                      >
                        <RefreshCw className={`w-3 h-3 ${isUpdatingRate ? 'animate-spin' : ''}`} />
                        <span>{isUpdatingRate ? 'Consultando BCV...' : 'Consultar BCV ahora'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Descuento de Empleado por Defecto (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={formData.employeeDiscountDefaultPercent ?? 20}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employeeDiscountDefaultPercent: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-sm font-mono font-bold text-white outline-none focus:border-[#D4AF37]"
                      />
                      <span className="absolute right-3 top-2 text-zinc-400 text-xs font-mono font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Número de WhatsApp del Restaurante
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsappNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          whatsappNumber: e.target.value,
                        })
                      }
                      placeholder="584248954741"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-sm font-mono font-bold text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Instagram Oficial
                    </label>
                    <input
                      type="text"
                      value={formData.instagram || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          instagram: e.target.value,
                        })
                      }
                      placeholder="vandali.pizzeria"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs text-zinc-400 block mb-1">
                      Ubicación del Local
                    </label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: e.target.value,
                        })
                      }
                      placeholder="Av. 2 Lora, entre calles 27 y 28, Mérida, Venezuela"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Database & Google Sheets / Drive Integration */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
                        Base de Datos & Google Sheets / Google Drive
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Respaldo automático de pedidos en hojas de cálculo y exportación de ventas (con columnas independientes para <strong>Fecha</strong> y <strong>Hora</strong> listas para filtros y tablas dinámicas en Excel).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      URL del Webhook de Google Sheets (Google Apps Script Web App)
                    </label>
                    <input
                      type="url"
                      value={formData.googleSheetsWebhookUrl || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          googleSheetsWebhookUrl: e.target.value,
                        })
                      }
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs font-mono text-white outline-none focus:border-[#D4AF37]"
                    />
                    <span className="text-[10.5px] text-zinc-400 block mt-1">
                      Cada comanda completada se enviará automáticamente a esta URL para quedar guardada en tu Google Drive / Google Sheets.
                    </span>
                  </div>

                  {sheetsSyncMsg && (
                    <div className="p-3 rounded-xl bg-[#1C1C22] border border-white/15 text-xs text-zinc-200">
                      {sheetsSyncMsg}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSyncGoogleSheets}
                      disabled={isSyncingSheets}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                      <span>{isSyncingSheets ? 'Sincronizando...' : 'Sincronizar Pedidos con Google Sheets'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-4 py-2 rounded-xl bg-[#1F1F24] hover:bg-[#2b2b32] text-zinc-200 border border-white/10 font-bold text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Descargar Reporte CSV (Excel / Drive)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAppsScriptHelp(!showAppsScriptHelp)}
                      className="px-3 py-2 rounded-xl text-xs text-[#D4AF37] hover:underline font-bold"
                    >
                      {showAppsScriptHelp ? 'Ocultar Código de Google Apps Script' : 'Ver Código de Google Apps Script'}
                    </button>
                  </div>

                  {/* Apps Script instructions accordion */}
                  {showAppsScriptHelp && (
                    <div className="p-3.5 rounded-xl bg-[#0C0C0E] border border-white/10 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Código para Google Apps Script:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(sampleAppsScript);
                            setCopiedScript(true);
                            setTimeout(() => setCopiedScript(false), 3000);
                          }}
                          className="px-2.5 py-1 rounded bg-[#1C1C20] hover:bg-[#2b2b30] text-[#D4AF37] text-[11px] font-bold flex items-center gap-1 border border-white/10"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedScript ? '¡Copiado!' : 'Copiar Código'}</span>
                        </button>
                      </div>

                      <pre className="p-3 rounded-lg bg-[#141416] text-[10.5px] font-mono text-zinc-300 overflow-x-auto max-h-48 border border-white/5">
                        {sampleAppsScript}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Rules */}
              <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-3">
                <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
                  Reglas de Delivery & Horario
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Monto para Delivery Gratis ($)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.freeDeliveryThresholdUSD}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          freeDeliveryThresholdUSD: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Precio Delivery Estándar ($)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.standardDeliveryPriceUSD}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          standardDeliveryPriceUSD: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Estado del Local
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, isOpen: !formData.isOpen })
                      }
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                        formData.isOpen
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {formData.isOpen ? 'Abierto (4PM - 11PM)' : 'Cerrado Ahora'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pizza del Mes (Promoción & Banner del Homepage) */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#B71C1C]/40 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#B71C1C] text-white">
                      <Flame className="w-4 h-4 text-amber-200" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
                        Pizza del Mes (Banner Homepage)
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Destaca cada mes una pizza especial con banner interactivo en la página principal
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                    Promoción Mensual
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Enable Switch */}
                  <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-[#1A1A1E] border border-white/5">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Mostrar Banner en el Home
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Si está activo, los clientes verán el banner destacado con acceso directo a ordenar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = formData.pizzaOfTheMonth || {
                          enabled: true,
                          monthName: 'Especial del Mes',
                          pizzaId: 'miss-vandali',
                        };
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...current,
                            enabled: !(current.enabled !== false),
                          },
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        formData.pizzaOfTheMonth?.enabled !== false
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-zinc-800 text-zinc-400 border border-white/10'
                      }`}
                    >
                      {formData.pizzaOfTheMonth?.enabled !== false ? 'Activo (Visible)' : 'Pausado (Oculto)'}
                    </button>
                  </div>

                  {/* Month Name */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Mes de la Especialidad
                    </label>
                    <input
                      type="text"
                      value={formData.pizzaOfTheMonth?.monthName || 'Especial del Mes'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...(formData.pizzaOfTheMonth || {
                              enabled: true,
                              pizzaId: 'miss-vandali',
                            }),
                            monthName: e.target.value,
                          },
                        })
                      }
                      placeholder="Ej: Especial del Mes"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Pizza Select */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Pizza a Promocionar
                    </label>
                    <select
                      value={formData.pizzaOfTheMonth?.pizzaId || 'miss-vandali'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...(formData.pizzaOfTheMonth || {
                              enabled: true,
                              monthName: 'Especial del Mes',
                            }),
                            pizzaId: e.target.value,
                            customTitle:
                              pizzas.find((p) => p.id === e.target.value)?.name || undefined,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    >
                      {pizzas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Badge / Tagline */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Etiqueta / Badge
                    </label>
                    <input
                      type="text"
                      value={formData.pizzaOfTheMonth?.badge || 'Edición Exclusiva • Pizza del Mes'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...(formData.pizzaOfTheMonth || {
                              enabled: true,
                              monthName: 'Especial del Mes',
                              pizzaId: 'miss-vandali',
                            }),
                            badge: e.target.value,
                          },
                        })
                      }
                      placeholder="Ej: Edición Exclusiva • Pizza del Mes"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Highlight Slogan */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">
                      Ingredientes Clave / Subtítulo
                    </label>
                    <input
                      type="text"
                      value={
                        formData.pizzaOfTheMonth?.highlightTag ||
                        'Ricotta Artesanal + Pavo + Pistacho + Rúgula + Balsámico'
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...(formData.pizzaOfTheMonth || {
                              enabled: true,
                              monthName: 'Especial del Mes',
                              pizzaId: 'miss-vandali',
                            }),
                            highlightTag: e.target.value,
                          },
                        })
                      }
                      placeholder="Ej: Ricotta Artesanal + Pavo + Pistacho + Rúgula + Balsámico"
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="text-xs text-zinc-400 block mb-1">
                      Descripción del Banner
                    </label>
                    <textarea
                      rows={2}
                      value={
                        formData.pizzaOfTheMonth?.customDescription ||
                        'Salsa blanca artesanal de ricotta, jamón de pavo, lluvia de pistachos, rúgula fresca y glaseado balsámico. El equilibrio perfecto entre cremosidad, frescura y textura.'
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pizzaOfTheMonth: {
                            ...(formData.pizzaOfTheMonth || {
                              enabled: true,
                              monthName: 'Especial del Mes',
                              pizzaId: 'miss-vandali',
                            }),
                            customDescription: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Security & Admin PIN Management */}
              <div className="p-4 rounded-xl bg-[#141414] border border-[#D4AF37]/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#B71C1C]/20 text-[#D4AF37]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white uppercase tracking-wider font-mono">
                        Seguridad & Clave de Administrador
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Control de acceso y recuperación de contraseña
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                    Cifrado SHA-256
                  </span>
                </div>

                {/* Official Recovery Email Info */}
                <div className="p-3 rounded-xl bg-[#1A1A1E] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-zinc-300 block">
                      Correo Oficial de Respaldo:
                    </span>
                    <span className="text-xs font-mono text-[#D4AF37]">
                      {formData.adminRecoveryEmail || ADMIN_RECOVERY_EMAIL}
                    </span>
                    <p className="text-[10.5px] text-zinc-400 mt-0.5">
                      Si olvidas tu PIN o el sistema se bloquea por intentos fallidos, el código de
                      desbloqueo se envía exclusivamente a esta dirección.
                    </p>
                  </div>
                </div>

                {/* Change PIN Form */}
                <form onSubmit={handleUpdateCustomPin} className="space-y-3 pt-1">
                  <span className="text-xs font-bold text-white block">
                    Cambiar PIN de Acceso Administrativo:
                  </span>

                  {pinChangeMsg && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{pinChangeMsg}</span>
                    </div>
                  )}

                  {pinChangeError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-800 text-rose-200 text-xs">
                      {pinChangeError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Nuevo PIN (mín. 4 dígitos)
                      </label>
                      <input
                        type="password"
                        maxLength={12}
                        value={customPinInput}
                        onChange={(e) => setCustomPinInput(e.target.value)}
                        placeholder="Ej: 2468"
                        className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 focus:border-[#D4AF37] rounded-xl text-xs font-mono text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        Confirmar Nuevo PIN
                      </label>
                      <input
                        type="password"
                        maxLength={12}
                        value={customPinConfirm}
                        onChange={(e) => setCustomPinConfirm(e.target.value)}
                        placeholder="Confirmar..."
                        className="w-full px-3 py-2 bg-[#1C1C1C] border border-white/10 focus:border-[#D4AF37] rounded-xl text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isUpdatingPin || !customPinInput || !customPinConfirm}
                      className="py-2 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isUpdatingPin ? 'Actualizando...' : 'Actualizar PIN'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRestoreDefaultPin}
                      className="text-[11px] text-zinc-400 hover:text-white underline decoration-zinc-600 transition-colors"
                    >
                      Restaurar PIN predeterminado de fábrica (24682023)
                    </button>
                  </div>
                </form>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-6 py-2.5 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveSuccess ? 'Guardado Exitoso' : 'Guardar Ajustes'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* CUENTA / PRE-CUENTA & COCINA IMPRESIÓN MODAL         */}
      {/* ==================================================== */}
      {activePrintOrder && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#D4AF37]/40 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#18181C]">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    receiptTab === 'cuenta'
                      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                      : 'bg-[#B71C1C]/20 text-red-400 border-red-500/30'
                  }`}
                >
                  {receiptTab === 'cuenta' ? (
                    <Receipt className="w-5 h-5" />
                  ) : (
                    <UtensilsCrossed className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-white text-base">
                    {receiptTab === 'cuenta' ? 'Gestión de Cuenta' : 'Comanda de Cocina'} • Comanda #{activePrintOrder.order.id}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {activePrintOrder.order.customerName || 'Cliente'} •{' '}
                    {activePrintOrder.order.origin === 'local_pos'
                      ? activePrintOrder.order.tableNumber || 'Salón'
                      : activePrintOrder.order.deliveryType === 'delivery'
                      ? `Delivery (${activePrintOrder.order.zone || 'Domicilio'})`
                      : 'Pick-up'}
                    {' • '}
                    <span className="text-amber-400 font-bold font-mono">
                      {formatUSD(activePrintOrder.order.totalUSD)}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePrintOrder(null);
                  setShowTicketViewer(false);
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Tabs: Cuenta | Cocina */}
            <div className="p-2.5 bg-[#0D0D0E] border-b border-white/10 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptTab('cuenta');
                  setActivePrintOrder({ ...activePrintOrder, type: 'precuenta' });
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  receiptTab === 'cuenta'
                    ? 'bg-[#D4AF37] text-black shadow-lg'
                    : 'bg-[#1C1C20] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Cuenta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReceiptTab('cocina');
                  setActivePrintOrder({ ...activePrintOrder, type: 'comanda' });
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  receiptTab === 'cocina'
                    ? 'bg-[#B71C1C] text-white shadow-lg'
                    : 'bg-[#1C1C20] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Cocina</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 bg-[#141418] space-y-4">
              {/* ==================================================== */}
              {/* 1. PESTAÑA: CUENTA                                   */}
              {/* ==================================================== */}
              {receiptTab === 'cuenta' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Resumen Total de la Cuenta */}
                  <div className="p-3.5 rounded-2xl bg-[#1A1A20] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-zinc-400 font-medium">Total a Pagar</div>
                      <div className="text-2xl font-black font-mono text-emerald-400">
                        {formatUSD(activePrintOrder.order.totalUSD)} USD
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-400">En Bolívares (Tasa BCV {effectiveExchangeRate.toFixed(2)}):</div>
                      <div className="text-base font-bold font-mono text-amber-300">
                        {formatBs(activePrintOrder.order.totalUSD, effectiveExchangeRate)}
                      </div>
                      {Math.abs((activePrintOrder.order.totalBs || 0) - (activePrintOrder.order.totalUSD * effectiveExchangeRate)) > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newTotalBs = activePrintOrder.order.totalUSD * effectiveExchangeRate;
                            if (onUpdateOrder) {
                              onUpdateOrder(activePrintOrder.order.id, { totalBs: newTotalBs });
                            } else {
                              syncManager.updateOrder(activePrintOrder.order.id, { totalBs: newTotalBs });
                            }
                            setActivePrintOrder((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    order: { ...prev.order, totalBs: newTotalBs },
                                  }
                                : null
                            );
                          }}
                          className="mt-1 text-[10px] px-2 py-0.5 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] font-bold border border-[#D4AF37]/40 flex items-center gap-1 transition-all ml-auto cursor-pointer"
                          title="Sincronizar comanda a la tasa BCV del momento"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Actualizar a {effectiveExchangeRate.toFixed(2)} Bs/$</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sección: División de Cuenta */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1C22] to-[#16161B] border border-[#D4AF37]/30 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200 font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#D4AF37]" />
                        Dividir entre personas:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSplitCount((prev) => Math.max(1, prev - 1))}
                          disabled={selectedSplitCount <= 1}
                          className="w-8 h-8 rounded-lg bg-[#25252D] border border-white/10 hover:bg-[#D4AF37] hover:text-black disabled:opacity-30 text-white flex items-center justify-center font-bold text-sm transition-all"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-black text-sm text-white px-3 py-1 rounded-lg bg-black/50 border border-white/10 min-w-[3rem] text-center">
                          {selectedSplitCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSplitCount((prev) => Math.min(20, prev + 1))}
                          disabled={selectedSplitCount >= 20}
                          className="w-8 h-8 rounded-lg bg-[#25252D] border border-white/10 hover:bg-[#D4AF37] hover:text-black disabled:opacity-30 text-white flex items-center justify-center font-bold text-sm transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Presets Rápidos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedSplitCount(1)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedSplitCount === 1
                            ? 'bg-[#D4AF37] text-black shadow'
                            : 'bg-[#22222A] text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        1 (Sin división)
                      </button>
                      {[2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSelectedSplitCount(num)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedSplitCount === num
                              ? 'bg-[#D4AF37] text-black shadow'
                              : 'bg-[#22222A] text-zinc-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {num} pers.
                        </button>
                      ))}
                    </div>

                    {/* Botón de Confirmación de División */}
                    {selectedSplitCount !== confirmedSplitCount && (
                      <div className="pt-1 animate-in fade-in duration-150">
                        {selectedSplitCount > 1 ? (
                          <button
                            type="button"
                            onClick={() => setConfirmedSplitCount(selectedSplitCount)}
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Confirmar División ({selectedSplitCount} personas)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmedSplitCount(1)}
                            className="w-full py-2.5 px-4 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Restablecer a Cuenta Única (1 persona)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Estado de la División Confirmada */}
                    {confirmedSplitCount > 1 ? (
                      <div className="p-3.5 rounded-xl bg-black/50 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>División Activa ({confirmedSplitCount} personas)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSplitCount(1);
                              setConfirmedSplitCount(1);
                            }}
                            className="text-[10px] text-zinc-400 hover:text-red-400 underline font-medium"
                          >
                            Quitar división
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-zinc-400">Cada persona paga:</div>
                            <div className="text-xl font-black font-mono text-emerald-300">
                              {formatUSD((activePrintOrder.order.totalUSD || 0) / confirmedSplitCount)} USD
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-zinc-400">En Bolívares (BCV):</div>
                            <div className="text-sm font-bold font-mono text-amber-300">
                              {formatBs((activePrintOrder.order.totalUSD || 0) / confirmedSplitCount, effectiveExchangeRate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-400 italic bg-black/20 p-2 rounded-lg border border-white/5">
                        * Por defecto la cuenta va completa sin división de personas.
                      </div>
                    )}

                    {/* Fila de Botones: Copiar Desglose & Visualizar Ticket */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopySplitText(activePrintOrder.order, confirmedSplitCount)}
                        className="py-2.5 px-3 rounded-xl bg-[#282832] hover:bg-[#343442] text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 shadow active:scale-95 transition-all"
                      >
                        {copiedSplitText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#D4AF37]" />}
                        <span>{copiedSplitText ? '¡Copiado!' : 'Copiar Desglose'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowTicketViewer((prev) => !prev)}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all ${
                          showTicketViewer
                            ? 'bg-[#D4AF37] text-black shadow-md'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {showTicketViewer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showTicketViewer ? 'Ocultar Ticket' : 'Visualizar Ticket'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Panel de Visualización del Ticket Pre-Cuenta */}
                  {showTicketViewer && (
                    <div className="space-y-3 pt-2 border-t border-white/10 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs text-zinc-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-[#D4AF37]" />
                          Opciones de Pre-Cuenta:
                        </span>
                        {confirmedSplitCount > 1 && (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            División ({confirmedSplitCount} pers.) aplicada
                          </span>
                        )}
                      </div>

                      {/* Botones de Descarga e Impresión para Pre-Cuenta */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          disabled={isExportingImage}
                          onClick={() => handleExportReceiptImage(activePrintOrder.order, 'precuenta', 'jpg', confirmedSplitCount)}
                          className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95"
                          title="Descargar como archivo JPG"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-400" />
                          <span>Descargar JPG</span>
                        </button>

                        <button
                          type="button"
                          disabled={isExportingImage}
                          onClick={() => handleExportReceiptImage(activePrintOrder.order, 'precuenta', 'png', confirmedSplitCount)}
                          className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95"
                          title="Descargar como archivo PNG"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Descargar PNG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintThermal(activePrintOrder.order, 'precuenta', 'browser', confirmedSplitCount)}
                          className="py-2 px-2 rounded-xl bg-[#D4AF37] hover:bg-[#e2bd46] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                          title="Imprimir en impresora térmica usando la fuente digital Plus Jakarta Sans"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Imprimir POS</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBluetoothPrinting}
                          onClick={() => handlePrintThermal(activePrintOrder.order, 'precuenta', 'bluetooth', confirmedSplitCount)}
                          className="py-2 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                          title="Imprimir vía Bluetooth térmico en alta resolución con la fuente Plus Jakarta Sans"
                        >
                          {isBluetoothPrinting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Bluetooth className="w-3.5 h-3.5" />
                          )}
                          <span>Bluetooth</span>
                        </button>
                      </div>

                      {/* Indicador de Fuente Térmica Sincronizada */}
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#18181c] border border-amber-500/20 text-[11px] text-zinc-300">
                        <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Fuente Térmica: <strong className="text-white">Plus Jakarta Sans</strong></span>
                        </span>
                        <span className="text-[10px] text-zinc-400 hidden sm:inline">Idéntica a la etiqueta digital</span>
                      </div>

                      {/* Ticket Renderizado (Pre-cuenta con tipografía agrandada) */}
                      <div className="bg-[#FCFCFA] text-zinc-900 p-6 rounded-xl font-sans tabular-nums text-[16px] leading-snug shadow-inner border border-zinc-300 select-text">
                        <div className="text-center font-bold">
                          <div className="text-2xl tracking-wider font-black">VANDALI</div>
                          <div className="text-sm text-zinc-800 font-bold tracking-wide">PIZZERÍA ARTESANAL</div>
                          <div className="text-xs text-zinc-600 font-semibold mt-0.5">
                            Mérida, Venezuela • {config.phoneFormatted || config.whatsappNumber || '0424-8954741'}
                          </div>
                          <div className="my-2.5 border-2 border-zinc-900 inline-block px-3.5 py-1 text-sm font-black uppercase tracking-wider bg-zinc-50">
                            *** CUENTA / TICKET DE SALIDA ***
                          </div>
                        </div>

                        <div className="border-t-2 border-dashed border-zinc-500 my-2.5"></div>

                        <div className="flex justify-between font-bold text-base">
                          <span>ORDEN:</span>
                          <span className="font-black text-lg">#{activePrintOrder.order.id}</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-700">
                          <span>HORA:</span>
                          <span className="font-semibold">{activePrintOrder.order.date}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm mt-0.5">
                          <span>UBICACIÓN:</span>
                          <span className="font-black">
                            {activePrintOrder.order.origin === 'local_pos'
                              ? activePrintOrder.order.tableNumber || 'Salón'
                              : activePrintOrder.order.deliveryType === 'delivery'
                              ? `Delivery: ${activePrintOrder.order.zone || 'Domicilio'}`
                              : 'Pick-up'}
                          </span>
                        </div>
                        {activePrintOrder.order.customerName && (
                          <div className="flex justify-between font-bold text-sm">
                            <span>CLIENTE:</span>
                            <span>{activePrintOrder.order.customerName}</span>
                          </div>
                        )}

                        <div className="border-t-2 border-zinc-900 my-2.5"></div>

                        {/* Items List */}
                        <div className="space-y-2.5 py-1">
                          {formatOrderItemsForReceipt(activePrintOrder.order, false).map((it, idx) => (
                            <div
                              key={idx}
                              className={it.isTip ? 'pt-1.5 pb-1 border-t border-dashed border-emerald-500 bg-emerald-50/70 -mx-1 px-1 rounded' : ''}
                            >
                              <div className="flex justify-between font-bold text-base">
                                <span className={it.isTip ? 'text-emerald-950 font-black' : ''}>
                                  <span className="font-black text-lg">{it.qty}x</span> {it.name}
                                </span>
                                <span className={`font-black text-base ${it.isTip ? 'text-emerald-900' : ''}`}>
                                  {it.price || '-'}
                                </span>
                              </div>
                              {it.notes && (
                                <div className={`text-xs italic pl-3 ${it.isTip ? 'text-emerald-800 font-semibold' : 'text-zinc-700 font-medium'}`}>
                                  * {it.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="border-t-2 border-dashed border-zinc-400 my-2.5"></div>

                        {/* Totals Breakdown */}
                        <div className="space-y-1.5 pt-1 text-sm">
                          <div className="flex justify-between">
                            <span>SUBTOTAL:</span>
                            <span className="font-semibold">{formatUSD(activePrintOrder.order.subtotalUSD || activePrintOrder.order.totalUSD)}</span>
                          </div>
                          {activePrintOrder.order.discountUSD > 0 && (
                            <div className="flex justify-between text-zinc-700">
                              <span>DESCUENTO:</span>
                              <span className="font-semibold">-{formatUSD(activePrintOrder.order.discountUSD)}</span>
                            </div>
                          )}
                          {activePrintOrder.order.employeeDiscountUSD && activePrintOrder.order.employeeDiscountUSD > 0 && (
                            <div className="flex justify-between text-zinc-700">
                              <span>DESC. EMPLEADO (-${activePrintOrder.order.employeeDiscountPercent || 20}%):</span>
                              <span className="font-semibold">-{formatUSD(activePrintOrder.order.employeeDiscountUSD)}</span>
                            </div>
                          )}
                          {activePrintOrder.order.deliveryCostUSD > 0 && (
                            <div className="flex justify-between">
                              <span>DELIVERY:</span>
                              <span className="font-semibold">{formatUSD(activePrintOrder.order.deliveryCostUSD)}</span>
                            </div>
                          )}
                          {activePrintOrder.order.tipUSD && Number(activePrintOrder.order.tipUSD) > 0 && (
                            <div className="flex justify-between font-bold text-emerald-800">
                              <span>PROPINA VOLUNTARIA:</span>
                              <span className="font-black">+{formatUSD(Number(activePrintOrder.order.tipUSD))}</span>
                            </div>
                          )}
                          <div className="border-t-2 border-dashed border-zinc-800 pt-2 flex justify-between font-black text-base">
                            <span>TOTAL USD:</span>
                            <span className="text-xl font-black">{formatUSD(activePrintOrder.order.totalUSD)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-zinc-600">
                            <span>TASA BCV:</span>
                            <span className="font-semibold">Bs. {effectiveExchangeRate.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-black text-base text-zinc-900">
                            <span>TOTAL EN BS:</span>
                            <span className="font-black text-lg">{formatBs(activePrintOrder.order.totalUSD, effectiveExchangeRate)}</span>
                          </div>
                          <div className="border-t border-dashed border-zinc-400 pt-1 flex justify-between text-xs">
                            <span>MÉTODO DE PAGO:</span>
                            <span className="uppercase font-bold">{activePrintOrder.order.paymentMethod.replace('_', ' ')}</span>
                          </div>

                          {/* Split Breakdown on Ticket if confirmedSplitCount > 1 */}
                          {confirmedSplitCount > 1 && (
                            <div className="border-2 border-zinc-900 bg-zinc-100 p-2.5 my-2.5 rounded text-center space-y-1">
                              <div className="font-black text-xs uppercase tracking-wide">
                                *** CUENTA DIVIDIDA ({confirmedSplitCount} PERSONAS) ***
                              </div>
                              <div className="font-bold text-sm">
                                CADA PERSONA PAGA: <span className="font-black text-base">{formatUSD((activePrintOrder.order.totalUSD || 0) / confirmedSplitCount)} USD</span>
                              </div>
                              <div className="text-xs text-zinc-700 font-semibold">
                                EN BOLÍVARES: {formatBs((activePrintOrder.order.totalUSD || 0) / confirmedSplitCount, effectiveExchangeRate)}
                              </div>
                            </div>
                          )}

                          <div className="text-center text-xs text-zinc-600 pt-3">
                            <div className="font-bold text-zinc-800">¡Gracias por su visita!</div>
                            <div>* Documento de consumo / Ticket de salida *</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* 2. PESTAÑA: COCINA                                   */}
              {/* ==================================================== */}
              {receiptTab === 'cocina' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Botones de Descarga e Impresión para Cocina */}
                  <div className="p-3.5 rounded-2xl bg-[#1A1A20] border border-red-500/30 space-y-2.5">
                    <div className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                      <UtensilsCrossed className="w-4 h-4 text-red-400" />
                      Acciones para Comanda de Cocina:
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        disabled={isExportingImage}
                        onClick={() => handleExportReceiptImage(activePrintOrder.order, 'comanda', 'jpg')}
                        className="py-2.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95"
                        title="Descargar como imagen JPG"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>Descargar JPG</span>
                      </button>

                      <button
                        type="button"
                        disabled={isExportingImage}
                        onClick={() => handleExportReceiptImage(activePrintOrder.order, 'comanda', 'png')}
                        className="py-2.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95"
                        title="Descargar como imagen PNG"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Descargar PNG</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintThermal(activePrintOrder.order, 'comanda', 'browser')}
                        className="py-2.5 px-2 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                        title="Imprimir en impresora térmica de cocina con fuente digital Plus Jakarta Sans"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir POS</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBluetoothPrinting}
                        onClick={() => handlePrintThermal(activePrintOrder.order, 'comanda', 'bluetooth')}
                        className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                        title="Imprimir vía Bluetooth térmico en alta resolución con la fuente Plus Jakarta Sans"
                      >
                        {isBluetoothPrinting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bluetooth className="w-3.5 h-3.5" />
                        )}
                        <span>Bluetooth</span>
                      </button>
                    </div>

                    {/* Indicador de Fuente Térmica Sincronizada */}
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#18181c] border border-amber-500/20 text-[11px] text-zinc-300">
                      <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Fuente Comanda: <strong className="text-white">Plus Jakarta Sans</strong></span>
                      </span>
                      <span className="text-[10px] text-zinc-400 hidden sm:inline">Idéntica a la etiqueta digital</span>
                    </div>
                  </div>

                  {/* Vista Previa del Ticket Térmico de Cocina (tipografía agrandada) */}
                  <div className="bg-[#FCFCFA] text-zinc-900 p-6 rounded-xl font-sans tabular-nums text-[16px] leading-snug shadow-inner border border-zinc-300 select-text">
                    <div className="text-center font-bold">
                      <div className="text-2xl tracking-wider font-black">VANDALI</div>
                      <div className="text-sm text-zinc-800 font-bold tracking-wide">PIZZERÍA ARTESANAL</div>
                      <div className="my-2.5 border-2 border-black inline-block px-4 py-1 text-sm font-black uppercase bg-zinc-200">
                        *** COMANDA COCINA ***
                      </div>
                    </div>

                    <div className="border-t-2 border-dashed border-zinc-500 my-2.5"></div>

                    <div className="flex justify-between font-bold text-base">
                      <span>ORDEN:</span>
                      <span className="font-black text-xl">#{activePrintOrder.order.id}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-700">
                      <span>HORA:</span>
                      <span className="font-semibold">{activePrintOrder.order.date}</span>
                    </div>
                    <div className="flex justify-between font-black text-base bg-zinc-200 px-2 py-1 rounded my-1.5">
                      <span>UBICACIÓN:</span>
                      <span>
                        {activePrintOrder.order.origin === 'local_pos'
                          ? activePrintOrder.order.tableNumber || 'Salón'
                          : activePrintOrder.order.deliveryType === 'delivery'
                          ? `Delivery: ${activePrintOrder.order.zone || 'Domicilio'}`
                          : 'Pick-up'}
                      </span>
                    </div>
                    {activePrintOrder.order.customerName && (
                      <div className="flex justify-between font-bold text-sm">
                        <span>CLIENTE:</span>
                        <span className="font-bold">{activePrintOrder.order.customerName}</span>
                      </div>
                    )}

                    <div className="border-t-2 border-zinc-900 my-2.5"></div>

                    {/* Items List para Cocina */}
                    <div className="space-y-3 py-1">
                      {formatOrderItemsForReceipt(activePrintOrder.order, true).map((it, idx) => (
                        <div key={idx} className="border-b-2 border-dashed border-zinc-300 pb-2 last:border-0">
                          <div className="font-black text-base text-black flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-red-600">{it.qty}x</span>
                            <span className="text-base font-black">{it.name}</span>
                          </div>
                          {it.notes && (
                            <div className="text-xs text-zinc-900 font-bold bg-amber-100 px-2 py-1 rounded mt-1 inline-block border border-amber-300">
                              * {it.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Notas generales de la orden si existen */}
                    {activePrintOrder.order.paymentRef && activePrintOrder.order.paymentRef.startsWith('Nota:') && (
                      <div className="mt-2.5 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-zinc-800 font-medium">
                        Nota: {activePrintOrder.order.paymentRef.replace(/^Nota:\s*/, '')}
                      </div>
                    )}

                    <div className="border-t-2 border-zinc-900 my-2.5"></div>

                    <div className="text-center text-sm font-black pt-1.5 uppercase tracking-wider text-red-700">
                      *** DESPACHAR DE INMEDIATO ***
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Message */}
            {printFeedback && (
              <div className="px-4 py-2 bg-[#1C1C22] border-t border-white/10 text-center text-xs text-[#D4AF37] font-semibold">
                {printFeedback}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Confirm Employee Discount Modal */}
      {confirmDiscountTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-[#D4AF37]">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white font-serif">
                  Confirmar Descuento de Empleado
                </h3>
                <p className="text-xs text-zinc-400">
                  Verificación de seguridad administrativa
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 text-sm text-zinc-200 leading-relaxed">
              Estás a punto de aplicar el descuento de{' '}
              <strong className="text-[#D4AF37] font-bold">
                {confirmDiscountTarget.percent}% de empleado
              </strong>
              {'order' in confirmDiscountTarget && confirmDiscountTarget.order
                ? ` a la comanda #${confirmDiscountTarget.order.id} (${confirmDiscountTarget.order.customerName})`
                : ' a esta comanda de salón'}
              . <br />
              <span className="font-semibold text-white mt-1 block">¿Deseas aplicarlo?</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDiscountTarget(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-white/10 transition-colors"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyConfirmedEmployeeDiscount}
                className="w-full py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#e5be40] text-black font-extrabold text-xs shadow-lg transition-transform active:scale-95"
              >
                Sí, aplicar descuento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Order Editing Modal (Modificar Comanda) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-4xl bg-[#141418] border border-[#D4AF37]/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Header */}
            <div className="p-4 sm:px-6 bg-[#1C1C22] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-[#D4AF37]">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white font-serif flex items-center gap-2">
                    Modificar Comanda #{editingOrder.id}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Agrega extras, modifica ítems o cambia los datos de entrega de esta comanda
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Items List & Adders */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="font-bold text-sm text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <UtensilsCrossed className="w-4 h-4 text-[#D4AF37]" /> Ítems en la Comanda ({editingItems.length})
                  </h4>
                  <span className="text-xs font-mono text-[#D4AF37] font-bold">
                    Subtotal: {formatUSD(editingSubtotalUSD)}
                  </span>
                </div>

                {/* Items container */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editingItems.length === 0 ? (
                    <p className="p-4 text-center text-xs text-zinc-500 bg-black/40 rounded-xl border border-dashed border-zinc-800">
                      No hay ítems en esta comanda. Utiliza los selectores de abajo para agregar pizzas, bebidas o extras.
                    </p>
                  ) : (
                    editingItems.map((it) => (
                      <div
                        key={it.cartId}
                        className="p-2.5 rounded-xl bg-[#1C1C22] border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-white truncate">
                            {it.name} {it.size ? `[${it.size}]` : ''}
                          </div>
                          {it.crustSauce && (
                            <div className="text-[10.5px] text-amber-300 font-medium">
                              Salsa bordes: {it.crustSauce}
                            </div>
                          )}
                          <div className="text-[11px] font-mono text-zinc-400">
                            {formatUSD(it.unitPrice)} c/u • Subtotal:{' '}
                            <span className="text-white font-bold">
                              {formatUSD(it.unitPrice * it.quantity)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center bg-[#121214] rounded-lg border border-white/10">
                            <button
                              type="button"
                              onClick={() => handleEditUpdateItemQuantity(it.cartId, -1)}
                              className="p-1 px-1.5 hover:bg-white/10 text-zinc-300 rounded-l-lg transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-mono text-xs font-bold text-white min-w-[20px] text-center">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditUpdateItemQuantity(it.cartId, 1)}
                              className="p-1 px-1.5 hover:bg-white/10 text-zinc-300 rounded-r-lg transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleEditRemoveItem(it.cartId)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Add Section */}
                <div className="p-3.5 rounded-xl bg-[#18181E] border border-white/10 space-y-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Agregar Más Ítems a la Comanda
                  </h5>

                  {/* 1. Add Pizza */}
                  <div className="space-y-1.5 p-2 rounded-lg bg-[#121216] border border-white/5">
                    <label className="text-[11px] font-bold text-zinc-300 block">
                      🍕 Agregar Pizza del Menú
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <select
                        value={editSelectedPizzaId}
                        onChange={(e) => setEditSelectedPizzaId(e.target.value)}
                        className="sm:col-span-6 p-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-xs text-white outline-none"
                      >
                        <option value="">-- Seleccionar Pizza --</option>
                        {pizzas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.isAvailable === false ? '⛔ [Oculta en Web]' : ''} (Ind: ${p.priceIndividual ?? p.priceL} / Med: ${p.priceL} / Fam: ${p.priceXL})
                          </option>
                        ))}
                      </select>

                      <select
                        value={editSelectedPizzaSize}
                        onChange={(e) => setEditSelectedPizzaSize(e.target.value as PizzaSize)}
                        className="sm:col-span-3 p-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-xs text-white outline-none"
                      >
                        <option value="individual">Individual (20cm)</option>
                        <option value="mediana">Mediana (30cm)</option>
                        <option value="familiar">Familiar (40cm)</option>
                      </select>

                      <button
                        type="button"
                        disabled={!editSelectedPizzaId}
                        onClick={handleEditAddPizza}
                        className="sm:col-span-3 py-1.5 px-2 bg-[#B71C1C] hover:bg-[#c62828] disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>

                  {/* 2. Add Drink, Salsa or Extra */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Drinks */}
                    <div className="space-y-1 p-2 rounded-lg bg-[#121216] border border-white/5">
                      <label className="text-[10.5px] font-bold text-zinc-300 block">
                        🥤 Bebida
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={editSelectedDrinkId}
                          onChange={(e) => setEditSelectedDrinkId(e.target.value)}
                          className="w-full p-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-[11px] text-white outline-none"
                        >
                          <option value="">Elegir...</option>
                          {drinks.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} (${d.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!editSelectedDrinkId}
                          onClick={handleEditAddDrink}
                          className="px-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Salsas */}
                    <div className="space-y-1 p-2 rounded-lg bg-[#121216] border border-white/5">
                      <label className="text-[10.5px] font-bold text-zinc-300 block">
                        🥣 Salsa Extra
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={editSelectedSalsaId}
                          onChange={(e) => setEditSelectedSalsaId(e.target.value)}
                          className="w-full p-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-[11px] text-white outline-none"
                        >
                          <option value="">Elegir...</option>
                          {salsas.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (${s.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!editSelectedSalsaId}
                          onClick={handleEditAddSalsa}
                          className="px-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Extras */}
                    <div className="space-y-1 p-2 rounded-lg bg-[#121216] border border-white/5">
                      <label className="text-[10.5px] font-bold text-zinc-300 block">
                        ✨ Topping / Extra
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={editSelectedExtraId}
                          onChange={(e) => setEditSelectedExtraId(e.target.value)}
                          className="w-full p-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-[11px] text-white outline-none"
                        >
                          <option value="">Elegir...</option>
                          {extras.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name} (${ex.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!editSelectedExtraId}
                          onClick={handleEditAddExtra}
                          className="px-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Add Custom Item / Charge */}
                  <div className="space-y-1.5 p-2 rounded-lg bg-[#121216] border border-white/5">
                    <label className="text-[11px] font-bold text-zinc-300 block">
                      ✏️ Ítem Libre / Cobro Personalizado
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editCustomItemName}
                        onChange={(e) => setEditCustomItemName(e.target.value)}
                        placeholder="Ej: Borde de queso extra, Ingrediente adicional..."
                        className="flex-1 px-2.5 py-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-xs text-white outline-none"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-400 text-xs font-mono font-bold">$</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editCustomItemPrice}
                          onChange={(e) => setEditCustomItemPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-20 px-2 py-1.5 bg-[#1C1C22] border border-white/10 rounded-lg text-xs font-mono font-bold text-white outline-none"
                        />
                        <button
                          type="button"
                          disabled={!editCustomItemName.trim()}
                          onClick={handleEditAddCustomItem}
                          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Customer Info, Delivery Fee & Totals */}
              <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-white font-mono uppercase tracking-wider border-b border-white/10 pb-2">
                    Datos de la Comanda
                  </h4>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={editingCustomerName}
                      onChange={(e) => setEditingCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={editingCustomerPhone}
                        onChange={(e) => setEditingCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Mesa / Ubicación / Tipo</label>
                      <select
                        value={editingTableNumber}
                        onChange={(e) => setEditingTableNumber(e.target.value)}
                        className="w-full p-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                      >
                        <option value="">-- Seleccionar --</option>
                        <optgroup label="🍽️ Mesas en Salón (3 disponibles)">
                          <option value="Mesa 1">Mesa 1</option>
                          <option value="Mesa 2">Mesa 2</option>
                          <option value="Mesa 3">Mesa 3</option>
                        </optgroup>
                        <optgroup label="⏳ Espera de Mesa">
                          <option value="Espera de mesa 1">Espera de mesa 1</option>
                          <option value="Espera de mesa 2">Espera de mesa 2</option>
                          <option value="Espera de mesa 3">Espera de mesa 3</option>
                        </optgroup>
                        <optgroup label="🛵 Delivery">
                          <option value="Delivery 1">Delivery 1</option>
                          <option value="Delivery 2">Delivery 2</option>
                          <option value="Delivery 3">Delivery 3</option>
                          <option value="Delivery 4">Delivery 4</option>
                          <option value="Delivery 5">Delivery 5</option>
                        </optgroup>
                        <optgroup label="🛍️ Pick up / Para Llevar">
                          <option value="Pick up 1">Pick up 1</option>
                          <option value="Pick up 2">Pick up 2</option>
                          <option value="Pick up 3">Pick up 3</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Dirección / Notas de Entrega</label>
                    <input
                      type="text"
                      value={editingAddress}
                      onChange={(e) => setEditingAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Costo Delivery ($)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={editingDeliveryCostUSD}
                        onChange={(e) => setEditingDeliveryCostUSD(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Método de Pago</label>
                      <select
                        value={editingPaymentMethod}
                        onChange={(e) => setEditingPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full p-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                      >
                        <option value="pagomovil">Pago Móvil</option>
                        <option value="efectivo_usd">Efectivo USD ($)</option>
                        <option value="zelle">Zelle</option>
                        <option value="binance">Binance Pay</option>
                      </select>
                    </div>
                  </div>

                  {/* Estado de la Comanda y Propina */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Estado de la Comanda</label>
                      <select
                        value={editingStatus === 'preparando' || editingStatus === 'en_camino' ? 'recibido' : editingStatus}
                        onChange={(e) => setEditingStatus(e.target.value as OrderRecord['status'])}
                        className={`w-full p-2 border rounded-xl text-xs font-bold outline-none cursor-pointer ${
                          editingStatus === 'cancelado'
                            ? 'bg-rose-950/80 border-rose-600/60 text-rose-300'
                            : editingStatus === 'entregado'
                            ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300'
                            : 'bg-[#1C1C22] border-white/10 text-white focus:border-[#D4AF37]'
                        }`}
                      >
                        <option value="recibido" className="bg-[#18181B] text-white">Recibido (En Proceso)</option>
                        <option value="entregado" className="bg-[#18181B] text-white">Entregado (Finalizado)</option>
                        <option value="cancelado" className="bg-[#18181B] text-rose-300">Anulada / Cancelada (No Producida)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Propina ($)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={editingTipUSD}
                        onChange={(e) => setEditingTipUSD(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-[#D4AF37]"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {editingStatus === 'cancelado' && (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/60 text-[11.5px] text-rose-200 leading-relaxed space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        Comanda Anulada / No Producida
                      </div>
                      <p>
                        Al guardar como cancelada, esta orden <strong>NO se sumará al total de ventas</strong> ni a las métricas del cierre de caja de ese día.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Observaciones / Notas Internas</label>
                    <input
                      type="text"
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="Sin orégano, bien tostada..."
                      className="w-full px-3 py-2 bg-[#1C1C22] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {/* Employee Discount Toggle */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#1C1C20] border border-[#D4AF37]/30 cursor-pointer hover:bg-[#25252b] transition-colors">
                      <input
                        type="checkbox"
                        checked={editingApplyDiscount}
                        onChange={(e) => setEditingApplyDiscount(e.target.checked)}
                        className="rounded text-[#B71C1C] focus:ring-0 w-4 h-4 bg-black border-white/20"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Descuento de Empleado (-{config.employeeDiscountDefaultPercent || 20}%)
                        </span>
                        <span className="text-[10.5px] text-zinc-400 block">
                          Aplica sobre el subtotal de ítems
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="p-4 rounded-xl bg-[#18181E] border border-white/10 space-y-2 mt-4">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Subtotal Ítems:</span>
                    <span className="font-mono font-bold">{formatUSD(editingSubtotalUSD)}</span>
                  </div>
                  {editingEmployeeDiscountUSD > 0 && (
                    <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                      <span>Descuento Empleado (-{editingDiscountPercent}%):</span>
                      <span className="font-mono">-{formatUSD(editingEmployeeDiscountUSD)}</span>
                    </div>
                  )}
                  {editingDeliveryCostUSD > 0 && (
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Costo Delivery:</span>
                      <span className="font-mono font-bold">+{formatUSD(editingDeliveryCostUSD)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                    <span className="font-bold text-sm text-white">Total Recalculado:</span>
                    <div className="text-right">
                      <div className="font-mono text-[#D4AF37] font-extrabold text-base">
                        {formatUSD(editingTotalUSD)}
                      </div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        {formatBs(editingTotalUSD, effectiveExchangeRate)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:px-6 bg-[#1C1C22] border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-white/10 transition-colors"
              >
                Descartar Cambios
              </button>

              <button
                type="button"
                onClick={() => setConfirmSaveOrderModal(true)}
                className="px-6 py-2.5 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-transform active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Modificaciones</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3a. Quick Status Change Confirmation Modal (Recibido, Entregado, Anulado/Cancelado) */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  pendingStatusChange.newStatus === 'cancelado'
                    ? 'bg-rose-950/90 border border-rose-500/50 text-rose-400'
                    : 'bg-[#1C1C20] border border-[#D4AF37]/40 text-[#D4AF37]'
                }`}
              >
                {pendingStatusChange.newStatus === 'cancelado' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base text-white font-serif">
                  {pendingStatusChange.newStatus === 'cancelado'
                    ? '¿Anular / Cancelar Comanda?'
                    : '¿Cambiar Estado de la Comanda?'}
                </h3>
                <p className="text-xs text-zinc-400">
                  Comanda #{pendingStatusChange.order.id} • {pendingStatusChange.order.customerName || 'Cliente'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-200 leading-relaxed space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Estado actual:</span>
                <span className="font-bold capitalize text-zinc-300">
                  {pendingStatusChange.order.status === 'preparando' || pendingStatusChange.order.status === 'en_camino'
                    ? 'Recibido'
                    : pendingStatusChange.order.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Nuevo estado:</span>
                <strong
                  className={`font-bold capitalize ${
                    pendingStatusChange.newStatus === 'cancelado'
                      ? 'text-rose-400'
                      : pendingStatusChange.newStatus === 'entregado'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {pendingStatusChange.newStatus === 'cancelado'
                    ? 'Anulada / Cancelada'
                    : pendingStatusChange.newStatus}
                </strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Monto comanda:</span>
                <strong className="text-[#D4AF37] font-mono">
                  {formatUSD(pendingStatusChange.order.totalUSD)} (
                  {formatBs(pendingStatusChange.order.totalUSD, effectiveExchangeRate)})
                </strong>
              </div>

              {pendingStatusChange.newStatus === 'cancelado' && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800/50 text-[11.5px] text-rose-200 leading-snug space-y-1">
                  <div className="font-bold text-rose-300">⚠️ Impacto en Cierre de Caja:</div>
                  <p>
                    Al anular esta orden (por ejemplo, si ingresó fuera de horario o no se pudo producir),
                    su monto se <strong>restará automáticamente</strong> de las ventas del día y del cierre de caja.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingStatusChange(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = pendingStatusChange.order.id;
                  const newSt = pendingStatusChange.newStatus;
                  onUpdateOrderStatus(targetId, newSt);
                  setPendingStatusChange(null);
                  setEditSuccessToast(
                    newSt === 'cancelado'
                      ? `Comanda #${targetId} marcada como cancelada y descontada de métricas.`
                      : `Comanda #${targetId} actualizada a ${newSt}.`
                  );
                  setTimeout(() => setEditSuccessToast(null), 3500);
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 ${
                  pendingStatusChange.newStatus === 'cancelado'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/40'
                    : 'bg-[#B71C1C] hover:bg-[#c62828]'
                }`}
              >
                <span>Sí, proceder con el cambio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3b. Confirm Save Order Modifications Modal */}
      {confirmSaveOrderModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-[#B71C1C]/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white font-serif">
                  Confirmar Modificación de Comanda
                </h3>
                <p className="text-xs text-zinc-400">
                  Actualización y sincronización en tiempo real
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 text-sm text-zinc-200 leading-relaxed space-y-2">
              <p>
                ¿Estás seguro de que deseas guardar los cambios en la comanda{' '}
                <strong className="text-[#D4AF37] font-mono">#{editingOrder.id}</strong> (
                {editingCustomerName})?
              </p>
              <div className="text-xs text-zinc-400 space-y-1">
                <p>
                  Estado: <strong className="text-white capitalize">{editingStatus}</strong>
                </p>
                <p>
                  Monto recalculado:{' '}
                  <strong className="text-white font-mono">{formatUSD(editingTotalUSD)}</strong> (
                  {formatBs(editingTotalUSD, effectiveExchangeRate)})
                </p>
              </div>

              {editingStatus === 'cancelado' && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800/60 text-[11.5px] text-rose-200 mt-2">
                  ⚠️ <strong>Comanda Anulada / Cancelada:</strong> Esta orden se descontará de los totales de venta y de las métricas del cierre de caja.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOrderModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-white/10 transition-colors"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveEditedOrder}
                className="w-full py-2.5 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-extrabold text-xs shadow-lg transition-transform active:scale-95"
              >
                Sí, proceder y guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#18181B] border border-rose-600/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white font-serif">
                  ¿Eliminar Comanda #{orderToDelete.id}?
                </h3>
                <p className="text-xs text-rose-300 font-medium">
                  Esta acción es permanente e irreversible
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-zinc-200 leading-relaxed space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Cliente:</span>
                <strong className="text-white">{orderToDelete.customerName || 'Cliente en Local'}</strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Modalidad:</span>
                <span className="text-zinc-300 font-medium">
                  {orderToDelete.origin === 'local_pos'
                    ? `Local (Mesa ${orderToDelete.tableNumber || 'Salón'})`
                    : orderToDelete.deliveryType === 'delivery'
                    ? 'Delivery'
                    : 'Para Llevar'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Total:</span>
                <strong className="text-[#D4AF37] font-mono">
                  {formatUSD(orderToDelete.totalUSD)} ({formatBs(orderToDelete.totalUSD, effectiveExchangeRate)})
                </strong>
              </div>
              {orderToDelete.itemsSummary && (
                <div className="pt-2 border-t border-white/5 text-[11px] text-zinc-400">
                  <span className="text-zinc-500 block mb-0.5">Resumen de items:</span>
                  <p className="italic line-clamp-2">{orderToDelete.itemsSummary}</p>
                </div>
              )}
              <p className="text-[11px] text-zinc-400 pt-1">
                La orden se eliminará de Cloud Firestore y de todos los monitores de cocina y dispositivos sincronizados en tiempo real.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = orderToDelete.id;
                  if (onDeleteOrder) {
                    onDeleteOrder(targetId);
                  }
                  setOrderToDelete(null);
                  setEditSuccessToast(`Comanda #${targetId} eliminada correctamente`);
                  setTimeout(() => setEditSuccessToast(null), 3500);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-900/40 transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {editSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{editSuccessToast}</span>
        </div>
      )}

      {/* 5. Half & Half Pizza Modal for Admin POS */}
      {showPosHalfModal && (
        <HalfAndHalfModal
          pizzas={pizzas}
          extras={extras}
          exchangeRate={effectiveExchangeRate}
          currencyMode={config.currencyMode || 'both'}
          onClose={() => setShowPosHalfModal(false)}
          onAddToCart={handleAddPosHalfAndHalf}
        />
      )}
    </div>
  );
};
