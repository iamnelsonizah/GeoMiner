import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { sendEmailOTP } from '@/lib/email';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rateLimitKey = `login_${normalizedEmail}`;

    // 1. Check rate limit in Supabase
    const rateRes = await query(
      'SELECT failed_attempts, locked_until FROM rate_limits WHERE key = $1',
      [rateLimitKey]
    );

    if (rateRes.rows.length > 0) {
      const { locked_until, failed_attempts } = rateRes.rows[0];
      if (locked_until && new Date(locked_until) > new Date()) {
        const remaining = Math.ceil((new Date(locked_until).getTime() - Date.now()) / 1000);
        return NextResponse.json({
          success: false,
          lockoutSeconds: remaining,
          message: `Account temporarily locked due to repeated failed logins. Please wait ${remaining}s.`,
        });
      }
    }

    // 2. Query user from Supabase
    const userRes = await query(
      'SELECT id, email, full_name, role, organization, is_verified, password_hash, created_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    let isPasswordValid = false;
    let user = userRes.rows[0];

    if (user && user.password_hash) {
      // Check bcrypt hash
      try {
        isPasswordValid = await bcrypt.compare(password, user.password_hash);
      } catch {
        // Fallback check
        isPasswordValid = user.password_hash === Buffer.from(password).toString('base64');
      }

      if (!isPasswordValid && user.password_hash === Buffer.from(password).toString('base64')) {
        isPasswordValid = true;
      }
    }

    // 3. If invalid credentials, increment failed attempts in Supabase
    if (!user || !isPasswordValid) {
      const currentAttempts = rateRes.rows[0]?.failed_attempts || 0;
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 60 * 1000);
        await query(
          `INSERT INTO rate_limits (key, failed_attempts, locked_until, updated_at)
           VALUES ($1, 0, $2, now())
           ON CONFLICT (key) DO UPDATE
           SET failed_attempts = 0, locked_until = $2, updated_at = now()`,
          [rateLimitKey, lockedUntil]
        );

        return NextResponse.json({
          success: false,
          lockoutSeconds: 60,
          message: 'Account temporarily locked due to repeated failed logins. Please wait 60s.',
        });
      } else {
        await query(
          `INSERT INTO rate_limits (key, failed_attempts, locked_until, updated_at)
           VALUES ($1, $2, null, now())
           ON CONFLICT (key) DO UPDATE
           SET failed_attempts = $2, updated_at = now()`,
          [rateLimitKey, newAttempts]
        );

        return NextResponse.json({
          success: false,
          message: `Invalid email or password. ${5 - newAttempts} attempts remaining.`,
        });
      }
    }

    // 4. Check if account is verified
    if (!user.is_verified) {
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await query(
        `INSERT INTO otp_codes (email, code, type, expires_at)
         VALUES ($1, $2, 'verification', $3)`,
        [normalizedEmail, otpCode, expiresAt]
      );

      sendEmailOTP({
        email: normalizedEmail,
        code: otpCode,
        type: 'verification',
        fullName: user.full_name,
      });

      return NextResponse.json({
        success: false,
        requiresVerification: true,
        message: 'Account not yet verified. A 6-digit verification code has been dispatched to your email.',
      });
    }

    // 5. Successful login: Clear rate limits
    await query('DELETE FROM rate_limits WHERE key = $1', [rateLimitKey]);

    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      organization: user.organization,
      isVerified: user.is_verified,
      createdAt: user.created_at,
    };

    return NextResponse.json({
      success: true,
      message: 'Login successful.',
      user: safeUser,
    });
  } catch (error: any) {
    console.error('Error in login route:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error during login' },
      { status: 500 }
    );
  }
}
