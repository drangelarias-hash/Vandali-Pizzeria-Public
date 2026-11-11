import React from 'react';
import { Flame, Sparkles, ArrowDown } from 'lucide-react';
import { PizzaItem, AdminConfig } from '../types';

interface PizzaOfTheMonthBannerProps {
  pizza: PizzaItem | null;
  config: AdminConfig;
  onOrderPizza?: (pizza: PizzaItem) => void;
}

export const PizzaOfTheMonthBanner: React.FC<PizzaOfTheMonthBannerProps> = ({
  pizza,
  config,
  onOrderPizza,
}) => {
  const potmConfig = config.pizzaOfTheMonth;
  // If explicitly disabled in config or marked as unavailable by admin, don't show
  if ((potmConfig && potmConfig.enabled === false) || (pizza && pizza.isAvailable === false)) {
    return null;
  }

  // Fallback pizza object if not yet loaded in menu
  const activePizza: PizzaItem = pizza || {
    id: 'miss-vandali',
    name: 'MISS VANDALI',
    tagline: 'Pizza del Mes • Edición Especial',
    description:
      'Salsa blanca artesanal de ricotta, jamón de pavo, lluvia de pistachos, rúgula fresca y glaseado balsámico. El equilibrio perfecto entre cremosidad, frescura y textura.',
    sauce: 'blanca',
    ingredients: ['Salsa Blanca de Ricotta', 'Mozzarella', 'Jamón de Pavo', 'Lluvia de Pistachos', 'Rúgula Fresca', 'Glaseado Balsámico'],
    priceIndividual: 8.5,
    priceL: 12.0,
    priceXL: 19.5,
    isPopular: true,
    isVegetarian: false,
    isAvailable: true,
    image: '/miss_vandali.jpg',
  };

  const monthLabel = potmConfig?.monthName || 'Noviembre';
  const badgeLabel = potmConfig?.badge || `Edición Especial • ${monthLabel}`;
  const title = potmConfig?.customTitle || activePizza.name;
  const description =
    potmConfig?.customDescription ||
    activePizza.description ||
    'Salsa blanca artesanal de ricotta, jamón de pavo, lluvia de pistachos, rúgula fresca y glaseado balsámico. El equilibrio perfecto entre cremosidad, frescura y textura.';

  const handleScrollToPizza = () => {
    const targetId = activePizza.id ? `pizza-${activePizza.id}` : 'pizza-miss-vandali';
    let el = document.getElementById(targetId);
    if (!el) {
      const allCards = document.querySelectorAll('[id^="pizza-"]');
      for (const card of allCards) {
        if (
          card.textContent?.toLowerCase().includes('miss vandali') ||
          card.textContent?.toLowerCase().includes('vandali')
        ) {
          el = card as HTMLElement;
          break;
        }
      }
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-red-500', 'scale-[1.01]', 'transition-all');
      setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-red-500', 'scale-[1.01]');
      }, 2500);
    } else if (onOrderPizza) {
      onOrderPizza(activePizza);
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#180808] via-[#120606] to-[#0A0A0A] border-b border-[#B71C1C]/40 py-4 sm:py-5 px-3 sm:px-6">
      {/* Subtle red glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-28 bg-[#B71C1C]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex flex-col items-center justify-center text-center gap-3 p-4 sm:p-5 rounded-2xl bg-[#140808]/90 border border-[#B71C1C]/40 shadow-xl backdrop-blur-sm">
          {/* Top Badges Centered */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B71C1C] text-white text-[11px] font-black uppercase tracking-wider shadow-md shadow-red-950/40">
              <Flame className="w-3.5 h-3.5 fill-amber-200 text-amber-200 animate-pulse" />
              <span>PIZZA DEL MES</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#D4AF37] text-[11px] font-mono font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{badgeLabel}</span>
            </span>
          </div>

          {/* Pizza Title in Bold Red */}
          <div className="space-y-1 max-w-xl mx-auto">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-black text-red-500 uppercase tracking-tight leading-tight font-serif drop-shadow-md"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium">
              {description}
            </p>
          </div>

          {/* Exclusivity note Centered */}
          <div className="text-[10.5px] sm:text-xs text-zinc-400 font-mono">
            * Edición exclusiva de temporada <span className="text-amber-400 font-semibold">(No aplica para Mitad y Mitad)</span>
          </div>

          {/* CTA Button Centered */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleScrollToPizza}
              className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 bg-gradient-to-r from-[#B71C1C] via-[#C62828] to-[#D32F2F] hover:from-[#C62828] hover:to-[#B71C1C] text-white border border-red-500/40"
              title="Ir a ordenar la Pizza del Mes en el Menú"
            >
              <span>Ordenar en el Menú</span>
              <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
