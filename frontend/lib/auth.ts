/**
 * GeoMiner Authentication & Security Service
 * Backed by Supabase PostgreSQL database for persistent user accounts,
 * OTP verification, rate limits, and remote sensing exploration sessions.
 */

export interface User {
  id: string;
  email: string;
  fullName: string;
  organization?: string;
  role?: string;
  isVerified: boolean;
  createdAt: string;
}

interface RateLimitRecord {
  failedAttempts: number;
  lockedUntil: number;
}

const SESSION_KEY = 'geominer_session_v1';
const LOCAL_USERS_KEY = 'geominer_users_v1';
const LOCAL_RATE_KEY = 'geominer_ratelimit_v1';

function isClient(): boolean {
  return typeof window !== 'undefined';
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getLocalRateLimits(): Record<string, RateLimitRecord> {
  if (!isClient()) return {};
  try {
    const data = localStorage.getItem(LOCAL_RATE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveLocalRateLimits(records: Record<string, RateLimitRecord>): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(LOCAL_RATE_KEY, JSON.stringify(records));
  } catch {}
}

export const authService = {
  /**
   * Get active authenticated user session
   */
  getCurrentUser(): User | null {
    if (!isClient()) return null;
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data) as User;
    } catch {
      return null;
    }
  },

  /**
   * Check rate limit status for key
   */
  checkRateLimit(key: string): { isLocked: boolean; remainingSeconds: number } {
    const normalizedKey = key.trim().toLowerCase();
    const limits = getLocalRateLimits();
    const record = limits[normalizedKey];

    if (record) {
      const now = Date.now();
      if (record.lockedUntil > now) {
        return {
          isLocked: true,
          remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }
      if (record.lockedUntil > 0) {
        delete limits[normalizedKey];
        saveLocalRateLimits(limits);
      }
    }

    return { isLocked: false, remainingSeconds: 0 };
  },

  /**
   * Clear rate limit locally and in database
   */
  clearRateLimit(key: string): void {
    const normalizedKey = key.trim().toLowerCase();
    const limits = getLocalRateLimits();
    delete limits[normalizedKey];
    saveLocalRateLimits(limits);

    if (isClient()) {
      fetch('/api/auth/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalizedKey, action: 'clear' }),
      }).catch(() => {});
    }
  },

  /**
   * Record local failed attempt cache
   */
  recordLocalFailedAttempt(key: string, lockDurationSeconds = 60): { locked: boolean; remainingAttempts: number; lockedUntil: number } {
    const limits = getLocalRateLimits();
    const normalizedKey = key.toLowerCase();
    const record = limits[normalizedKey] || { failedAttempts: 0, lockedUntil: 0 };

    record.failedAttempts += 1;
    let locked = false;

    if (record.failedAttempts >= 5) {
      record.lockedUntil = Date.now() + lockDurationSeconds * 1000;
      record.failedAttempts = 0;
      locked = true;
    }

    limits[normalizedKey] = record;
    saveLocalRateLimits(limits);

    return {
      locked,
      remainingAttempts: Math.max(0, 5 - record.failedAttempts),
      lockedUntil: record.lockedUntil,
    };
  },

  /**
   * Register new user in Supabase Postgres
   */
  async register(params: {
    fullName: string;
    email: string;
    password: string;
    role?: string;
    organization?: string;
  }): Promise<{ success: boolean; message: string; otpCode?: string }> {
    const email = params.email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Registration failed. Please try again.',
        };
      }

      return {
        success: true,
        message: data.message || `A 6-digit verification code has been dispatched to ${email}`,
      };
    } catch (err: any) {
      console.error('Registration network error:', err);
      return {
        success: false,
        message: err?.message || 'Unable to contact registration service.',
      };
    }
  },

  /**
   * Verify OTP code against Supabase otp_codes table
   */
  async verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string; user?: User; lockoutSeconds?: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, code: cleanCode, type: 'verification' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.lockoutSeconds) {
          const limits = getLocalRateLimits();
          limits[`otp_${normalizedEmail}`] = {
            failedAttempts: 5,
            lockedUntil: Date.now() + data.lockoutSeconds * 1000,
          };
          saveLocalRateLimits(limits);
        }

        return {
          success: false,
          lockoutSeconds: data.lockoutSeconds,
          message: data.message || 'Incorrect verification code.',
        };
      }

      // Store verified session
      const user: User = data.user;
      if (isClient() && user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        this.clearRateLimit(`otp_${normalizedEmail}`);
      }

      return {
        success: true,
        message: 'Account verified successfully.',
        user,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error verifying code.',
      };
    }
  },

  /**
   * Resend 6-digit code stored in Supabase with Resend dispatch
   */
  async resendOTP(email: string): Promise<{ success: boolean; message: string; otpCode?: string; cooldownSeconds?: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const newCode = generateOTP();

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          code: newCode,
          type: 'verification',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || 'Failed to resend code.',
        };
      }

      return {
        success: true,
        message: `A new 6-digit verification code has been dispatched to ${normalizedEmail}.`,
        otpCode: newCode,
        cooldownSeconds: 30,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error resending code.',
      };
    }
  },

  /**
   * Sign in user with email & password verified in Supabase Postgres
   */
  async login(params: {
    email: string;
    password: string;
  }): Promise<{
    success: boolean;
    message: string;
    user?: User;
    requiresVerification?: boolean;
    otpCode?: string;
    lockoutSeconds?: number;
  }> {
    const normalizedEmail = params.email.trim().toLowerCase();

    // Check local lockout cache first for instant feedback
    const localRate = this.checkRateLimit(`login_${normalizedEmail}`);
    if (localRate.isLocked && localRate.remainingSeconds > 0) {
      return {
        success: false,
        lockoutSeconds: localRate.remainingSeconds,
        message: `Account temporarily locked due to repeated failed logins. Please wait ${localRate.remainingSeconds}s.`,
      };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: params.password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.lockoutSeconds && data.lockoutSeconds > 0) {
          const limits = getLocalRateLimits();
          limits[`login_${normalizedEmail}`] = {
            failedAttempts: 5,
            lockedUntil: Date.now() + data.lockoutSeconds * 1000,
          };
          saveLocalRateLimits(limits);
        }

        return {
          success: false,
          requiresVerification: data.requiresVerification,
          lockoutSeconds: data.lockoutSeconds,
          message: data.message || 'Invalid email or password.',
        };
      }

      // Successful login
      const user: User = data.user;
      if (isClient() && user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        this.clearRateLimit(`login_${normalizedEmail}`);
      }

      return {
        success: true,
        message: 'Login successful.',
        user,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Server connection error during login.',
      };
    }
  },

  /**
   * Request password reset code via Supabase + Resend
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; otpCode?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const resetCode = generateOTP();

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          code: resetCode,
          type: 'password_reset',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || 'Failed to dispatch reset code.',
        };
      }

      return {
        success: true,
        message: `A 6-digit password reset code has been dispatched to ${normalizedEmail}`,
        otpCode: resetCode,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error requesting password reset.',
      };
    }
  },

  /**
   * Complete password reset in Supabase Postgres
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string; lockoutSeconds?: number }> {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, code: code.trim(), newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.lockoutSeconds) {
          const limits = getLocalRateLimits();
          limits[`reset_attempt_${normalizedEmail}`] = {
            failedAttempts: 5,
            lockedUntil: Date.now() + data.lockoutSeconds * 1000,
          };
          saveLocalRateLimits(limits);
        }

        return {
          success: false,
          lockoutSeconds: data.lockoutSeconds,
          message: data.message || 'Incorrect reset code.',
        };
      }

      this.clearRateLimit(`reset_attempt_${normalizedEmail}`);
      return {
        success: true,
        message: 'Password reset successfully. You can now sign in.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error completing password reset.',
      };
    }
  },

  /**
   * Terminate active session
   */
  logout(): void {
    if (isClient()) {
      localStorage.removeItem(SESSION_KEY);
    }
  },
};
