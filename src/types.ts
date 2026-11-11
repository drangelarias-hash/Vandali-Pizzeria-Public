export type PizzaSize = 'individual' | 'mediana' | 'familiar' | 'L' | 'XL';

export function getPizzaSizeLabel(size?: PizzaSize | string): string {
  if (!size) return '';
  const s = size.toLowerCase();
  if (s === 'individual' || s === 'ind') return 'Individual (20cm)';
  if (s === 'mediana' || s === 'l') return 'Mediana (30cm)';
  if (s === 'familiar' || s === 'xl') return 'Familiar (40cm)';
  return size;
}

export function getPizzaSizeShort(size?: PizzaSize | string): string {
  if (!size) return '';
  const s = size.toLowerCase();
  if (s === 'individual' || s === 'ind') return 'Individual';
  if (s === 'mediana' || s === 'l') return 'Mediana';
  if (s === 'familiar' || s === 'xl') return 'Familiar';
  return size;
}

export function getPizzaPrice(pizza: PizzaItem, size: PizzaSize = 'mediana'): number {
  const s = String(size).toLowerCase();
  if (s === 'individual' || s === 'ind') {
    return pizza.priceIndividual !== undefined ? pizza.priceIndividual : pizza.priceL;
  }
  if (s === 'familiar' || s === 'xl') {
    return pizza.priceXL;
  }
  return pizza.priceL;
}

export type Category = 'pizzas' | 'bebidas' | 'extras' | 'mitad';

export type SauceBase = 'napolitana' | 'blanca';

export interface PizzaItem {
  id: string;
  name: string;
  description: string;
  sauce: SauceBase;
  ingredients: string[];
  priceIndividual: number; // 20cm (Individual)
  priceL: number; // 30cm (Mediana)
  priceXL: number; // 40cm (Familiar)
  isPopular?: boolean;
  isVegetarian?: boolean;
  isAvailable: boolean;
  tagline?: string;
  image?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'bebidas' | 'extras' | 'salsas';
  description: string;
  price: number;
  isAvailable: boolean;
  volumeOrSize?: string;
  image?: string;
}

export interface CartExtra {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  cartId: string;
  type: 'pizza' | 'item' | 'half-half';
  id: string;
  name: string;
  size?: PizzaSize;
  unitPrice: number;
  quantity: number;
  extras: CartExtra[];
  crustSauce?: string; // Salsas acompañantes de bordes (Gratis / 1 por pizza)
  stuffedCrust?: boolean;
  removedIngredients?: string[];
  notes?: string;
  half1?: { id: string; name: string };
  half2?: { id: string; name: string };
}

export interface CrustSauceOption {
  id: string;
  name: string;
  shortName: string;
  description: string;
  price: number;
}

export const CRUST_SAUCE_EXTRA_PRICE = 1.5;

export const COMPLIMENTARY_CRUST_SAUCES: CrustSauceOption[] = [
  {
    id: 'sauce-napolitana',
    name: 'Salsa Napolitana',
    shortName: 'Salsa Napolitana',
    description: 'Nuestra auténtica salsa pomodoro italiana para dipear y disfrutar cada bocado del borde.',
    price: 0,
  },
  {
    id: 'sauce-ajo',
    name: 'Mantequilla de ajo',
    shortName: 'Mantequilla de ajo',
    description: 'Mantequilla suave aromatizada con ajo confitado y finas hierbas para bañar tu corteza.',
    price: 0,
  },
  {
    id: 'sauce-picante',
    name: 'Aceite de oliva picante',
    shortName: 'Aceite de oliva picante',
    description: 'Aceite de oliva virgen extra infusionado con hojuelas de pepperoncinos picantes.',
    price: 0,
  },
];

export type DeliveryType = 'delivery' | 'pickup' | 'mesa';

export type PaymentMethod = 'pagomovil' | 'zelle' | 'efectivo_usd' | 'binance';

export interface DeliveryZone {
  id: string;
  name: string;
  priceUSD: number;
  estimatedTime: string;
}

export interface PizzaOfTheMonthConfig {
  enabled: boolean;
  monthName: string; // e.g. 'Noviembre'
  pizzaId: string; // e.g. 'diablo-ruso'
  badge?: string; // e.g. 'Edición Especial • Noviembre'
  highlightTag?: string; // e.g. 'Salsa de Vodka Picante + Pepperoni + Miel'
  customTitle?: string; // e.g. 'DIABLO RUSO'
  customSubtitle?: string;
  customDescription?: string;
}

export interface AdminConfig {
  exchangeRateBs: number; // e.g. 896.12 Bs per 1 USD (BCV Oficial)
  exchangeRateMode?: 'auto' | 'manual'; // 'auto' (BCV/Weekend) or 'manual' (Locked)
  manualExchangeRateBs?: number; // Last manual rate specified by administrator
  forceAdminOverride?: boolean; // Explicit flag when administrator intentionally toggles modes
  employeeDiscountDefaultPercent?: number; // default 20%
  googleSheetsWebhookUrl?: string; // Google Apps Script Webhook URL
  rateSource: 'api_bcv' | 'api_paralelo' | 'manual';
  lastRateUpdate?: string;
  whatsappNumber: string; // e.g. 584248954741
  phoneFormatted?: string; // 0424-8954741
  storeName: string;
  location: string;
  instagram: string; // vandali.pizzeria
  adminRecoveryEmail?: string; // vandali.pizzeria@gmail.com
  isOpen: boolean;
  autoSchedule: boolean;
  openingHour: number; // 16 (4pm)
  closingHour: number; // 23 (11pm)
  daysOpen: string; // 'Lunes a Domingo'
  freeDeliveryThresholdUSD: number; // $10.00
  standardDeliveryPriceUSD: number; // $1.50
  pizzaOfTheMonth?: PizzaOfTheMonthConfig;
  pagoMovil: {
    banco: string;
    telefono: string;
    cedula: string;
    titular: string;
  };
  zelle: {
    email: string;
    titular: string;
  };
  binance: {
    payId: string;
    network: string;
    usdtAddress: string;
  };
  deliveryZones: DeliveryZone[];
}

export interface OrderRecord {
  id: string;
  date: string;
  timestamp: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  tableNumber?: string; // For in-store dining/comandas
  address?: string;
  zone?: string;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  itemsSummary: string;
  rawItems?: CartItem[];
  subtotalUSD: number;
  deliveryCostUSD: number;
  discountUSD: number;
  employeeDiscountUSD?: number;
  employeeDiscountPercent?: number;
  tipUSD?: number;
  totalUSD: number;
  totalBs: number;
  origin: 'web' | 'local_pos';
  status: 'recibido' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string; // Required for full account & loyalty registration
  phone: string;
  password?: string;
  address?: string;
  loyaltyTickets: number; // 0 to 10. Each order > $20 gives +1 ticket
  hasUnlockedDiscount: boolean; // True when 10 tickets are reached (30% discount)
  totalSpentUSD: number;
  completedOrdersCount: number;
  createdAt: string;
}
