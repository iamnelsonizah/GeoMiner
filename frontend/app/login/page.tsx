'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  Compass,
  Lock,
  Mail,
  Pickaxe
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, checkRateLimit, clearRateLimit } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Read target URL or default to workbench
  const redirectTarget = searchParams?.get('redirect') || '/app';

  // If already authenticated, redirect to target
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTarget);
    }
  }, [isAuthenticated, redirectTarget, router]);

  // Read reset success notification from URL query if user just reset password
  useEffect(() => {
    if (searchParams?.get('reset') === 'success') {
      setSuccessMsg('Your password has been reset successfully. Please enter your new password to sign in.');
    }
    if (searchParams?.get('verified') === 'true') {
      setSuccessMsg('Email successfully verified. Please sign in with your credentials.');
    }
  }, [searchParams]);

  // Lockout live countdown timer with auto-reset on 0
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          if (email) {
            clearRateLimit(`login_${email.trim().toLowerCase()}`);
          }
          setErrorMsg(null);
          setSuccessMsg('Security lockout expired. You can now re-attempt sign in.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds, email, clearRateLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limit before dispatching request
    const rateStatus = checkRateLimit(`login_${normalizedEmail}`);
    if (rateStatus.isLocked && rateStatus.remainingSeconds > 0) {
      setLockoutSeconds(rateStatus.remainingSeconds);
      return;
    }

    setLoading(true);
    const res = await login({ email: normalizedEmail, password });
    setLoading(false);

    if (!res.success) {
      if (res.lockoutSeconds && res.lockoutSeconds > 0) {
        setLockoutSeconds(res.lockoutSeconds);
      } else {
        setErrorMsg(res.message);
      }
      return;
    }

    setSuccessMsg('Authentication confirmed. Accessing exploration workbench...');
    setTimeout(() => {
      router.push(redirectTarget);
    }, 350);
  };

  return (
    <div className="min-h-screen bg-[#0B0F12] text-white selection:bg-[#B7E89F] selection:text-[#0B0F12] font-sans flex flex-col justify-between relative">
      
      {/* ────────────────────────────────── Top Bar ────────────────────────────────── */}
      <header className="relative z-10 border-b border-[#1D262F] bg-[#0B0F12]/95 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <svg className="w-5 h-5 text-[#B7E89F]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L1 21h22L12 2zm0 3.8l7.5 13H4.5L12 5.8z"/>
              </svg>
              <span className="text-[17px] font-semibold tracking-[-0.01em] text-white">
                GeoMiner
              </span>
            </Link>
            <span className="hidden sm:inline-block text-[#2E3C4D]">|</span>
            <span className="hidden sm:inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#9EABB8]">
              MINERAL EXPLORATION
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-1.5 text-[13px] text-[#9EABB8] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────── Main Login Card ────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-8">
        <div className="w-full max-w-md bg-[#10161C] border border-[#1E2735] rounded-xl p-8 sm:p-9 space-y-6 shadow-2xl">
          
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#B7E89F]">
              <Compass className="w-3.5 h-3.5 text-[#B7E89F]" />
              <span>EXPLORATION TERMINAL</span>
            </div>
            <h2 className="text-2xl font-normal tracking-[-0.02em] text-white">
              Sign in to GeoMiner
            </h2>
            <p className="text-[13.5px] text-[#9EABB8] leading-relaxed">
              Enter your credentials to access the remote sensing prospectivity workbench
            </p>
          </div>

          {/* Live Lockout Countdown Alert */}
          {lockoutSeconds > 0 && (
            <div className="p-3.5 rounded-lg bg-[#2A1517] border border-[#EF4444]/40 text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed flex-1">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>Account Temporarily Locked</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#EF4444]">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span className="text-sm font-bold">{lockoutSeconds}s</span>
                  </span>
                </div>
                <div className="text-[#FCA5A5]">
                  Repeated failed logins detected. Lockout automatically resets in{' '}
                  <strong className="font-mono text-white">{lockoutSeconds}s</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && lockoutSeconds <= 0 && (
            <div className="p-3.5 rounded-lg bg-[#2A1517] border border-[#EF4444]/40 text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="p-3.5 rounded-lg bg-[#14261C] border border-[#B7E89F]/40 text-[#C8FFB2] text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#B7E89F] flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5">
              <label 
                htmlFor="email" 
                className="block text-[12.5px] font-medium text-[#C2CCD6]"
              >
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="geologist@miningcorp.com"
                  disabled={loading || lockoutSeconds > 0}
                  required
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="block text-[12.5px] font-medium text-[#C2CCD6]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#9EABB8] hover:text-[#B7E89F] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={loading || lockoutSeconds > 0}
                  required
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className="w-full h-11 bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-semibold text-[13.5px] rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0B0F12] border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : lockoutSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Locked ({lockoutSeconds}s)</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Footer inside card */}
          <div className="pt-4 border-t border-[#1E2735] text-center space-y-3">
            <p className="text-[13px] text-[#9EABB8]">
              Don&apos;t have an exploration account?{' '}
              <Link 
                href="/signup" 
                className="text-[#B7E89F] hover:underline font-medium ml-1"
              >
                Create Account
              </Link>
            </p>
          </div>

        </div>
      </main>

      {/* ────────────────────────────────── Footer ────────────────────────────────── */}
      <footer className="border-t border-[#1D262F] py-6 text-center text-xs text-[#606F7B] font-mono">
        GeoMiner Geospatial Systems · Multi-Sensor Exploration Security Engine
      </footer>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0F12] flex items-center justify-center text-[#9EABB8] font-mono text-sm">
        Loading exploration terminal...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
