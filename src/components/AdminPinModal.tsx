import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  verifyAdminPin,
  getAdminSecurityState,
  AuthSecurityState,
  generateAdminResetCode,
  verifyResetCodeAndSetNewPin,
  ADMIN_RECOVERY_EMAIL,
} from '../utils/security';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityState, setSecurityState] = useState<AuthSecurityState>(getAdminSecurityState());

  // --- RECOVERY STATE ---
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [enteredCode, setEnteredCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [generatedData, setGeneratedData] = useState<{
    code: string;
    email: string;
    expiresInMinutes: number;
    mailtoUrl: string;
    gmailComposeUrl: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Countdown timer for lockout
  useEffect(() => {
    if (!securityState.isLocked) return;

    const interval = setInterval(() => {
      const current = getAdminSecurityState();
      setSecurityState(current);
      if (!current.isLocked) {
        setError(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [securityState.isLocked]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (securityState.isLocked) return;

    if (!pin.trim()) {
      setError('Por favor ingresa el PIN de seguridad.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyAdminPin(pin);
      if (result.success) {
        setPin('');
        setError(null);
        onSuccess();
      } else {
        setError(result.error || 'PIN incorrecto');
        setSecurityState(getAdminSecurityState());
      }
    } catch {
      setError('Error al procesar verificación de seguridad');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (securityState.isLocked) return;
    if (val === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === 'CLEAR') {
      setPin('');
    } else {
      if (pin.length < 12) {
        setPin((prev) => prev + val);
      }
    }
  };

  // Trigger Recovery Code generation
  const handleRequestRecoveryCode = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateAdminResetCode();
      setGeneratedData(res);
      setRecoveryStep('verify');
      setSuccessMsg(`Código de verificación generado y preparado para ${ADMIN_RECOVERY_EMAIL}`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err?.message || 'Error al generar código de recuperación');
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit Verification Code + New PIN
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!enteredCode.trim() || enteredCode.trim().length !== 6) {
      setError('Por favor ingresa el código de 6 dígitos.');
      return;
    }

    if (!newPin.trim() || newPin.trim().length < 4) {
      setError('El nuevo PIN debe tener al menos 4 dígitos.');
      return;
    }

    if (newPin !== confirmNewPin) {
      setError('Las confirmaciones del nuevo PIN no coinciden.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyResetCodeAndSetNewPin(enteredCode, newPin);
      if (res.success) {
        setSuccessMsg('¡PIN restablecido con éxito! Accediendo al panel administrativo...');
        setSecurityState(getAdminSecurityState());
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setError(res.error || 'Código incorrecto o expirado.');
      }
    } catch {
      setError('Error al procesar el restablecimiento de PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedData?.code) {
      navigator.clipboard.writeText(generatedData.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0F0F11] border-2 border-[#D4AF37]/50 shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1A1A1E] via-[#121216] to-[#0A0A0E] border-b border-[#D4AF37]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B71C1C] flex items-center justify-center text-white font-bold shadow-lg border border-[#B71C1C]/40">
              {mode === 'login' ? <Lock className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-white">
                {mode === 'login' ? 'Acceso Administrativo' : 'Recuperar Clave'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {mode === 'login'
                  ? 'Ingresa tu PIN de seguridad'
                  : `Respaldo: ${ADMIN_RECOVERY_EMAIL}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#1A1A1E] hover:bg-[#25252E] border border-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Banner */}
        <div className="bg-[#141418] border-b border-white/10 px-4 py-2 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" /> Cifrado SHA-256
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {securityState.isLocked ? (
              <span className="text-rose-400 font-bold">
                Bloqueado ({securityState.lockoutRemainingSeconds}s)
              </span>
            ) : (
              <span>Intentos: {securityState.attemptsLeft} / 4</span>
            )}
          </span>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs flex items-start gap-2 shadow-sm animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-2 shadow-sm animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{successMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* ================= LOGIN MODE ================= */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* PIN Input */}
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  disabled={securityState.isLocked}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ingresa PIN..."
                  maxLength={12}
                  autoFocus
                  className="w-full text-center tracking-widest font-mono text-xl py-3 px-10 bg-[#16161A] border-2 border-white/15 focus:border-[#D4AF37] rounded-2xl text-white outline-none disabled:opacity-50 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1.5"
                  title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Quick Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'DEL'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={securityState.isLocked}
                    onClick={() => handleKeypadPress(k)}
                    className={`py-2.5 rounded-xl font-mono font-bold text-sm transition-all active:scale-95 disabled:opacity-40 ${
                      k === 'CLEAR' || k === 'DEL'
                        ? 'bg-[#18181C] text-zinc-400 hover:text-white border border-white/5 text-xs'
                        : 'bg-[#1C1C22] hover:bg-[#25252E] border border-white/10 text-white shadow-sm'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isVerifying || securityState.isLocked || !pin}
                  className="w-full py-3 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  {isVerifying ? (
                    <span>Verificando...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Desbloquear Panel</span>
                    </>
                  )}
                </button>

                {/* Password Recovery Link */}
                <button
                  type="button"
                  onClick={() => {
                    setMode('recovery');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    securityState.isLocked
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 animate-pulse'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>¿Olvidaste tu clave? Recuperar con Correo</span>
                </button>
              </div>
            </form>
          ) : (
            /* ================= RECOVERY MODE ================= */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-2xl bg-[#141418] border border-white/10 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-200 font-bold">
                  <Mail className="w-4 h-4 text-[#D4AF37]" />
                  <span>Correo de Respaldo Oficial</span>
                </div>
                <div className="font-mono text-[11px] text-[#D4AF37] bg-[#0A0A0C] px-2.5 py-1.5 rounded-lg border border-white/5 break-all">
                  {ADMIN_RECOVERY_EMAIL}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Si el sistema se bloqueó o no recuerdas tu PIN, enviaremos un código de seguridad
                  de 6 dígitos a este correo para restablecerlo inmediatamente.
                </p>
              </div>

              {recoveryStep === 'request' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleRequestRecoveryCode}
                    disabled={isGenerating}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#D4AF37] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>Generar y Enviar Código</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="w-full py-2 text-zinc-400 hover:text-white text-xs font-medium text-center"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                /* STEP 2: VERIFY CODE & SET NEW PIN */
                <form onSubmit={handleCompleteReset} className="space-y-3.5">
                  {generatedData && (
                    <div className="p-3 rounded-xl bg-[#18181E] border border-[#D4AF37]/40 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">Código de Respaldo Generado:</span>
                        <span className="text-[10px] text-emerald-400 font-bold">Válido 10 min</span>
                      </div>

                      <div className="flex items-center justify-between bg-[#0E0E12] p-2 rounded-lg border border-white/10">
                        <span className="font-mono text-lg font-black tracking-widest text-[#D4AF37]">
                          {generatedData.code}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-zinc-200 flex items-center gap-1 transition-colors"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick Mail Links */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={generatedData.gmailComposeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-center text-[10.5px] text-zinc-300 hover:text-white flex items-center justify-center gap-1 border border-white/5"
                        >
                          <ExternalLink className="w-3 h-3 text-[#D4AF37]" />
                          <span>Abrir Gmail</span>
                        </a>
                        <a
                          href={generatedData.mailtoUrl}
                          className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-center text-[10.5px] text-zinc-300 hover:text-white flex items-center justify-center gap-1 border border-white/5"
                        >
                          <Mail className="w-3 h-3 text-[#D4AF37]" />
                          <span>Abrir Mailto</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Verification Code Input */}
                  <div>
                    <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                      Código de 6 dígitos recibido:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredCode}
                      onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-widest font-mono text-lg py-2 px-3 bg-[#16161A] border border-white/15 focus:border-[#D4AF37] rounded-xl text-white outline-none"
                    />
                  </div>

                  {/* New PIN Inputs */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-zinc-400 font-medium block mb-0.5">
                      Nuevo PIN de Administrador (4 a 12 dígitos):
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPin ? 'text' : 'password'}
                        maxLength={12}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="Ej: 2468"
                        className="w-full py-2 px-3 bg-[#16161A] border border-white/15 focus:border-[#D4AF37] rounded-xl text-sm font-mono text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                      >
                        {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <input
                      type={showNewPin ? 'text' : 'password'}
                      maxLength={12}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      placeholder="Confirmar nuevo PIN..."
                      className="w-full py-2 px-3 bg-[#16161A] border border-white/15 focus:border-[#D4AF37] rounded-xl text-sm font-mono text-white outline-none"
                    />
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={isVerifying || !enteredCode || !newPin || !confirmNewPin}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                      {isVerifying ? (
                        <span>Guardando PIN...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Restablecer y Entrar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecoveryStep('request')}
                      className="w-full py-1.5 text-zinc-400 hover:text-white text-xs font-medium text-center"
                    >
                      Generar otro código
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
