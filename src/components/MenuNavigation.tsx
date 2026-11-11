import React from 'react';
import { Pizza, CupSoda, Layers } from 'lucide-react';
import { Category } from '../types';

interface MenuNavigationProps {
  activeCategory: Category;
  setActiveCategory: (cat: Category) => void;
  pizzaCount: number;
}

export const MenuNavigation: React.FC<MenuNavigationProps> = ({
  activeCategory,
  setActiveCategory,
  pizzaCount,
}) => {
  const categories: {
    id: Category;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'pizzas',
      label: 'Pizzas Artesanales',
      icon: <Pizza className="w-4 h-4" />,
      count: pizzaCount,
    },
    {
      id: 'bebidas',
      label: 'Bebidas',
      icon: <CupSoda className="w-4 h-4" />,
    },
    {
      id: 'extras',
      label: 'Salsas & Extras',
      icon: <Layers className="w-4 h-4" />,
    },
  ];

  return (
    <div className="sticky top-[57px] z-30 bg-[#0A0A0C]/95 backdrop-blur-md border-b border-white/10 py-2.5 px-3 sm:px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        {/* Category Tabs Centered & Clean */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-[#B71C1C] text-white shadow-[0_2px_12px_rgba(183,28,28,0.35)]'
                    : 'bg-[#141418] text-zinc-300 hover:text-white hover:bg-[#1f1f26] border border-white/10'
                }`}
              >
                <span className="flex items-center text-[#D4AF37]">{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.count !== undefined && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-black/30 text-amber-200' : 'bg-[#22222a] text-zinc-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
