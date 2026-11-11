import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  MessageCircle,
  MapPin,
  Store,
  CreditCard,
  Check,
  ArrowRight,
  Info,
  Sparkles,
  Award,
  Truck,
  Ticket,
  Pizza,
  Clock,
  Heart,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartItem, AdminConfig, DeliveryType, PaymentMethod, OrderRecord, UserProfile, getPizzaSizeLabel } from '../types';
import {
  formatUSD,
  formatBs,
  calculateCartItemPrice,
  calculateDeliveryCost,
  generateWhatsAppOrderMessage,
  isWithinStoreHours,
  SAFE_DEFAULT_EXCHANGE_RATE,
} from '../utils/currency';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  config: AdminConfig;
  user: UserProfile | null;
  currencyMode: 'both' | 'usd' | 'bs';
  onUpdateQuantity: (cartId: string, delta: number) => void;
  onRemoveItem: (cartId: string) => void;
  onClearCart: () => void;
  onOrderCompleted: (order: OrderRecord, earnedTicket: boolean, usedDiscount: boolean) => void;
  onOpenLoyalty: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  config,
  user,
  currencyMode,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderCompleted,
  onOpenLoyalty,
}) => {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pagomovil');
  const [cashBillsNotes, setCashBillsNotes] = useState('');
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(false);
  const [tipUSD, setTipUSD] = useState<number>(0);
  const [customTipInput, setCustomTipInput] = useState<string>('');
  const [isCustomTip, setIsCustomTip] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync user profile when available
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerPhone) setCustomerPhone(user.phone);
      if (!deliveryAddress && user.address) setDeliveryAddress(user.address);
    }
  }, [user]);

  // Calculations
  const subtotalUSD = (items || []).reduce((acc, it) => acc + calculateCartItemPrice(it), 0);
  
  // Rule: Free delivery for orders >= $10.00, else $1.50
  const deliveryCostUSD = calculateDeliveryCost(subtotalUSD, deliveryType, config);
  const freeDeliveryGoal = config?.freeDeliveryThresholdUSD ?? 10.0; // $10.00
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryGoal - subtotalUSD);

  // Loyalty Discount (30% if unlocked and selected)
  const canUseLoyaltyDiscount = (user?.hasUnlockedDiscount || (user?.loyaltyTickets || 0) >= 10);
  const discountPercent = (canUseLoyaltyDiscount && applyLoyaltyDiscount) ? 30 : 0;
  const discountAmountUSD = (subtotalUSD * discountPercent) / 100;

  const totalUSD = Math.max(0, subtotalUSD - discountAmountUSD + deliveryCostUSD + (tipUSD || 0));

  const parsedRate = Number(config?.exchangeRateBs);
  const exchangeRate = parsedRate && parsedRate > 100 ? parsedRate : SAFE_DEFAULT_EXCHANGE_RATE;
  const totalBs = totalUSD * exchangeRate;

  // Check if this order will earn a loyalty stamp (> $20)
  const willEarnLoyaltyTicket = totalUSD >= 20.0;

  const handleCheckoutWhatsApp = () => {
    setErrorMsg(null);

    if (!items || items.length === 0) {
      setErrorMsg('Tu comanda está vacía. Agrega una pizza Vandali primero.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMsg('Por favor escribe tu Nombre para registrar la orden.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMsg('Por favor escribe tu Teléfono WhatsApp de contacto.');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      setErrorMsg('Por favor indica tu Dirección de Entrega en Mérida.');
      return;
    }

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#B71C1C', '#D4AF37', '#ffffff'],
      });
    } catch {
      // ignore
    }

    // Summary text for order record
    const summaryItems = items.map((it) => {
      const typeLabel = it.type === 'half-half' ? `Mitad&Mitad (${it.name})` : it.name;
      const sizeLabel = it.size ? ` [${getPizzaSizeLabel(it.size)}]` : '';
      const sauceLabel = it.crustSauce ? ` [Salsa bordes: ${it.crustSauce}]` : '';
      const extrasLabel = it.extras && it.extras.length > 0 ? ` (+${it.extras.map(e => e.name).join(', ')})` : '';
      return `${it.quantity}x ${typeLabel}${sizeLabel}${sauceLabel}${extrasLabel}`;
    });

    if (tipUSD > 0) {
      summaryItems.push(`1x Propina voluntaria (Servicio) (+${formatUSD(tipUSD)})`);
    }

    const summaryList = summaryItems.join(' | ');

    // Register order in memory / admin storage
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    const newOrder: OrderRecord = {
      id: `VAN-${Date.now().toString().slice(-5)}`,
      date: `${formattedDate} ${formattedTime}`,
      timestamp: Date.now(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: user?.email,
      deliveryType,
      address: deliveryType === 'delivery' ? deliveryAddress.trim() : 'Pick-up en Local',
      paymentMethod,
      paymentRef: cashBillsNotes ? `Detalle: ${cashBillsNotes}` : 'Envío de datos por WhatsApp',
      itemsSummary: summaryList,
      rawItems: items,
      subtotalUSD,
      deliveryCostUSD,
      discountUSD: discountAmountUSD,
      tipUSD: tipUSD > 0 ? Number(tipUSD) : 0,
      totalUSD,
      totalBs,
      origin: 'web',
      status: 'recibido',
    };

    onOrderCompleted(newOrder, willEarnLoyaltyTicket, applyLoyaltyDiscount);

    // Generate WhatsApp encoded message
    const message = generateWhatsAppOrderMessage(
      items,
      config,
      deliveryType,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryReference,
      paymentMethod,
      undefined,
      cashBillsNotes,
      undefined,
      discountPercent,
      undefined,
      tipUSD
    );

    const cleanPhone = config.whatsappNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    window.open(whatsappUrl, '_blank');
    setPaymentMethod('pagomovil');
    setCashBillsNotes('');
    setTipUSD(0);
    setCustomTipInput('');
    setIsCustomTip(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-md bg-[#0D0D0F] border-l border-white/10 flex flex-col shadow-2xl text-zinc-200">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#141414] to-[#0A0A0A] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#B71C1C] flex items-center justify-center text-white font-bold text-sm">
                V
              </div>
              <div>
                <h3
                  className="font-bold text-base text-white font-serif"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  Tu Comanda Vandali
                </h3>
                <span className="text-[11px] text-zinc-400">
                  {items.length} {items.length === 1 ? 'producto' : 'productos'} agregados
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  onClick={onClearCart}
                  className="p-1.5 rounded-lg hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 text-xs transition-colors"
                  title="Vaciar comanda"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[#1C1C1C] text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Delivery Incentive Bar (Free delivery > $10) */}
          {deliveryType === 'delivery' && (
            <div className="p-3 bg-[#141418] border-b border-white/10 text-xs">
              {amountNeededForFreeDelivery > 0 ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-zinc-300 font-medium flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Te faltan <strong className="text-[#D4AF37] font-mono">{formatUSD(amountNeededForFreeDelivery)}</strong> para <strong>Delivery GRATIS</strong>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (Costo actual: $1.50)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#252525] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#B71C1C] to-[#D4AF37] transition-all duration-300"
                      style={{ width: `${Math.min(100, (subtotalUSD / freeDeliveryGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>¡Felicidades! Tienes DELIVERY GRATIS en tu orden</span>
                </div>
              )}
            </div>
          )}

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Cart Items List */}
            {items.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#181818] border border-white/10 flex items-center justify-center text-zinc-400">
                  <Pizza className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <p className="text-sm font-medium text-zinc-400">
                  Tu comanda está esperando una buena pizza artesanal
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#B71C1C] text-white text-xs font-bold uppercase tracking-wider shadow-md hover:bg-[#c62828]"
                >
                  Ver Menú de Pizzas
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const itemPriceUSD = calculateCartItemPrice(it);
                  return (
                    <div
                      key={it.cartId}
                      className="p-3.5 rounded-xl bg-[#141414] border border-white/10 flex flex-col justify-between gap-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-white leading-snug">
                            {it.type === 'half-half' ? (
                              <span className="text-[#D4AF37]">Mitad & Mitad</span>
                            ) : (
                              it.name
                            )}
                          </h4>
                          {it.type === 'half-half' && (
                            <p className="text-[11px] text-zinc-400">
                              1/2 {it.half1?.name} + 1/2 {it.half2?.name}
                            </p>
                          )}
                          {it.size && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#1E1E1E] text-[10px] font-mono text-zinc-300">
                              Tamaño {getPizzaSizeLabel(it.size)}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-white">
                            {formatUSD(itemPriceUSD)}
                          </span>
                          <div className="text-[10px] font-mono text-[#D4AF37]">
                            {formatBs(itemPriceUSD, config.exchangeRateBs)}
                          </div>
                        </div>
                      </div>

                      {/* Add-ons and Modifiers */}
                      {((it.extras && it.extras.length > 0) || it.crustSauce || (it.removedIngredients && it.removedIngredients.length > 0) || it.notes) && (
                        <div className="text-[11px] text-zinc-400 space-y-1 pt-1 border-t border-white/5">
                          {it.crustSauce && (
                            <div className="text-emerald-400 font-medium flex items-center justify-between gap-1">
                              <span className="truncate">Salsa bordes: {it.crustSauce}</span>
                              <span className="text-[9px] font-bold uppercase bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-700/60 shrink-0">
                                Gratis
                              </span>
                            </div>
                          )}
                          {it.extras?.map((ex) => (
                            <div key={ex.id}>+ {ex.name} (+${Number(ex.price).toFixed(2)})</div>
                          ))}
                          {it.removedIngredients?.map((ing, i) => (
                            <div key={i} className="text-rose-400 line-through">Sin {ing}</div>
                          ))}
                          {it.notes && (
                            <div className="italic text-zinc-500">"{it.notes}"</div>
                          )}
                        </div>
                      )}

                      {/* Quantity Modifier Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <button
                          onClick={() => onRemoveItem(it.cartId)}
                          className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>

                        <div className="flex items-center gap-2 bg-[#1A1A1A] p-0.5 rounded-lg border border-white/10">
                          <button
                            onClick={() => onUpdateQuantity(it.cartId, -1)}
                            className="p-1 rounded text-zinc-400 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs text-white">
                            {it.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(it.cartId, 1)}
                            className="p-1 rounded text-zinc-400 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Delivery vs Pick-up Switcher */}
            {items.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div>
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-2 font-mono">
                    Modalidad de Entrega
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('delivery')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        deliveryType === 'delivery'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#121212] border-white/10 text-zinc-400'
                      }`}
                    >
                      <MapPin className="w-4 h-4 text-[#B71C1C]" />
                      <div>
                        <div className="font-bold text-xs">Delivery a Domicilio</div>
                        <div className="text-[10px] text-zinc-400">
                          {subtotalUSD >= 10 ? '¡Gratis!' : '$1.50'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('pickup')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        deliveryType === 'pickup'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#121212] border-white/10 text-zinc-400'
                      }`}
                    >
                      <Store className="w-4 h-4 text-[#D4AF37]" />
                      <div>
                        <div className="font-bold text-xs">Retiro en Local</div>
                        <div className="text-[10px] text-zinc-400">Sin costo</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-3 bg-[#121214] p-3.5 rounded-xl border border-white/5">
                  <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                    Datos del Cliente
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Nombre y Apellido <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Tu nombre completo"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Teléfono WhatsApp <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej: 04126789012"
                      className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {deliveryType === 'delivery' && (
                    <>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          Dirección Exacta en Mérida <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Calle, edificio/casa, piso, apto..."
                          className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          Punto de Referencia (Opcional)
                        </label>
                        <input
                          type="text"
                          value={deliveryReference}
                          onChange={(e) => setDeliveryReference(e.target.value)}
                          placeholder="Cerca de panadería, portón negro..."
                          className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Loyalty Program Reward Box in Cart */}
                {canUseLoyaltyDiscount && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 to-[#B71C1C]/20 border border-[#D4AF37]/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-[#D4AF37]" />
                        <div>
                          <div className="font-bold text-xs text-white">
                            30% de Descuento Vandali Club Disponible
                          </div>
                          <div className="text-[10px] text-zinc-300">
                            Completaste tus 10 sellos de fidelidad
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setApplyLoyaltyDiscount(!applyLoyaltyDiscount)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          applyLoyaltyDiscount
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#D4AF37] text-black hover:bg-[#c49f27]'
                        }`}
                      >
                        {applyLoyaltyDiscount ? 'Aplicado' : 'Aplicar -30%'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Loyalty stamp ticket notice if > $20 */}
                {willEarnLoyaltyTicket && (
                  <div className="p-2.5 rounded-xl bg-[#141414] border border-[#D4AF37]/30 flex items-center gap-2 text-xs text-zinc-300">
                    <Ticket className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <span>
                      Esta orden mayor a $20 sumará <strong className="text-[#D4AF37]">+1 Sello</strong> a tu Tarjeta de Fidelidad
                    </span>
                  </div>
                )}

                {/* Payment Method Selector (No bank details shown - WhatsApp instruction banner) */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block font-mono">
                    Forma de Pago
                  </label>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pagomovil')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        paymentMethod === 'pagomovil'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#141414] border-white/10 text-zinc-400'
                      }`}
                    >
                      Pago Móvil
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('zelle')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        paymentMethod === 'zelle'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#141414] border-white/10 text-zinc-400'
                      }`}
                    >
                      Zelle (USD)
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('efectivo_usd')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        paymentMethod === 'efectivo_usd'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#141414] border-white/10 text-zinc-400'
                      }`}
                    >
                      Efectivo $
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('binance')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        paymentMethod === 'binance'
                          ? 'bg-[#1C1C1C] border-[#B71C1C] text-white ring-1 ring-[#B71C1C]'
                          : 'bg-[#141414] border-white/10 text-zinc-400'
                      }`}
                    >
                      Binance Pay
                    </button>
                  </div>

                  {/* Sección de Propina Opcional */}
                  <div className="p-3.5 rounded-2xl bg-[#141418] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                          <Heart className="w-3.5 h-3.5 text-[#D4AF37]" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white block">Propina para el equipo (Opcional)</span>
                          <span className="text-[10px] text-zinc-400 block">Reconoce a los pizzeros y repartidores de Vandali</span>
                        </div>
                      </div>
                      {tipUSD > 0 && (
                        <span className="font-mono text-xs font-bold text-[#D4AF37]">
                          +{formatUSD(tipUSD)}
                        </span>
                      )}
                    </div>

                    {/* Quick buttons */}
                    <div className="grid grid-cols-5 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setTipUSD(0);
                          setIsCustomTip(false);
                          setCustomTipInput('');
                        }}
                        className={`py-1.5 px-1 rounded-xl text-center text-[11px] font-bold border transition-all ${
                          tipUSD === 0 && !isCustomTip
                            ? 'bg-zinc-800 border-white/30 text-white'
                            : 'bg-[#1A1A1E] border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        $0
                      </button>
                      {[1, 2, 3].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setTipUSD(val);
                            setIsCustomTip(false);
                            setCustomTipInput('');
                          }}
                          className={`py-1.5 px-1 rounded-xl text-center text-[11px] font-bold border transition-all ${
                            tipUSD === val && !isCustomTip
                              ? 'bg-[#B71C1C] border-[#D4AF37] text-white shadow-sm'
                              : 'bg-[#1A1A1E] border-white/5 text-zinc-300 hover:text-white hover:border-white/20'
                          }`}
                        >
                          ${val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomTip(true);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-center text-[11px] font-bold border transition-all ${
                          isCustomTip
                            ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-extrabold'
                            : 'bg-[#1A1A1E] border-white/5 text-zinc-300 hover:text-white'
                        }`}
                      >
                        Otro $
                      </button>
                    </div>

                    {/* Custom variable tip input */}
                    {isCustomTip && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#D4AF37]">$</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="Monto variable (ej: 1.50)"
                            value={customTipInput}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              setCustomTipInput(valStr);
                              const valNum = Math.max(0, parseFloat(valStr) || 0);
                              setTipUSD(valNum);
                            }}
                            className="w-full pl-7 pr-3 py-1.5 bg-[#1C1C22] border border-[#D4AF37]/50 rounded-xl text-xs font-mono text-white outline-none focus:border-[#D4AF37]"
                            autoFocus
                          />
                        </div>
                        {tipUSD > 0 && (
                          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                            ≈ {formatBs(tipUSD, config.exchangeRateBs)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Clarification banner: Payment data handled via WhatsApp */}
                  <div className="p-3 rounded-xl bg-[#141418] border border-[#D4AF37]/30 text-[11px] text-zinc-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Pago seguro por WhatsApp:</strong> Los datos de cuenta exactos para realizar tu pago se enviarán automáticamente a través de WhatsApp una vez confirmada la orden.
                    </div>
                  </div>

                  {(paymentMethod === 'efectivo_usd' || paymentMethod === 'efectivo_bs') && (
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        ¿Con qué billete cancelas? (Para preparar tu cambio)
                      </label>
                      <input
                        type="text"
                        value={cashBillsNotes}
                        onChange={(e) => setCashBillsNotes(e.target.value)}
                        placeholder="Ej: Pago con billete de $20 / Pago exacto"
                        className="w-full px-3 py-2 bg-[#181818] border border-white/10 rounded-xl text-xs text-white outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer / Totals & Checkout Button */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 bg-[#0A0A0A] border-t border-white/10 space-y-3">
              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-zinc-200">{formatUSD(subtotalUSD)}</span>
                </div>

                {discountAmountUSD > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Descuento Club Vandali (-30%):</span>
                    <span className="font-mono font-bold">-{formatUSD(discountAmountUSD)}</span>
                  </div>
                )}

                {deliveryType === 'delivery' && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Costo de Delivery:</span>
                    <span className="font-mono text-zinc-200">
                      {deliveryCostUSD === 0 ? (
                        <span className="text-emerald-400 font-bold">¡GRATIS!</span>
                      ) : (
                        formatUSD(deliveryCostUSD)
                      )}
                    </span>
                  </div>
                )}

                {tipUSD > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span className="flex items-center gap-1 font-medium">
                      <Heart className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" /> Propina voluntaria:
                    </span>
                    <span className="font-mono font-bold">+{formatUSD(tipUSD)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-white text-sm block">Total a Pagar:</span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      (Tasa: 1$ = Bs. {exchangeRate.toFixed(2)})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-white leading-none">
                      {formatUSD(totalUSD)}
                    </div>
                    <div className="font-mono text-xs text-[#D4AF37] font-semibold mt-1">
                      {formatBs(totalUSD, exchangeRate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule and Working Hours Notice */}
              <div className="p-3 rounded-xl bg-[#141416] border border-white/10 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold text-[11.5px] uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Horario de Trabajo</span>
                </div>
                <p className="text-[11.5px] text-zinc-300 font-medium leading-relaxed">
                  De lunes a viernes de <strong className="text-white">4:00 PM a 11:00 PM</strong> y sábados y domingos de <strong className="text-white">12:00 PM a 11:00 PM</strong>.
                </p>
                {!isWithinStoreHours(config).isOpen && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-start gap-1.5 text-[11px] text-amber-300/90 leading-tight">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Estás realizando tu pedido fuera de nuestro horario habitual. Tu orden quedará registrada y se procesará a la brevedad al abrir el local.</span>
                  </div>
                )}
              </div>

              {/* Main Submit WhatsApp Button */}
              <button
                type="button"
                onClick={handleCheckoutWhatsApp}
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(37,211,102,0.3)] active:scale-95 transition-all"
              >
                <MessageCircle className="w-5 h-5 fill-black" />
                <span>Enviar Pedido por WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
