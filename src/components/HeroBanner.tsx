import React from 'react';
import { Flame, Clock, MapPin, Award, Truck } from 'lucide-react';
import { AdminConfig } from '../types';

interface HeroBannerProps {
  config: AdminConfig;
  onOpenLoyalty: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  config,
  onOpenLoyalty,
}) => {
  return (
    <div className="relative overflow-hidden bg-[#0A0A0A] border-b border-white/10 pt-3 sm:pt-5 pb-5 sm:pb-6 px-3 sm:px-6">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-64 bg-[#B71C1C]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-3 sm:space-y-4">
        {/* Delivery Incentive Banner - Centered */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#B71C1C]/20 via-[#D4AF37]/15 to-[#B71C1C]/20 border border-[#D4AF37]/30 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs text-center">
          <div className="flex items-center justify-center gap-2 text-zinc-200">
            <Truck className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              <strong className="text-white">Delivery GRATIS</strong> en pedidos mayores a <strong className="text-[#D4AF37]">${config.freeDeliveryThresholdUSD?.toFixed(2) || '10.00'}</strong> (o $1.50 estándar).
            </span>
          </div>
          <button
            onClick={onOpenLoyalty}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D4AF37] text-black font-bold text-[11px] hover:bg-[#c49f27] transition-all"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Club de Sellos (Gana 30% OFF)</span>
          </button>
        </div>

        {/* Clean Artisanal Description & Schedule Bar - Centered */}
        <div className="flex flex-col items-center justify-center text-center gap-3 sm:gap-3.5 bg-[#121214] p-4 sm:p-5 rounded-2xl border border-white/5">
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-mono uppercase tracking-wider mx-auto">
            <Flame className="w-3 h-3 text-[#B71C1C] fill-[#B71C1C]" />
            <span>Vandali Pizzería Artesanal</span>
          </div>

          <p className="text-sm sm:text-base text-white font-normal leading-relaxed max-w-3xl mx-auto">
            Cada pizza es una combinación perfecta de tradición y sabor: masa de fermentación lenta con orillas doradas y crujientes, salsa artesanal de tomates seleccionados y los ingredientes más frescos. El auténtico placer horneado al momento.
          </p>

          {/* Schedule & Location Pills - Centered */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-300 pt-0.5">
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181A] border border-white/10 text-[11.5px] sm:text-xs text-zinc-200">
              <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>
                <strong className="text-white">Lun-Vie:</strong> 4PM - 11PM <span className="text-amber-400/90 font-semibold">(Martes cerrados)</span> | <strong className="text-white">Sáb-Dom:</strong> 12PM - 11PM
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181A] border border-white/10 text-[11.5px] sm:text-xs text-zinc-200">
              <MapPin className="w-3.5 h-3.5 text-[#B71C1C] shrink-0" />
              <span>Mérida, Venezuela • Delivery en toda la ciudad</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
