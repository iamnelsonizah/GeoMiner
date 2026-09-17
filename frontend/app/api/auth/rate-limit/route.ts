import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ isLocked: false, remainingSeconds: 0 });
    }

    const normalizedKey = key.trim().toLowerCase();
    const res = await query(
      'SELECT failed_attempts, locked_until FROM rate_limits WHERE key = $1',
      [normalizedKey]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ isLocked: false, remainingSeconds: 0 });
    }

    const { locked_until } = res.rows[0];
    if (locked_until) {
      const lockDate = new Date(locked_until);
      const now = new Date();
      if (lockDate > now) {
        const remaining = Math.ceil((lockDate.getTime() - now.getTime()) / 1000);
        return NextResponse.json({ isLocked: true, remainingSeconds: remaining });
      } else {
        // Expired lockout: auto-clean record from Supabase
        await query('DELETE FROM rate_limits WHERE key = $1', [normalizedKey]);
        return NextResponse.json({ isLocked: false, remainingSeconds: 0 });
      }
    }

    return NextResponse.json({ isLocked: false, remainingSeconds: 0 });
  } catch (error: any) {
    console.error('Error checking rate limit in Supabase:', error);
    return NextResponse.json({ isLocked: false, remainingSeconds: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, action } = await req.json();
    if (!key) {
      return NextResponse.json({ success: false, message: 'Key is required' }, { status: 400 });
    }

    const normalizedKey = key.trim().toLowerCase();
    if (action === 'clear') {
      await query('DELETE FROM rate_limits WHERE key = $1', [normalizedKey]);
      return NextResponse.json({ success: true, message: 'Rate limit cleared' });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating rate limit in Supabase:', error);
    return NextResponse.json({ success: false, message: error?.message }, { status: 500 });
  }
}
