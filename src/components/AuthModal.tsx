import React, { useState } from 'react';
import {
  X,
  Award,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  ArrowRight,
  LogIn,
  UserPlus,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { UserProfile } from '../types';
import { saveUserProfileToFirestore, getUserProfileByEmail } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!loginPassword.trim()) {
      setError('Por favor ingresa tu contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try to find user in Firestore
      let userProfile = await getUserProfileByEmail(cleanEmail);

      // 2. If not found in Firestore, search in localStorage
      if (!userProfile) {
        const savedByEmail = localStorage.getItem(`vandali_user_${cleanEmail}`);
        if (savedByEmail) {
          try {
            userProfile = JSON.parse(savedByEmail);
          } catch {
            userProfile = null;
          }
        }
      }

      if (!userProfile) {
        setError('No encontramos ninguna cuenta con este correo. Por favor regístrate.');
        setIsLoading(false);
        return;
      }

      // Check password if set
      if (userProfile.password && userProfile.password !== loginPassword.trim()) {
        setError('Contraseña incorrecta. Por favor verifica e intenta nuevamente.');
        setIsLoading(false);
        return;
      }

      // If user profile didn't have password saved yet, update it with this password
      if (!userProfile.password) {
        userProfile.password = loginPassword.trim();
        await saveUserProfileToFirestore(userProfile);
      }

      // Save to local storage
      localStorage.setItem('vandali_user_profile', JSON.stringify(userProfile));
      localStorage.setItem(`vandali_user_${cleanEmail}`, JSON.stringify(userProfile));

      setSuccessMsg(`¡Bienvenido de vuelta, ${userProfile.name}!`);
      setTimeout(() => {
        onLoginSuccess(userProfile!);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error during login:', err);
      setError('Ocurrió un error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regName.trim()) {
      setError('Por favor ingresa tu Nombre Completo.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor ingresa un Correo Electrónico válido (Ej: tu@correo.com).');
      return;
    }

    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (!regPhone.trim() || regPhone.trim().length < 8) {
      setError('Por favor ingresa un número de WhatsApp válido (Ej: 04121234567).');
      return;
    }

    setIsLoading(true);

    try {
      // Check existing user to preserve loyalty stamps
      let existingLoyaltyTickets = 0;
      let existingUnlocked = false;
      let existingTotalSpent = 0;
      let existingOrdersCount = 0;
      let createdAt = new Date().toISOString();

      const existingProfile = await getUserProfileByEmail(cleanEmail);
      if (existingProfile) {
        existingLoyaltyTickets = existingProfile.loyaltyTickets || 0;
        existingUnlocked = existingProfile.hasUnlockedDiscount || false;
        existingTotalSpent = existingProfile.totalSpentUSD || 0;
        existingOrdersCount = existingProfile.completedOrdersCount || 0;
        createdAt = existingProfile.createdAt || createdAt;
      } else {
        const savedByEmail = localStorage.getItem(`vandali_user_${cleanEmail}`);
        if (savedByEmail) {
          try {
            const parsed = JSON.parse(savedByEmail);
            existingLoyaltyTickets = parsed.loyaltyTickets || 0;
            existingUnlocked = parsed.hasUnlockedDiscount || false;
            existingTotalSpent = parsed.totalSpentUSD || 0;
            existingOrdersCount = parsed.completedOrdersCount || 0;
            createdAt = parsed.createdAt || createdAt;
          } catch {
            // ignore
          }
        }
      }

      const newProfile: UserProfile = {
        id: existingProfile?.id || `usr-${Date.now()}`,
        name: regName.trim(),
        email: cleanEmail,
        password: regPassword.trim(),
        phone: regPhone.trim(),
        address: regAddress.trim() || undefined,
        loyaltyTickets: existingLoyaltyTickets,
        hasUnlockedDiscount: existingUnlocked,
        totalSpentUSD: existingTotalSpent,
        completedOrdersCount: existingOrdersCount,
        createdAt,
      };

      // Save to Firestore and local storage
      await saveUserProfileToFirestore(newProfile);
      localStorage.setItem('vandali_user_profile', JSON.stringify(newProfile));
      localStorage.setItem(`vandali_user_${cleanEmail}`, JSON.stringify(newProfile));

      setSuccessMsg('¡Cuenta creada y tarjeta de fidelidad activada con éxito!');
      setTimeout(() => {
        onLoginSuccess(newProfile);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error during registration:', err);
      setError('Ocurrió un error al registrar la cuenta. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0C0C0E] border-2 border-[#D4AF37]/30 shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1A1A1A] via-[#121212] to-[#0A0A0A] border-b border-[#D4AF37]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B71C1C] flex items-center justify-center text-white shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif italic font-bold text-lg text-white">
                {currentUser ? 'Mi Cuenta Vandali' : authMode === 'login' ? 'Iniciar Sesión' : 'Registro de Cliente'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {currentUser
                  ? 'Gestiona tus datos y tarjeta de fidelidad'
                  : authMode === 'login'
                  ? 'Ingresa con tu correo y clave'
                  : 'Crea tu cuenta para acumular sellos de fidelidad'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loyalty Benefit Highlight Banner */}
        <div className="bg-gradient-to-r from-[#B71C1C]/20 via-[#D4AF37]/10 to-[#B71C1C]/20 border-b border-[#D4AF37]/20 p-2.5 px-4 sm:px-5 flex items-center gap-2.5">
          <Award className="w-5 h-5 text-[#D4AF37] shrink-0" />
          <div className="text-[11px] text-zinc-300">
            <strong className="text-[#D4AF37]">Vandali Club:</strong> Órdenes &gt; $20 suman 1 sello. ¡Al acumular 10 sellos obtienes <span className="text-white font-bold underline decoration-[#D4AF37]">30% de descuento</span>!
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {currentUser ? (
            /* Logged in state */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Nombre:</span>
                  <span className="font-bold text-white">{currentUser.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Correo:</span>
                  <span className="font-mono text-zinc-200">{currentUser.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">WhatsApp:</span>
                  <span className="font-mono text-white">{currentUser.phone}</span>
                </div>
                {currentUser.address && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Dirección:</span>
                    <span className="text-zinc-300 text-right">{currentUser.address}</span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-white/10 flex justify-between items-center text-xs">
                  <span className="text-[#D4AF37] font-bold">Sellos de Fidelidad:</span>
                  <span className="font-mono font-bold text-base text-[#D4AF37]">
                    {currentUser.loyaltyTickets} / 10
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-transparent border border-rose-800/80 text-rose-400 hover:bg-rose-950/30 text-xs font-bold transition-all"
                >
                  Cerrar Sesión
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#c49f27] transition-all"
                >
                  Ir al Menú
                </button>
              </div>
            </div>
          ) : (
            /* Auth Forms */
            <div>
              {/* Mode Toggle Pills */}
              <div className="flex p-1 bg-[#141418] rounded-xl border border-white/10 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    authMode === 'login'
                      ? 'bg-[#B71C1C] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    authMode === 'register'
                      ? 'bg-[#B71C1C] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Cuenta</span>
                </button>
              </div>

              {/* 1. LOGIN FORM */}
              {authMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Clave / Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <span>{isLoading ? 'Iniciando sesión...' : 'Ingresar a mi Cuenta'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setError(null);
                        }}
                        className="text-xs text-[#D4AF37] hover:underline"
                      >
                        ¿No tienes una cuenta aún? <strong>Regístrate aquí</strong>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-1.5 text-zinc-400 hover:text-white text-xs font-medium text-center"
                    >
                      Continuar como Invitado
                    </button>
                  </div>
                </form>
              ) : (
                /* 2. REGISTER FORM */
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Nombre Completo <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ej: Sofía Rivas"
                        className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Correo Electrónico <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="sofia.rivas@gmail.com"
                        className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Clave / Contraseña <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Crea una contraseña segura"
                        className="w-full pl-9 pr-10 py-2 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Número de WhatsApp <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="04121234567"
                        className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                      Dirección en Mérida <span className="text-zinc-500 font-normal">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="Ej: Av. Las Américas, Res. Los Sauces"
                        className="w-full pl-9 pr-3 py-2 bg-[#141418] border border-white/15 rounded-xl text-xs text-white outline-none focus:border-[#D4AF37] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-[#B71C1C] hover:bg-[#c62828] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <span>{isLoading ? 'Registrando...' : 'Crear Mi Cuenta & Activar Sellos'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setError(null);
                        }}
                        className="text-xs text-[#D4AF37] hover:underline"
                      >
                        ¿Ya tienes una cuenta creada? <strong>Inicia sesión aquí</strong>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-1 text-zinc-400 hover:text-white text-xs font-medium text-center"
                    >
                      Continuar como Invitado
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
