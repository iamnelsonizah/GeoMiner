import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { sendEmailOTP } from '@/lib/email';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, password, role, organization } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { success: false, message: 'Full name, email, and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limit in Supabase
    const rateRes = await query(
      'SELECT failed_attempts, locked_until FROM rate_limits WHERE key = $1',
      [`reg_${normalizedEmail}`]
    );

    if (rateRes.rows.length > 0) {
      const { locked_until } = rateRes.rows[0];
      if (locked_until && new Date(locked_until) > new Date()) {
        const remaining = Math.ceil((new Date(locked_until).getTime() - Date.now()) / 1000);
        return NextResponse.json({
          success: false,
          lockoutSeconds: remaining,
          message: `Too many attempts. Please try again in ${remaining}s.`,
        }, { status: 429 });
      }
    }

    // Check if user already exists and is verified
    const existing = await query(
      'SELECT id, is_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0 && existing.rows[0].is_verified) {
      return NextResponse.json(
        { success: false, message: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Upsert unverified user in Supabase users table
    let userId: string;
    if (existing.rows.length > 0) {
      const updateRes = await query(
        `UPDATE users
         SET full_name = $1, password_hash = $2, role = $3, organization = $4, is_verified = false, updated_at = now()
         WHERE email = $5 RETURNING id`,
        [fullName.trim(), passwordHash, role || 'exploration_geologist', organization || 'Independent / Exploration', normalizedEmail]
      );
      userId = updateRes.rows[0].id;
    } else {
      const insertRes = await query(
        `INSERT INTO users (email, full_name, password_hash, role, organization, is_verified)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
        [normalizedEmail, fullName.trim(), passwordHash, role || 'exploration_geologist', organization || 'Independent / Exploration']
      );
      userId = insertRes.rows[0].id;
    }

    // Generate 6-digit code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Supabase otp_codes table
    await query(
      `INSERT INTO otp_codes (email, code, type, expires_at)
       VALUES ($1, $2, 'verification', $3)`,
      [normalizedEmail, otpCode, expiresAt]
    );

    // Dispatch email via Resend
    const sendResult = await sendEmailOTP({
      email: normalizedEmail,
      code: otpCode,
      type: 'verification',
      fullName: fullName.trim(),
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, message: `Failed to dispatch email: ${sendResult.error || 'Email error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${normalizedEmail}`,
      userId,
    });
  } catch (error: any) {
    console.error('Error in register route:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error during registration' },
      { status: 500 }
    );
  }
}
