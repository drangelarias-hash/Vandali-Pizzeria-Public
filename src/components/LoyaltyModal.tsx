import React from 'react';
import { X, Award, CheckCircle, Sparkles, Gift, Flame, ShieldCheck, Ticket } from 'lucide-react';
import { UserProfile } from '../types';

interface LoyaltyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
}

export const LoyaltyCardModal: React.FC<LoyaltyCardModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenAuth,
}) => {
  if (!isOpen) return null;

  const tickets = user?.loyaltyTickets || 0;
  const isUnlocked = tickets >= 10 || user?.hasUnlockedDiscount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0F0F0F] border-2 border-[#D4AF37]/40 shadow-2xl overflow-hidden text-zinc-200">
        {/* Top Gold Geometric Header */}
        <div className="p-5 bg-gradient-to-br from-[#1A1A1A] via-[#111111] to-[#0A0A0A] border-b border-[#D4AF37]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D4AF37] text-black font-black flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif italic font-bold text-lg text-[#D4AF37]">
                  Vandali Club
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#B71C1C] text-white text-[9px] uppercase font-bold tracking-wider">
                  Fidelidad VIP
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Tarjeta virtual de sellos y recompensas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5">
          {/* Virtual Loyalty Card Display */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#181818] via-[#121212] to-[#080808] border border-[#D4AF37]/40 shadow-inner relative overflow-hidden">
            {/* Background watermark */}
            <div className="absolute -right-6 -bottom-6 text-white/5 font-serif font-black text-8xl select-none pointer-events-none">
              V
            </div>

            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] block">
                  TARJETA DE SELLOS DIGITAL
                </span>
                <h4 className="font-bold text-sm text-white">
                  {user ? user.name : 'Cliente Invitado'}
                </h4>
                {user?.email && (
                  <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
                    {user.email}
                  </p>
                )}
                {user?.phone && (
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Tel: {user.phone}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-[9px] uppercase text-zinc-400 block font-mono">
                  PROGRESO
                </span>
                <span className="text-base font-bold font-mono text-[#D4AF37]">
                  {tickets} / 10
                </span>
              </div>
            </div>

            {/* 10 Ticket Slots Grid */}
            <div className="grid grid-cols-5 gap-2 my-4">
              {Array.from({ length: 10 }).map((_, index) => {
                const isStamped = index < tickets;
                const isTenth = index === 9;

                return (
                  <div
                    key={index}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 border transition-all ${
                      isStamped
                        ? 'bg-[#B71C1C] border-[#D4AF37] text-white shadow-sm'
                        : isTenth
                        ? 'bg-[#1C1C1C] border-dashed border-[#D4AF37] text-[#D4AF37]'
                        : 'bg-[#141414] border-white/10 text-zinc-600'
                    }`}
                  >
                    {isStamped ? (
                      <div className="flex flex-col items-center">
                        <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span className="text-[8px] font-mono font-bold text-amber-200">
                          #{index + 1}
                        </span>
                      </div>
                    ) : isTenth ? (
                      <div className="flex flex-col items-center text-center">
                        <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span className="text-[7px] font-bold text-[#D4AF37] uppercase">
                          -30%
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono font-medium">
                        {index + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reward Banner */}
            <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-[#D4AF37]/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[11px] text-zinc-300 font-medium">
                  {isUnlocked
                    ? '¡30% de descuento desbloqueado!'
                    : `Te faltan ${10 - tickets} ${10 - tickets === 1 ? 'sello' : 'sellos'} para tu 30% OFF`}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#D4AF37] font-mono">
                {Math.round((tickets / 10) * 100)}%
              </span>
            </div>
          </div>

          {/* Rules and Explanation */}
          <div className="space-y-2 text-xs text-zinc-300 bg-[#141414] p-3.5 rounded-xl border border-white/5">
            <h5 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5 text-[#D4AF37]">
              <Ticket className="w-3.5 h-3.5" /> ¿Cómo funciona el Club Vandali?
            </h5>
            <ul className="space-y-1.5 text-[11px] text-zinc-400 list-disc list-inside">
              <li>
                Cada compra <strong className="text-white">mayor a $20.00</strong> te suma <strong className="text-[#D4AF37]">1 ticket/sello</strong> a tu tarjeta.
              </li>
              <li>
                Al completar los <strong className="text-white">10 tickets</strong>, obtienes automáticamente un <strong className="text-emerald-400">30% de Descuento</strong> en tu siguiente comanda.
              </li>
              <li>
                Tus sellos se guardan de forma segura vinculados a tu número de WhatsApp.
              </li>
            </ul>
          </div>

          {/* User Auth state prompt */}
          {!user ? (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <span>Registrarme o Iniciar Sesión para Acumular Sellos</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 text-white font-bold text-xs"
            >
              Entendido / Continuar al Menú
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
