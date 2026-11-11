import React, { useState } from 'react';
import { MenuItem } from '../types';
import { formatUSD, formatBs } from '../utils/currency';
import { Plus, Check, CupSoda, Flame, Layers, Sparkles } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  exchangeRate: number;
  currencyMode: 'both' | 'usd' | 'bs';
  onAdd: (item: MenuItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  exchangeRate,
  currencyMode,
  onAdd,
}) => {
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    onAdd(item);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'bebidas':
        return <CupSoda className="w-4 h-4 text-[#D4AF37]" />;
      case 'salsas':
        return <Flame className="w-4 h-4 text-[#B71C1C]" />;
      case 'extras':
        return <Layers className="w-4 h-4 text-[#D4AF37]" />;
      default:
        return <Sparkles className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div
      className={`group flex flex-col justify-between p-4 rounded-2xl bg-[#0F0F0F] border transition-all duration-200 ${
        item.isAvailable
          ? 'border-white/10 hover:border-[#D4AF37]/40 hover:shadow-lg'
          : 'border-white/5 opacity-50'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="p-2 rounded-xl bg-[#181818] border border-white/5 inline-flex items-center justify-center">
            {getCategoryIcon()}
          </div>
          {item.volumeOrSize && (
            <span className="px-2 py-0.5 rounded bg-[#1A1A1A] border border-white/10 text-[9px] font-mono text-zinc-400">
              {item.volumeOrSize}
            </span>
          )}
        </div>

        <h4 className="font-bold text-sm text-white group-hover:text-[#D4AF37] transition-colors leading-snug">
          {item.name}
        </h4>
        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      </div>

      <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between gap-2">
        <div>
          {(currencyMode === 'both' || currencyMode === 'usd') && (
            <div className="text-sm font-bold font-mono text-white leading-none">
              {formatUSD(item.price)}
            </div>
          )}
          {(currencyMode === 'both' || currencyMode === 'bs') && (
            <div className="text-[10px] font-mono text-[#D4AF37] font-semibold mt-0.5">
              {formatBs(item.price, exchangeRate)}
            </div>
          )}
        </div>

        {item.isAvailable ? (
          <button
            type="button"
            onClick={handleAdd}
            className={`p-2 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
              justAdded
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-[#B71C1C] hover:bg-[#c62828] border-[#B71C1C] text-white shadow-sm'
            }`}
            title="Agregar a la comanda"
          >
            {justAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        ) : (
          <span className="text-[9px] font-bold text-zinc-500 uppercase">Agotado</span>
        )}
      </div>
    </div>
  );
};
