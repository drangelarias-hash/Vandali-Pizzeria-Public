import React, { useState, useEffect } from 'react';
import { X, Split, Plus, Minus, Info, Droplets, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { PizzaItem, PizzaSize, CartExtra, CartItem, SauceBase, MenuItem, COMPLIMENTARY_CRUST_SAUCES, CRUST_SAUCE_EXTRA_PRICE, getPizzaPrice, getPizzaSizeLabel } from '../types';
import { formatUSD, formatBs } from '../utils/currency';

interface HalfAndHalfModalProps {
  pizzas: PizzaItem[];
  initialPizzaId?: string;
  initialSize?: PizzaSize;
  extras?: MenuItem[];
  exchangeRate: number;
  currencyMode: 'both' | 'usd' | 'bs';
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

const DEFAULT_EXTRAS: CartExtra[] = [
  { id: 'extra-mozzarella', name: 'Extra Mozzarella Gratinada', price: 1.5 },
  { id: 'extra-cabra', name: 'Queso de Cabra Andino', price: 2.0 },
  { id: 'extra-pepperoni', name: 'Doble Pepperoni Crujiente', price: 1.8 },
  { id: 'extra-tocineta', name: 'Tiras de Tocineta Ahumada', price: 1.8 },
  { id: 'extra-pesto', name: 'Pesto Vándalo Adicional', price: 1.5 },
  { id: 'extra-champi', name: 'Champiñones Frescos', price: 1.5 },
];

const normalizePizzaSize = (s?: PizzaSize | string): PizzaSize => {
  if (!s) return 'familiar';
  const lower = String(s).toLowerCase();
  if (lower === 'familiar' || lower === 'xl') return 'familiar';
  if (lower === 'individual' || lower === 'ind') return 'individual';
  return 'mediana';
};

export const HalfAndHalfModal: React.FC<HalfAndHalfModalProps> = ({
  pizzas,
  initialPizzaId,
  initialSize = 'familiar',
  extras,
  exchangeRate,
  currencyMode,
  onClose,
  onAddToCart,
}) => {
  const [size, setSize] = useState<PizzaSize>(() => normalizePizzaSize(initialSize));

  useEffect(() => {
    if (initialSize) {
      setSize(normalizePizzaSize(initialSize));
    }
  }, [initialSize, initialPizzaId]);

  // Group available pizzas by sauce base (excluding Pizza del Mes: Miss Vandali / Diablo Ruso)
  const eligiblePizzas = pizzas.filter(
    (p) =>
      p.id !== 'miss-vandali' &&
      !p.name.toLowerCase().includes('miss vandali') &&
      p.id !== 'diablo-ruso' &&
      !p.name.toLowerCase().includes('diablo') &&
      !p.tagline?.toLowerCase().includes('mes')
  );

  const napolitanaPizzas = eligiblePizzas.filter(
    (p) => (p.sauce === 'napolitana' || !p.sauce) && p.isAvailable !== false
  );
  const blancaPizzas = eligiblePizzas.filter(
    (p) => p.sauce === 'blanca' && p.isAvailable !== false
  );

  // Initial sauce base from initialPizzaId or default to 'napolitana'
  const initialPizza =
    (initialPizzaId && eligiblePizzas.find((p) => p.id === initialPizzaId)) ||
    napolitanaPizzas[0] ||
    eligiblePizzas[0] ||
    pizzas[0];

  const [selectedSauce, setSelectedSauce] = useState<SauceBase>(
    () => initialPizza?.sauce || 'napolitana'
  );

  const currentPool = selectedSauce === 'blanca' ? blancaPizzas : napolitanaPizzas;
  const activePool = currentPool.length > 0 ? currentPool : pizzas;

  const [half1Id, setHalf1Id] = useState<string>(() => {
    if (initialPizza && activePool.some((p) => p.id === initialPizza.id)) {
      return initialPizza.id;
    }
    return activePool[0]?.id || '';
  });

  const [half2Id, setHalf2Id] = useState<string>(() => {
    const defaultHalf1 = initialPizza?.id || activePool[0]?.id;
    const otherPizza = activePool.find((p) => p.id !== defaultHalf1);
    return otherPizza ? otherPizza.id : activePool[1]?.id || activePool[0]?.id || '';
  });

  const [selectedCrustSauce, setSelectedCrustSauce] = useState<string>(
    initialSize === 'individual' ? 'sin_salsa' : COMPLIMENTARY_CRUST_SAUCES[0].name
  );
  const [selectedExtrasQty, setSelectedExtrasQty] = useState<{ [extraId: string]: number }>({});
  const [quantity, setQuantity] = useState(1);

  const isIndividual = size === 'individual';
  const hasSauceExtra = isIndividual && selectedCrustSauce && selectedCrustSauce !== 'sin_salsa';
  const sauceExtraPrice = hasSauceExtra ? CRUST_SAUCE_EXTRA_PRICE : 0;

  // Use dynamic extras configured in Admin, or fallback to default
  const activeExtrasList: CartExtra[] = (extras && extras.length > 0)
    ? extras
        .filter((e) => e.isAvailable !== false)
        .map((e) => ({ id: e.id, name: e.name, price: Number(e.price) || 0 }))
    : DEFAULT_EXTRAS;

  const selectedExtras: CartExtra[] = Object.entries(selectedExtrasQty).flatMap(([extraId, qty]) => {
    const extraItem = activeExtrasList.find((e) => e.id === extraId);
    const qtyNum = Number(qty);
    if (!extraItem || qtyNum <= 0) return [];
    if (qtyNum === 1) {
      return [{ id: extraItem.id, name: extraItem.name, price: extraItem.price }];
    }
    return [
      {
        id: extraItem.id,
        name: `${extraItem.name} (${qtyNum === 2 ? 'Doble' : `x${qtyNum}`})`,
        price: extraItem.price * qtyNum,
      },
    ];
  });

  // Sync if initialPizzaId changes
  useEffect(() => {
    if (initialPizzaId) {
      const found = pizzas.find((p) => p.id === initialPizzaId);
      if (found) {
        const targetSauce = found.sauce || 'napolitana';
        setSelectedSauce(targetSauce);
        setHalf1Id(found.id);
        const pool = (targetSauce === 'blanca' ? blancaPizzas : napolitanaPizzas).filter(
          (p) => p.isAvailable !== false
        );
        const other = pool.find((p) => p.id !== found.id) || pool[0];
        if (other) {
          setHalf2Id(other.id);
        }
      }
    }
  }, [initialPizzaId, pizzas]);

  const handleSauceChange = (newSauce: SauceBase) => {
    setSelectedSauce(newSauce);
    const pool = (newSauce === 'blanca' ? blancaPizzas : napolitanaPizzas).filter(
      (p) => p.isAvailable !== false
    );
    if (pool.length > 0) {
      setHalf1Id(pool[0].id);
      setHalf2Id(pool[1]?.id || pool[0].id);
    }
  };

  const handleUpdateExtraQty = (extraId: string, delta: number) => {
    setSelectedExtrasQty((prev) => {
      const current = prev[extraId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[extraId];
        return copy;
      }
      return { ...prev, [extraId]: next };
    });
  };

  const half1 = activePool.find((p) => p.id === half1Id) || activePool[0] || pizzas[0];
  const half2 = activePool.find((p) => p.id === half2Id) || activePool[1] || activePool[0] || pizzas[0];

  const priceHalf1 = half1 ? getPizzaPrice(half1, size) : 0;
  const priceHalf2 = half2 ? getPizzaPrice(half2, size) : 0;
  const basePrice = Math.max(priceHalf1, priceHalf2);
  const extrasTotal = selectedExtras.reduce((acc, curr) => acc + curr.price, 0) + sauceExtraPrice;
  const unitPrice = basePrice + extrasTotal;
  const totalPriceUSD = unitPrice * quantity;

  const handleSelectSize = (newSize: PizzaSize) => {
    setSize(newSize);
    if (newSize === 'individual') {
      if (selectedCrustSauce !== 'sin_salsa') {
        setSelectedCrustSauce('sin_salsa');
      }
    } else {
      if (selectedCrustSauce === 'sin_salsa') {
        setSelectedCrustSauce(COMPLIMENTARY_CRUST_SAUCES[0].name);
      }
    }
  };

  const handleAdd = () => {
    if (!half1 || !half2) return;
    const finalExtras: CartExtra[] = [...selectedExtras];
    if (hasSauceExtra) {
      finalExtras.push({
        id: `extra-sauce-${selectedCrustSauce.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Salsa Bordes: ${selectedCrustSauce}`,
        price: CRUST_SAUCE_EXTRA_PRICE,
      });
    }

    const cartItem: CartItem = {
      cartId: `half-${half1.id}-${half2.id}-${size}-${Date.now()}`,
      type: 'half-half',
      id: `half-${half1.id}-${half2.id}`,
      name: `Mitad ${half1.name} / Mitad ${half2.name}`,
      size,
      unitPrice: basePrice + extrasTotal,
      quantity,
      extras: finalExtras,
      crustSauce: selectedCrustSauce && selectedCrustSauce !== 'sin_salsa' ? selectedCrustSauce : undefined,
      notes: `Base: Salsa ${selectedSauce === 'blanca' ? 'Blanca' : 'Napolitana'}`,
      half1: { id: half1.id, name: half1.name },
      half2: { id: half2.id, name: half2.name },
    };
    onAddToCart(cartItem);
    onClose();
  };

  if (!half1 || !half2) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0F0F0F] border-2 border-[#D4AF37]/30 shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-br from-[#1A1A1A] via-[#121212] to-[#0A0A0A] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-black flex items-center justify-center font-bold shadow-md">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="text-xl font-bold text-white font-serif"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  Pedir Pizza Mitad & Mitad
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#B71C1C] text-white">
                  Misma Salsa Base
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Combina 2 recetas de nuestra carta horneadas sobre la misma salsa base
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Selector */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* 1. Size Selection */}
          <div>
            <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block mb-2 font-mono">
              1. Selecciona el Tamaño
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectSize('individual')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  size === 'individual'
                    ? 'bg-[#181818] border-[#B71C1C] text-white ring-1 ring-[#B71C1C] shadow-sm'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-sm text-white">Individual (20cm)</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSize('mediana')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  size === 'mediana' || size === 'L'
                    ? 'bg-[#181818] border-[#B71C1C] text-white ring-1 ring-[#B71C1C] shadow-sm'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-sm text-white">Mediana (30cm)</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSize('familiar')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  size === 'familiar' || size === 'XL'
                    ? 'bg-[#181818] border-[#B71C1C] text-white ring-1 ring-[#B71C1C] shadow-sm'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white">Familiar (40cm)</div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-bold">
                    Recomendado
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Sauce Base Selection with kitchen rule */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block font-mono">
                2. Elige la Salsa Base de la Pizza
              </label>
              <span className="text-[10.5px] font-mono text-zinc-400">
                {selectedSauce === 'blanca' ? 'Base Blanca' : 'Base Napolitana'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Salsa Napolitana */}
              <button
                type="button"
                onClick={() => handleSauceChange('napolitana')}
                className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                  selectedSauce === 'napolitana'
                    ? 'bg-[#211111] border-[#B71C1C] text-white ring-1 ring-[#B71C1C] shadow-md'
                    : 'bg-[#121214] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs sm:text-sm text-white">
                    Salsa Base Napolitana
                  </div>
                  {selectedSauce === 'napolitana' && (
                    <span className="w-4 h-4 rounded-full bg-[#B71C1C] text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              </button>

              {/* Salsa Blanca */}
              <button
                type="button"
                onClick={() => handleSauceChange('blanca')}
                className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                  selectedSauce === 'blanca'
                    ? 'bg-[#221F14] border-[#D4AF37] text-white ring-1 ring-[#D4AF37] shadow-md'
                    : 'bg-[#121214] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs sm:text-sm text-white">
                    Salsa Base Blanca
                  </div>
                  {selectedSauce === 'blanca' && (
                    <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-black flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Explanatory banner */}
            <div className="p-2.5 rounded-xl bg-[#141418] border border-white/10 flex items-center gap-2 text-[11px] text-zinc-300">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>
                <strong>Regla de Horneado:</strong> Ambas mitades deben compartir la misma salsa base para lograr una cocción homogénea y el balance perfecto en piedra.
              </span>
            </div>
          </div>

          {/* 3. Visual Split Cards: Mitad 1 & Mitad 2 */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block font-mono">
              3. Elige tus 2 Mitades ({selectedSauce === 'blanca' ? 'Base Blanca' : 'Base Napolitana'})
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* First Half */}
              <div className="p-3.5 rounded-xl bg-[#141416] border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Primera Mitad (50%)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {formatUSD(priceHalf1)}
                  </span>
                </div>

                <select
                  value={half1Id}
                  onChange={(e) => setHalf1Id(e.target.value)}
                  className="w-full p-2.5 bg-[#1C1C20] border border-white/15 rounded-xl text-xs sm:text-sm font-bold text-white outline-none focus:border-[#D4AF37]"
                >
                  {activePool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatUSD(getPizzaPrice(p, size))}
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-zinc-400 bg-[#0F0F11] p-2 rounded-lg border border-white/5 line-clamp-2">
                  {half1?.description}
                </p>
              </div>

              {/* Second Half */}
              <div className="p-3.5 rounded-xl bg-[#141416] border border-white/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Segunda Mitad (50%)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {formatUSD(priceHalf2)}
                  </span>
                </div>

                <select
                  value={half2Id}
                  onChange={(e) => setHalf2Id(e.target.value)}
                  className="w-full p-2.5 bg-[#1C1C20] border border-white/15 rounded-xl text-xs sm:text-sm font-bold text-white outline-none focus:border-[#D4AF37]"
                >
                  {activePool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatUSD(getPizzaPrice(p, size))}
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-zinc-400 bg-[#0F0F11] p-2 rounded-lg border border-white/5 line-clamp-2">
                  {half2?.description}
                </p>
              </div>
            </div>

            {/* Pricing transparency note */}
            <div className="p-2.5 rounded-xl bg-[#121214] border border-white/10 flex items-center gap-2 text-[11px] text-zinc-400">
              <Info className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>
                Precio base: <strong className="text-white">{formatUSD(basePrice)}</strong> (se calcula con la mitad de mayor valor).
              </span>
            </div>
          </div>

          {/* 4. Extra Toppings */}
          {activeExtrasList.length > 0 && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> 4. Toppings & Extras Adicionales (Opcional)
              </label>

              {/* Extras Grammage Advice Banner */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#1B1B20] to-[#121216] border border-[#D4AF37]/35 flex items-start gap-2.5 text-xs text-zinc-300 shadow-sm">
                <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="leading-snug text-zinc-200">
                    <strong className="text-[#D4AF37]">Recomendación:</strong> Nuestras porciones de ingredientes extra están pensadas para pizzas Medianas (30cm). Para una pizza Familiar (40cm), te recomendamos ordenar doble porción para cubrirla perfectamente.
                  </p>
                  {(size === 'familiar' || size === 'XL') && (
                    <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 mt-1">
                      <span>✨</span> Pizza Familiar (40cm): Toca el botón <strong>(+)</strong> para pedir doble porción (2x).
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeExtrasList.map((extra) => {
                  const qty = selectedExtrasQty[extra.id] || 0;
                  const isSelected = qty > 0;
                  return (
                    <div
                      key={extra.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isSelected
                          ? 'bg-[#1C1C20] border-[#D4AF37] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                          : 'bg-[#121212] border-white/10 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                            {extra.name}
                          </span>
                          {qty >= 2 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#D4AF37]/20 text-[#D4AF37] uppercase">
                              {qty === 2 ? 'Doble' : `x${qty}`}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#D4AF37] block mt-0.5">
                          +{formatUSD(extra.price * Math.max(1, qty))}
                          {qty > 1 && (
                            <span className="text-[10px] text-zinc-400 font-normal ml-1">
                              ({formatUSD(extra.price)} c/u)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Add Button or Quantity Counter */}
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateExtraQty(extra.id, 1)}
                          className="px-2.5 py-1 rounded-lg bg-[#18181A] hover:bg-[#252528] border border-white/15 text-zinc-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3 text-[#D4AF37]" />
                          <span>Agregar</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 bg-[#0D0D0F] p-1 rounded-lg border border-[#D4AF37]/40">
                          <button
                            type="button"
                            onClick={() => handleUpdateExtraQty(extra.id, -1)}
                            className="p-1 rounded text-zinc-400 hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-4 text-center font-mono font-bold text-xs text-white">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateExtraQty(extra.id, 1)}
                            className="p-1 rounded text-zinc-400 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Crust Dipping Sauce (Complimentary on Mediana/Familiar, Extra on Individual) */}
          <div className={`p-3.5 rounded-2xl bg-gradient-to-br from-[#18181A] to-[#101012] border-2 space-y-2.5 ${
            isIndividual ? 'border-amber-600/40' : 'border-[#D4AF37]/40'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#D4AF37]" /> 5. Salsa Acompañante de Bordes
              </label>
              {isIndividual ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-950/80 text-amber-300 border border-amber-700/60 w-fit">
                  Extra +$1.00 • No incluida en Individual
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700 w-fit">
                  ¡100% Gratis • 1 por pizza!
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-300 leading-snug">
              {isIndividual
                ? 'Para el tamaño Individual (20cm) las salsas de bordes no son gratuitas. Puedes añadir tu salsa artesanal favorita como extra:'
                : 'Sumerge y disfruta cada corteza crujiente con tu tina de salsa artesanal favorita sin costo adicional:'}
            </p>

            <div className="space-y-2 pt-1">
              {COMPLIMENTARY_CRUST_SAUCES.map((sauce) => {
                const isSelected = selectedCrustSauce === sauce.name;
                return (
                  <button
                    key={sauce.id}
                    type="button"
                    onClick={() => setSelectedCrustSauce(sauce.name)}
                    className={`w-full p-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-all ${
                      isSelected
                        ? isIndividual
                          ? 'bg-[#241F16] border-amber-500 text-white shadow-md ring-1 ring-amber-500'
                          : 'bg-[#221F16] border-[#D4AF37] text-white shadow-md ring-1 ring-[#D4AF37]'
                        : 'bg-[#141416] border-white/10 text-zinc-300 hover:border-white/20 hover:bg-[#1A1A1E]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? isIndividual ? 'border-amber-400 bg-amber-400 text-black' : 'border-[#D4AF37] bg-[#D4AF37] text-black' 
                          : 'border-zinc-500 bg-transparent'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white leading-tight">
                          {sauce.name}
                        </div>
                        <div className="text-[10.5px] text-zinc-400 mt-0.5 leading-relaxed">
                          {sauce.description}
                        </div>
                      </div>
                    </div>

                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                      isIndividual
                        ? 'text-amber-300 bg-amber-950/60 border-amber-800/60'
                        : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                    }`}>
                      {isIndividual ? `+$${CRUST_SAUCE_EXTRA_PRICE.toFixed(2)} Extra` : '$0.00 Gratis'}
                    </span>
                  </button>
                );
              })}

              {/* Option to opt out */}
              <button
                type="button"
                onClick={() => setSelectedCrustSauce('sin_salsa')}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                  selectedCrustSauce === 'sin_salsa'
                    ? 'bg-[#1C1C1E] border-white/40 text-white'
                    : 'bg-[#101012] border-white/5 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    selectedCrustSauce === 'sin_salsa' ? 'border-white bg-white text-black' : 'border-zinc-600'
                  }`}>
                    {selectedCrustSauce === 'sin_salsa' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="text-[11px]">
                    {isIndividual ? 'Sin salsa adicional (Sin costo extra)' : 'No deseo salsa para los bordes'}
                  </span>
                </div>
                {isIndividual && (
                  <span className="font-mono text-[10px] text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                    $0.00
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-[#0A0A0A] border-t border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-[#141414] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-mono font-bold text-sm text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right flex-1">
            <div className="font-mono font-bold text-lg text-white leading-none">
              {formatUSD(totalPriceUSD)}
            </div>
            <div className="font-mono text-xs text-[#D4AF37] font-semibold mt-0.5">
              {formatBs(totalPriceUSD, exchangeRate)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="py-3 px-5 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
          >
            Ordenar Mitad & Mitad
          </button>
        </div>
      </div>
    </div>
  );
};
