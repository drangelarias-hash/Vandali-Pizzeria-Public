import React from 'react';
import { ShoppingBag, Settings, RefreshCw, Award, User, Lock } from 'lucide-react';
import { Logo } from './Logo';
import { AdminConfig, UserProfile } from '../types';
import { formatUSD, formatBs } from '../utils/currency';

interface HeaderProps {
  config: AdminConfig;
  user: UserProfile | null;
  isUpdatingRate: boolean;
  onRefreshRate: () => void;
  cartCount: number;
  cartTotalUSD: number;
  currencyMode?: 'both' | 'usd' | 'bs';
  setCurrencyMode?: (mode: 'both' | 'usd' | 'bs') => void;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
  onOpenQR?: () => void;
  onOpenLoyalty: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  user,
  isUpdatingRate,
  onRefreshRate,
  cartCount,
  cartTotalUSD,
  onOpenCart,
  onOpenAdmin,
  onOpenLoyalty,
  onOpenAuth,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-[#0A0A0C]/95 backdrop-blur-md border-b border-white/10 px-2 sm:px-4 md:px-6 py-2 transition-all overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-2 md:gap-3">
        {/* Left: Brand & Business Hours Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <a href="#" className="flex items-center group transition-transform active:scale-95">
            <Logo size="md" variant="red" />
          </a>

          {/* Status Badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141418] border border-white/10 text-xs font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                config.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={config.isOpen ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {config.isOpen ? 'Abierto hoy' : 'Cerrado'}
            </span>
            <span className="text-zinc-400 text-[11px] font-mono">
              (Lun-Vie 4PM-11PM | Sáb-Dom 12PM-11PM)
            </span>
          </div>
        </div>

        {/* Center: Real-Time Exchange Rate */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Live Rate Chip */}
          <button
            onClick={() => {
              if (config.exchangeRateMode === 'manual') {
                return;
              }
              onRefreshRate();
            }}
            title={
              config.exchangeRateMode === 'manual'
                ? `Tasa manual fijada por la administración: 1$ = Bs. ${config.exchangeRateBs.toFixed(2)} (Permanecerá manual hasta que el administrador decida cambiarla a modo automático)`
                : `Tasa BCV oficial: 1$ = Bs. ${config.exchangeRateBs.toFixed(2)} (Clic para refrescar)`
            }
            className="group flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-[#141418] hover:bg-[#1f1f26] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-xs transition-all active:scale-95"
          >
            {config.exchangeRateMode === 'manual' && (
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#D4AF37]" />
            )}
            <span className="text-[#D4AF37] font-bold text-[11px] sm:text-xs">1$ =</span>
            <span className="text-white font-mono font-bold text-[11px] sm:text-xs">
              Bs. {config.exchangeRateBs.toFixed(2)}
            </span>
            {config.exchangeRateMode !== 'manual' && (
              <RefreshCw
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-400 group-hover:text-[#D4AF37] transition-all ${
                  isUpdatingRate ? 'animate-spin text-[#D4AF37]' : ''
                }`}
              />
            )}
          </button>
        </div>

        {/* Right: Actions (Loyalty Club, Account, Admin, Cart) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Loyalty Club Button */}
          <button
            onClick={onOpenLoyalty}
            title="Tarjeta de Fidelidad Vandali Club"
            className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#141418] hover:bg-[#1e1e24] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold transition-all active:scale-95"
          >
            <Award className="w-4 h-4 text-[#D4AF37]" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {user ? `${user.loyaltyTickets}/10` : 'Club'}
            </span>
          </button>

          {/* User Account / Login Button */}
          <button
            onClick={onOpenAuth}
            title={user ? `Sesión de ${user.name}` : 'Iniciar Sesión / Registrarse'}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
              user
                ? 'bg-[#181818] border-emerald-500/40 text-emerald-400'
                : 'bg-[#141418] hover:bg-[#1e1e24] border-white/10 text-zinc-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-semibold">
              {user ? user.name.split(' ')[0] : 'Ingresar'}
            </span>
          </button>

          {/* Admin Panel Button */}
          <button
            onClick={onOpenAdmin}
            aria-label="Panel de Administración"
            title="Módulo Administrativo & POS"
            className="p-1.5 sm:p-2 rounded-xl bg-[#141418] hover:bg-[#1e1e24] border border-white/10 text-zinc-300 hover:text-[#D4AF37] transition-all active:scale-95"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            id="header-cart-button"
            className="relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs sm:text-sm shadow-[0_4px_16px_rgba(183,28,28,0.4)] transition-all active:scale-95"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline text-xs">Orden</span>
            {cartCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-[#D4AF37] text-black font-black text-[10px] sm:text-[11px] shadow-sm">
                {cartCount}
              </span>
            )}
            {cartTotalUSD > 0 && (
              <span className="font-mono text-xs hidden lg:inline ml-1 font-bold text-amber-200">
                {formatUSD(cartTotalUSD)}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
