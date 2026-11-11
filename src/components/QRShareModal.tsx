import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Share2, Instagram, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

interface QRShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://vandalipizzeria.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm flex flex-col rounded-3xl bg-[#141418] border border-[#2f2f3c] shadow-2xl overflow-hidden text-zinc-200 text-center p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#202028] hover:bg-[#2c2c36] text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-3">
          <Logo size="md" variant="red" />
        </div>

        <h3 className="font-extrabold text-lg text-white mb-1">Menú Digital & Pedidos</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Escanea para ordenar desde tu móvil o comparte el link en Instagram bio
        </p>

        {/* QR Code Canvas Representation */}
        <div className="p-4 bg-white rounded-2xl mx-auto shadow-inner flex flex-col items-center justify-center mb-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
              currentUrl
            )}&color=14-14-18&bgcolor=ffffff&margin=1`}
            alt="QR Menú Vandali"
            className="w-44 h-44 object-contain rounded-lg"
          />
          <span className="text-[10px] text-zinc-700 font-bold mt-2 font-mono">
            VANDALI PIZZERÍA ARTESANAL
          </span>
        </div>

        {/* Copy Link Button */}
        <button
          onClick={handleCopy}
          className="w-full py-3 px-4 rounded-xl bg-[#1d1d26] hover:bg-[#252532] border border-[#303040] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 mb-3"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">¡Enlace Copiado al Portapapeles!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-[#D4AF37]" />
              <span>Copiar Enlace para Instagram / Mesas</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-zinc-500">
          Ideal para stickers QR en mesas del local y botón en el perfil de Instagram @vandali.pizzeria.
        </p>
      </div>
    </div>
  );
};
