import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, CupSoda, Sparkles, MessageSquare, Utensils, Droplets, CheckCircle2, Info } from 'lucide-react';
import { PizzaItem, PizzaSize, CartExtra, CartItem, MenuItem, COMPLIMENTARY_CRUST_SAUCES, CRUST_SAUCE_EXTRA_PRICE, getPizzaPrice, getPizzaSizeLabel } from '../types';
import { formatUSD, formatBs } from '../utils/currency';

interface ItemModalProps {
  pizza: PizzaItem | null;
  initialSize?: PizzaSize;
  drinks: MenuItem[];
  extras?: MenuItem[];
  exchangeRate: number;
  currencyMode: 'both' | 'usd' | 'bs';
  onClose: () => void;
  onAddToCart: (pizzaItem: CartItem, accompanyingDrinks?: CartItem[]) => void;
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
  if (!s) return 'mediana';
  const lower = String(s).toLowerCase();
  if (lower === 'familiar' || lower === 'xl') return 'familiar';
  if (lower === 'individual' || lower === 'ind') return 'individual';
  return 'mediana';
};

export const ItemModal: React.FC<ItemModalProps> = ({
  pizza,
  initialSize = 'mediana',
  drinks,
  extras,
  exchangeRate,
  currencyMode,
  onClose,
  onAddToCart,
}) => {
  const [size, setSize] = useState<PizzaSize>(() => normalizePizzaSize(initialSize));
  const [quantity, setQuantity] = useState(1);
  const [selectedCrustSauce, setSelectedCrustSauce] = useState<string>(() =>
    normalizePizzaSize(initialSize) === 'individual' ? 'sin_salsa' : COMPLIMENTARY_CRUST_SAUCES[0].name
  );
  const [selectedExtrasQty, setSelectedExtrasQty] = useState<{ [extraId: string]: number }>({});
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [selectedDrinks, setSelectedDrinks] = useState<{ [drinkId: string]: number }>({});

  // Synchronize size and state when opening or when pizza/initialSize prop changes
  useEffect(() => {
    if (pizza) {
      const activeSize = normalizePizzaSize(initialSize);
      setSize(activeSize);
      setQuantity(1);
      setSelectedExtrasQty({});
      setRemovedIngredients([]);
      setSelectedDrinks({});
      if (activeSize === 'individual') {
        setSelectedCrustSauce('sin_salsa');
      } else {
        setSelectedCrustSauce(COMPLIMENTARY_CRUST_SAUCES[0].name);
      }
    }
  }, [pizza?.id, initialSize]);

  const isIndividual = size === 'individual';
  const hasSauceExtra = isIndividual && selectedCrustSauce && selectedCrustSauce !== 'sin_salsa';
  const sauceExtraPrice = hasSauceExtra ? CRUST_SAUCE_EXTRA_PRICE : 0;

  // Use dynamic extras configured in Admin, or fallback to default
  const activeExtrasList: CartExtra[] = (extras && extras.length > 0)
    ? extras
        .filter((e) => e.isAvailable !== false)
        .map((e) => ({ id: e.id, name: e.name, price: Number(e.price) || 0 }))
    : DEFAULT_EXTRAS;

  const activeDrinksList = (drinks || []).filter((d) => d.isAvailable !== false);

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

  const basePrice = pizza ? getPizzaPrice(pizza, size) : 0;
  const extrasTotal = selectedExtras.reduce((acc, curr) => acc + curr.price, 0) + sauceExtraPrice;
  const pizzaUnitPrice = basePrice + extrasTotal;
  const pizzaTotalUSD = pizzaUnitPrice * quantity;

  // Accompanying drinks calculation
  const drinksTotalUSD = Object.entries(selectedDrinks).reduce((sum, [drinkId, qty]) => {
    const qtyNum = Number(qty);
    if (qtyNum <= 0) return sum;
    const drink = drinks.find((d) => d.id === drinkId);
    return sum + (drink ? drink.price * qtyNum : 0);
  }, 0);

  const grandTotalUSD = pizzaTotalUSD + drinksTotalUSD;

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

  const toggleRemoveIngredient = (ing: string) => {
    if (removedIngredients.includes(ing)) {
      setRemovedIngredients(removedIngredients.filter((i) => i !== ing));
    } else {
      setRemovedIngredients([...removedIngredients, ing]);
    }
  };

  const handleUpdateDrinkQty = (drinkId: string, delta: number) => {
    setSelectedDrinks((prev) => {
      const current = prev[drinkId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[drinkId];
        return copy;
      }
      return { ...prev, [drinkId]: next };
    });
  };

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

  const handleConfirmOrder = () => {
    const finalExtras: CartExtra[] = [...selectedExtras];
    if (hasSauceExtra) {
      finalExtras.push({
        id: `extra-sauce-${selectedCrustSauce.toLowerCase().replace(/\s+/g, '-')}`,
        name: `Salsa Bordes: ${selectedCrustSauce}`,
        price: CRUST_SAUCE_EXTRA_PRICE,
      });
    }

    const pizzaItem: CartItem = {
      cartId: `${pizza.id}-${size}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type: 'pizza',
      id: pizza.id,
      name: pizza.name,
      size,
      unitPrice: basePrice,
      quantity,
      extras: finalExtras,
      crustSauce: selectedCrustSauce && selectedCrustSauce !== 'sin_salsa' ? selectedCrustSauce : undefined,
      removedIngredients,
    };

    // Convert accompanying drinks to cart items
    const drinkItems: CartItem[] = Object.entries(selectedDrinks)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([drinkId, qty]) => {
        const drink = drinks.find((d) => d.id === drinkId);
        const qtyNum = Number(qty);
        return {
          cartId: `${drinkId}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          type: 'item' as const,
          id: drinkId,
          name: drink?.name || 'Bebida',
          unitPrice: drink?.price || 1.5,
          quantity: qtyNum,
          extras: [],
        };
      });

    onAddToCart(pizzaItem, drinkItems);
    onClose();
  };

  if (!pizza || pizza.isAvailable === false) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[#0F0F0F] border-2 border-[#D4AF37]/30 shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-br from-[#1A1A1A] via-[#121212] to-[#0A0A0A] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B71C1C] flex items-center justify-center text-white font-bold shadow-md">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest font-mono">
                  {pizza.tagline || 'Pizzería Artesanal'}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${
                    pizza.sauce === 'blanca'
                      ? 'bg-amber-950 text-amber-200'
                      : 'bg-red-950 text-red-200'
                  }`}
                >
                  {pizza.sauce === 'blanca' ? 'Base Blanca' : 'Base Napolitana'}
                </span>
              </div>
              <h3
                className="text-2xl font-bold text-white font-serif"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {pizza.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Pizza Description */}
          <p className="text-xs text-zinc-300 leading-relaxed bg-[#141414] p-3.5 rounded-xl border border-white/5">
            {pizza.description}
          </p>

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
                    ? 'bg-[#181818] border-[#B71C1C] text-white shadow-sm ring-1 ring-[#B71C1C]'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white">Individual (20cm)</span>
                  <span className="font-mono text-xs font-bold text-[#D4AF37]">
                    {formatUSD(pizza.priceIndividual ?? pizza.priceL)}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  {formatBs(pizza.priceIndividual ?? pizza.priceL, exchangeRate)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSize('mediana')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  size === 'mediana' || size === 'L'
                    ? 'bg-[#181818] border-[#B71C1C] text-white shadow-sm ring-1 ring-[#B71C1C]'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white">Mediana (30cm)</span>
                  <span className="font-mono text-xs font-bold text-[#D4AF37]">
                    {formatUSD(pizza.priceL)}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  {formatBs(pizza.priceL, exchangeRate)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSize('familiar')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  size === 'familiar' || size === 'XL'
                    ? 'bg-[#181818] border-[#B71C1C] text-white shadow-sm ring-1 ring-[#B71C1C]'
                    : 'bg-[#121212] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-white">Familiar (40cm)</span>
                  <span className="font-mono text-xs font-bold text-[#D4AF37]">
                    {formatUSD(pizza.priceXL)}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  {formatBs(pizza.priceXL, exchangeRate)}
                </div>
              </button>
            </div>
          </div>

          {/* 2. Remove Ingredients */}
          <div>
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1">
              2. ¿Deseas quitar algún ingrediente?
            </label>
            <p className="text-[11px] text-zinc-400 mb-2">
              Toca los ingredientes que NO deseas incluir en tu pizza:
            </p>
            <div className="flex flex-wrap gap-2">
              {pizza.ingredients.map((ing, idx) => {
                const isRemoved = removedIngredients.includes(ing);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleRemoveIngredient(ing)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isRemoved
                        ? 'bg-rose-950/80 border-rose-700 text-rose-300 line-through'
                        : 'bg-[#141414] border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {isRemoved ? `Sin ${ing}` : ing}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Crust Dipping Sauce (Complimentary on Mediana/Familiar, Extra on Individual) */}
          <div className={`p-3.5 rounded-2xl bg-gradient-to-br from-[#18181A] to-[#101012] border-2 space-y-2.5 ${
            isIndividual ? 'border-amber-600/40' : 'border-[#D4AF37]/40'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#D4AF37]" /> 3. Salsa Acompañante de Bordes
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

          {/* 5. Accompanying Drinks (Bebidas para acompañar) */}
          {activeDrinksList.length > 0 && (
            <div>
              <label className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block mb-1 font-mono flex items-center gap-1.5">
                <CupSoda className="w-3.5 h-3.5 text-[#D4AF37]" /> 5. ¿Deseas agregar bebidas bien frías?
              </label>
              <p className="text-[11px] text-zinc-400 mb-2.5">
                Agrega refrescos, cervezas o té frío a tu comanda:
              </p>

              <div className="space-y-2">
                {activeDrinksList.map((drink) => {
                  const qty = selectedDrinks[drink.id] || 0;
                  return (
                    <div
                      key={drink.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        qty > 0
                          ? 'bg-[#18181C] border-[#D4AF37]/50 text-white'
                          : 'bg-[#121212] border-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-bold text-xs text-white leading-tight">
                          {drink.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          {drink.volumeOrSize && <span>{drink.volumeOrSize}</span>}
                          <span className="font-mono font-bold text-[#D4AF37]">
                            {formatUSD(drink.price)}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            ({formatBs(drink.price, exchangeRate)})
                          </span>
                        </div>
                      </div>

                      {/* Drink Quantity Selector */}
                      <div className="flex items-center gap-1.5 bg-[#101010] p-1 rounded-lg border border-white/10">
                        <button
                          type="button"
                          onClick={() => handleUpdateDrinkQty(drink.id, -1)}
                          disabled={qty === 0}
                          className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-xs text-white">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateDrinkQty(drink.id, 1)}
                          className="p-1 rounded text-zinc-400 hover:text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Summary & Add */}
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
              {formatUSD(grandTotalUSD)}
            </div>
            <div className="font-mono text-xs text-[#D4AF37] font-semibold mt-0.5">
              {formatBs(grandTotalUSD, exchangeRate)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmOrder}
            className="py-3 px-6 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
          >
            Ordenar
          </button>
        </div>
      </div>
    </div>
  );
};
