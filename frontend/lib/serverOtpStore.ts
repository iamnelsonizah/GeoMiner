/**
 * Server-side OTP store for GeoMiner authentication
 * Stores active OTP codes per email with 10-minute expiry.
 */

interface ServerOTPRecord {
  codes: string[];
  expiresAt: number;
  attempts: number;
}

const globalForOtp = global as unknown as {
  serverOtpStore?: Map<string, ServerOTPRecord>;
};

export const serverOtpStore =
  globalForOtp.serverOtpStore || new Map<string, ServerOTPRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalForOtp.serverOtpStore = serverOtpStore;
}

export function recordServerOTP(email: string, code: string): void {
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const existing = serverOtpStore.get(normalized);

  const cleanCode = code.trim();
  const codes = existing && existing.expiresAt > now
    ? Array.from(new Set([...existing.codes, cleanCode]))
    : [cleanCode];

  serverOtpStore.set(normalized, {
    codes,
    expiresAt: now + 10 * 60 * 1000,
    attempts: existing ? existing.attempts : 0,
  });
}

export function verifyServerOTP(email: string, code: string): { valid: boolean; reason?: string } {
  const normalized = email.trim().toLowerCase();
  const record = serverOtpStore.get(normalized);
  const now = Date.now();

  if (!record) {
    return { valid: false, reason: 'No active code found on server' };
  }

  if (now > record.expiresAt) {
    serverOtpStore.delete(normalized);
    return { valid: false, reason: 'Code has expired' };
  }

  const cleanCode = code.trim();
  if (record.codes.includes(cleanCode)) {
    // Clear code after successful use
    serverOtpStore.delete(normalized);
    return { valid: true };
  }

  record.attempts += 1;
  return { valid: false, reason: 'Code does not match' };
}
