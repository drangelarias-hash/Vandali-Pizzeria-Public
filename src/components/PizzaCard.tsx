import React, { useState } from 'react';
import { PizzaItem, PizzaSize, getPizzaPrice } from '../types';
import { formatUSD, formatBs } from '../utils/currency';
import { Plus, Split } from 'lucide-react';

interface PizzaCardProps {
  pizza: PizzaItem;
  exchangeRate: number;
  currencyMode: 'both' | 'usd' | 'bs';
  onOrder: (pizza: PizzaItem, size: PizzaSize) => void;
  onOrderHalf?: (pizza: PizzaItem, size: PizzaSize) => void;
}

export const PizzaCard: React.FC<PizzaCardProps> = ({
  pizza,
  exchangeRate,
  currencyMode,
  onOrder,
  onOrderHalf,
}) => {
  const [selectedSize, setSelectedSize] = useState<PizzaSize>('mediana');

  const currentPriceUSD = getPizzaPrice(pizza, selectedSize);

  const isPizzaOfTheMonth =
    pizza.id === 'miss-vandali' ||
    pizza.name.toLowerCase().includes('miss vandali') ||
    pizza.id === 'diablo-ruso' ||
    pizza.tagline?.toLowerCase().includes('mes');

  return (
    <div
      id={`pizza-${pizza.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl bg-[#0F0F0F] border transition-all duration-200 overflow-hidden ${
        pizza.isAvailable
          ? 'border-white/10 hover:border-[#D4AF37]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
          : 'border-white/5 opacity-60'
      }`}
    >
      {/* Top Sauce and Tag Badge Bar */}
      <div className="p-4 pb-2 flex items-center justify-between gap-2 border-b border-white/5 bg-[#141414]/50">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              pizza.sauce === 'blanca' ? 'bg-amber-100' : 'bg-[#B71C1C]'
            }`}
          />
          <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
            {pizza.sauce === 'blanca' ? 'Base Blanca' : 'Base Napolitana'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isPizzaOfTheMonth && (
            <span className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-600 to-[#B71C1C] text-white text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5 border border-amber-300/30">
              <span>🔥</span>
              <span>Pizza del Mes</span>
            </span>
          )}
          {pizza.isPopular && (
            <span className="px-2 py-0.5 rounded bg-[#B71C1C] text-white text-[9px] font-bold uppercase tracking-wider">
              Popular
            </span>
          )}
          {pizza.isVegetarian && (
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[9px] font-bold uppercase">
              Veggie
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className="text-xl font-bold tracking-tight text-[#D4AF37] font-serif group-hover:text-amber-300 transition-colors"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {pizza.name}
            </h3>
          </div>

          {pizza.tagline && (
            <p className="text-[11px] font-medium italic text-zinc-400 mt-0.5 mb-2">
              "{pizza.tagline}"
            </p>
          )}

          <p className="text-xs text-zinc-300 leading-relaxed mb-4">
            {pizza.description}
          </p>

          {/* Ingredient Pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {pizza.ingredients.map((ing, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-[#181818] border border-white/5 text-[10px] text-zinc-400 font-medium"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>

        {/* Size Selection and Pricing */}
        <div className="pt-3 border-t border-white/10 space-y-3">
          {/* Size Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex bg-[#181818] p-1 rounded-xl border border-white/10 w-fit">
              <button
                type="button"
                onClick={() => setSelectedSize('individual')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedSize === 'individual'
                    ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Individual (20cm)"
              >
                Ind (20cm)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSize('mediana')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedSize === 'mediana' || selectedSize === 'L'
                    ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Mediana (30cm)"
              >
                Med (30cm)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSize('familiar')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedSize === 'familiar' || selectedSize === 'XL'
                    ? 'bg-[#B71C1C] text-white shadow-sm ring-1 ring-[#D4AF37]/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Familiar (40cm)"
              >
                Fam (40cm)
              </button>
            </div>

            {/* Price display */}
            <div className="text-right">
              {(currencyMode === 'both' || currencyMode === 'usd') && (
                <div className="text-lg font-bold font-mono text-white leading-none">
                  {formatUSD(currentPriceUSD)}
                </div>
              )}
              {(currencyMode === 'both' || currencyMode === 'bs') && (
                <div className="text-[11px] font-mono text-[#D4AF37] font-semibold mt-0.5">
                  {formatBs(currentPriceUSD, exchangeRate)}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {pizza.isAvailable ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2">
                {/* Pedir Mitad Button (Not available for Pizza del Mes) */}
                {onOrderHalf && !isPizzaOfTheMonth && (
                  <button
                    type="button"
                    onClick={() => onOrderHalf(pizza, selectedSize)}
                    className="py-2.5 px-3 rounded-xl bg-[#141418] hover:bg-[#1f1f24] border border-[#D4AF37]/40 hover:border-[#D4AF37] text-[#D4AF37] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    title="Combinar esta pizza con otro sabor mitad y mitad"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Pedir mitad</span>
                  </button>
                )}

                {/* Order Pizza (Opens options modal with extras & drinks) */}
                <button
                  type="button"
                  onClick={() => onOrder(pizza, selectedSize)}
                  className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 bg-[#B71C1C] hover:bg-[#c62828] text-white"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ordenar</span>
                </button>
              </div>

              {isPizzaOfTheMonth && (
                <span className="text-[10px] text-amber-400/80 font-mono italic block text-center">
                  * Edición especial (no aplica para Mitad y Mitad)
                </span>
              )}
            </div>
          ) : (
            <div className="py-2.5 px-3 rounded-xl bg-[#1A1A1A] border border-white/5 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Agotada Temporalmente
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

