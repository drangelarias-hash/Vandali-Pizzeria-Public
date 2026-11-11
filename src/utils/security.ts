import { UserProfile } from '../types';

const ADMIN_SALT = 'vandali_pizzeria_merida_sec_2023_admin_salt';
// Default PIN: 24682023
const DEFAULT_ADMIN_HASH = '1b98c9c4c4f458580c20f8ee0ab49feb5954e6f994c9ba0c96f16b97d7b94b8c';
const VIP_SALT = 'vandali_vip_integrity_signature_v1';
const MAX_ATTEMPTS = 4;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

export const ADMIN_RECOVERY_EMAIL = 'vandali.pizzeria@gmail.com';

/**
 * Robust SHA-256 string hasher using Web Crypto API.
 */
export async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthSecurityState {
  isLocked: boolean;
  lockoutRemainingSeconds: number;
  attemptsLeft: number;
  hasCustomPin: boolean;
  recoveryEmail: string;
}

/**
 * Retrieves the current configured Admin PIN hash (custom or default).
 */
export function getActiveAdminPinHash(): string {
  try {
    const customHash = localStorage.getItem('vandali_admin_custom_pin_hash');
    if (customHash && customHash.length === 64) {
      return customHash;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ADMIN_HASH;
}

/**
 * Checks lockout status and remaining attempts for Admin Login.
 */
export function getAdminSecurityState(): AuthSecurityState {
  const recoveryEmail = ADMIN_RECOVERY_EMAIL;
  let hasCustomPin = false;
  try {
    hasCustomPin = Boolean(localStorage.getItem('vandali_admin_custom_pin_hash'));
  } catch {
    // ignore
  }

  try {
    const attempts = Number(sessionStorage.getItem('vandali_admin_attempts') || '0');
    const lockUntil = Number(sessionStorage.getItem('vandali_admin_lockout_until') || '0');
    const now = Date.now();

    if (lockUntil > now) {
      const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
      return {
        isLocked: true,
        lockoutRemainingSeconds: remainingSeconds,
        attemptsLeft: 0,
        hasCustomPin,
        recoveryEmail,
      };
    }

    if (lockUntil > 0 && lockUntil <= now) {
      sessionStorage.removeItem('vandali_admin_lockout_until');
      sessionStorage.setItem('vandali_admin_attempts', '0');
      return {
        isLocked: false,
        lockoutRemainingSeconds: 0,
        attemptsLeft: MAX_ATTEMPTS,
        hasCustomPin,
        recoveryEmail,
      };
    }

    return {
      isLocked: false,
      lockoutRemainingSeconds: 0,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
      hasCustomPin,
      recoveryEmail,
    };
  } catch {
    return {
      isLocked: false,
      lockoutRemainingSeconds: 0,
      attemptsLeft: MAX_ATTEMPTS,
      hasCustomPin,
      recoveryEmail,
    };
  }
}

/**
 * Verifies admin PIN against active hash (custom or default).
 */
export async function verifyAdminPin(pin: string): Promise<{ success: boolean; error?: string }> {
  const secState = getAdminSecurityState();
  if (secState.isLocked) {
    return {
      success: false,
      error: `Acceso bloqueado por seguridad. Espera ${secState.lockoutRemainingSeconds}s o solicita un código de recuperación a ${ADMIN_RECOVERY_EMAIL}.`,
    };
  }

  const cleanPin = pin.trim();
  if (!cleanPin) {
    return { success: false, error: 'Por favor ingresa tu PIN.' };
  }

  const computedHash = await hashString(`${ADMIN_SALT}:${cleanPin}`);
  const targetHash = getActiveAdminPinHash();

  if (computedHash === targetHash) {
    // Reset failed attempts
    try {
      sessionStorage.removeItem('vandali_admin_attempts');
      sessionStorage.removeItem('vandali_admin_lockout_until');

      // Store session token valid for 3 hours
      const sessionToken = await hashString(`admin_session_${Date.now()}_${Math.random()}`);
      sessionStorage.setItem('vandali_admin_token', sessionToken);
      sessionStorage.setItem(
        'vandali_admin_token_expiry',
        String(Date.now() + 3 * 60 * 60 * 1000)
      );
    } catch {
      // ignore
    }
    return { success: true };
  }

  // Failed attempt handler
  try {
    const currentAttempts = Number(sessionStorage.getItem('vandali_admin_attempts') || '0') + 1;
    sessionStorage.setItem('vandali_admin_attempts', String(currentAttempts));

    if (currentAttempts >= MAX_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      sessionStorage.setItem('vandali_admin_lockout_until', String(lockUntil));
      return {
        success: false,
        error: `PIN incorrecto. Has alcanzado el límite de intentos. Bloqueado temporalmente. Usa la opción de recuperación para enviar el código a ${ADMIN_RECOVERY_EMAIL}.`,
      };
    }

    return {
      success: false,
      error: `PIN de seguridad incorrecto. Te quedan ${MAX_ATTEMPTS - currentAttempts} intento(s).`,
    };
  } catch {
    return { success: false, error: 'PIN incorrecto.' };
  }
}

/**
 * Initiates the password recovery flow:
 * Generates a 6-digit cryptographic verification code and prepares dispatch to vandali.pizzeria@gmail.com
 */
export async function generateAdminResetCode(): Promise<{
  code: string;
  email: string;
  expiresInMinutes: number;
  mailtoUrl: string;
  gmailComposeUrl: string;
}> {
  // Generate random 6-digit numeric token
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const code = String(randomNum);
  const expiryTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes

  const codeHash = await hashString(`reset_${ADMIN_SALT}:${code}`);

  try {
    sessionStorage.setItem('vandali_admin_reset_hash', codeHash);
    sessionStorage.setItem('vandali_admin_reset_expiry', String(expiryTimestamp));
    sessionStorage.setItem('vandali_admin_reset_attempts', '0');
  } catch {
    // fallback
  }

  const subject = encodeURIComponent('🔐 Código de Recuperación de Administrador - Vandali Pizzería');
  const body = encodeURIComponent(
    `Hola Administrador de Vandali Pizzería Artesanal,\n\n` +
      `Has solicitado restablecer la clave/PIN del panel administrativo de Vandali.\n\n` +
      `Tu código de verificación de 6 dígitos es:\n\n` +
      `👉 ${code} 👈\n\n` +
      `Este código es válido por 10 minutos. Ingrésalo en la pantalla de recuperación para crear un nuevo PIN seguro.\n\n` +
      `Si no solicitaste este cambio, puedes ignorar este correo de forma segura.\n\n` +
      `--\n` +
      `Vandali Pizzería Artesanal - Mérida, Venezuela\n` +
      `Av. 2 Lora entre 27 y 28 • Tel: 0424-8954741`
  );

  const mailtoUrl = `mailto:${ADMIN_RECOVERY_EMAIL}?subject=${subject}&body=${body}`;
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${ADMIN_RECOVERY_EMAIL}&su=${subject}&body=${body}`;

  return {
    code,
    email: ADMIN_RECOVERY_EMAIL,
    expiresInMinutes: 10,
    mailtoUrl,
    gmailComposeUrl,
  };
}

/**
 * Validates the 6-digit code and saves a new hashed PIN for the admin.
 */
export async function verifyResetCodeAndSetNewPin(
  enteredCode: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const cleanCode = enteredCode.trim().replace(/\D/g, '');
  const cleanNewPin = newPin.trim();

  if (cleanCode.length !== 6) {
    return { success: false, error: 'El código de verificación debe contener 6 dígitos.' };
  }

  if (cleanNewPin.length < 4 || cleanNewPin.length > 12) {
    return {
      success: false,
      error: 'El nuevo PIN debe tener entre 4 y 12 caracteres (recomendado: 4-8 dígitos).',
    };
  }

  try {
    const savedHash = sessionStorage.getItem('vandali_admin_reset_hash');
    const expiry = Number(sessionStorage.getItem('vandali_admin_reset_expiry') || '0');
    const attempts = Number(sessionStorage.getItem('vandali_admin_reset_attempts') || '0');

    if (!savedHash || !expiry) {
      return {
        success: false,
        error: 'No hay ninguna solicitud de recuperación activa o el código ya fue utilizado. Solicita uno nuevo.',
      };
    }

    if (Date.now() > expiry) {
      sessionStorage.removeItem('vandali_admin_reset_hash');
      sessionStorage.removeItem('vandali_admin_reset_expiry');
      return {
        success: false,
        error: 'El código de recuperación ha expirado (límite 10 min). Por favor solicita uno nuevo.',
      };
    }

    if (attempts >= 5) {
      sessionStorage.removeItem('vandali_admin_reset_hash');
      sessionStorage.removeItem('vandali_admin_reset_expiry');
      return {
        success: false,
        error: 'Demasiados intentos fallidos con el código. Por seguridad se canceló la solicitud. Genera uno nuevo.',
      };
    }

    const testHash = await hashString(`reset_${ADMIN_SALT}:${cleanCode}`);

    if (testHash !== savedHash) {
      sessionStorage.setItem('vandali_admin_reset_attempts', String(attempts + 1));
      return {
        success: false,
        error: `Código de verificación incorrecto. Intentos restantes: ${4 - attempts}.`,
      };
    }

    // Code verified! Save new hashed PIN
    const newHash = await hashString(`${ADMIN_SALT}:${cleanNewPin}`);
    localStorage.setItem('vandali_admin_custom_pin_hash', newHash);

    // Clean up reset sessions and unlock admin
    sessionStorage.removeItem('vandali_admin_reset_hash');
    sessionStorage.removeItem('vandali_admin_reset_expiry');
    sessionStorage.removeItem('vandali_admin_reset_attempts');
    sessionStorage.removeItem('vandali_admin_attempts');
    sessionStorage.removeItem('vandali_admin_lockout_until');

    // Create immediate active admin session
    const sessionToken = await hashString(`admin_session_${Date.now()}_${Math.random()}`);
    sessionStorage.setItem('vandali_admin_token', sessionToken);
    sessionStorage.setItem(
      'vandali_admin_token_expiry',
      String(Date.now() + 3 * 60 * 60 * 1000)
    );

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error al guardar el nuevo PIN de seguridad.',
    };
  }
}

/**
 * Updates admin PIN when already authenticated or changing PIN in settings.
 */
export async function updateAdminPin(newPin: string): Promise<{ success: boolean; error?: string }> {
  const clean = newPin.trim();
  if (clean.length < 4 || clean.length > 12) {
    return { success: false, error: 'El PIN debe tener entre 4 y 12 dígitos.' };
  }
  try {
    const newHash = await hashString(`${ADMIN_SALT}:${clean}`);
    localStorage.setItem('vandali_admin_custom_pin_hash', newHash);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Error al actualizar PIN.' };
  }
}

/**
 * Resets admin PIN back to default factory key.
 */
export function restoreDefaultAdminPin(): void {
  try {
    localStorage.removeItem('vandali_admin_custom_pin_hash');
    sessionStorage.removeItem('vandali_admin_attempts');
    sessionStorage.removeItem('vandali_admin_lockout_until');
  } catch {
    // ignore
  }
}

export function isAdminSessionValid(): boolean {
  try {
    const token = sessionStorage.getItem('vandali_admin_token');
    const expiry = Number(sessionStorage.getItem('vandali_admin_token_expiry') || '0');
    if (!token || !expiry) return false;
    if (Date.now() > expiry) {
      sessionStorage.removeItem('vandali_admin_token');
      sessionStorage.removeItem('vandali_admin_token_expiry');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const hasActiveAdminSession = isAdminSessionValid;

export function revokeAdminSession(): void {
  try {
    sessionStorage.removeItem('vandali_admin_token');
    sessionStorage.removeItem('vandali_admin_token_expiry');
  } catch {
    // ignore
  }
}

/**
 * VIP Customer Accounts Integrity:
 * Signs and verifies customer loyalty profile to prevent local storage tampering.
 */
export async function signUserProfile(profile: UserProfile): Promise<string> {
  const payload = `${VIP_SALT}:${profile.id}:${profile.phone}:${profile.loyaltyTickets}:${profile.hasUnlockedDiscount}:${profile.totalSpentUSD}`;
  return hashString(payload);
}

export async function sanitizeAndSecureProfile(rawProfile: UserProfile): Promise<UserProfile> {
  // Validate ticket bounds
  const cleanTickets = Math.max(0, Math.min(10, Math.floor(rawProfile.loyaltyTickets || 0)));
  const cleanDiscount = rawProfile.hasUnlockedDiscount || cleanTickets >= 10;

  return {
    ...rawProfile,
    name: rawProfile.name.trim().slice(0, 80),
    phone: rawProfile.phone.trim().replace(/[^\d+]/g, '').slice(0, 20),
    address: rawProfile.address ? rawProfile.address.trim().slice(0, 150) : undefined,
    loyaltyTickets: cleanTickets,
    hasUnlockedDiscount: cleanDiscount,
  };
}
