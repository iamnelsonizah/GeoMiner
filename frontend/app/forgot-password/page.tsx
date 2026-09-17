'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  Mail,
  KeyRound,
  Lock
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestPasswordReset, resetPassword, checkRateLimit, clearRateLimit } = useAuth();

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // 1 = enter email, 2 = enter 6-digit code & new password

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Lockout live countdown timer with auto-reset on 0
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          if (email) {
            clearRateLimit(`reset_attempt_${email.trim().toLowerCase()}`);
          }
          setErrorMsg(null);
          setSuccessMsg('Security lockout expired. You can now enter your recovery code.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds, email, clearRateLimit]);

  // Check rate limit on email change or step switch
  useEffect(() => {
    if (!email || step !== 2) return;
    const rate = checkRateLimit(`reset_attempt_${email.trim().toLowerCase()}`);
    if (rate.isLocked && rate.remainingSeconds > 0) {
      setLockoutSeconds(rate.remainingSeconds);
    }
  }, [email, step, checkRateLimit]);

  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await requestPasswordReset(email.trim().toLowerCase());
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    setCooldown(30);
    setStep(2);
    setSuccessMsg(`A 6-digit password reset code has been dispatched to ${email}. Please check your inbox.`);
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (cleanVal.length > 1) {
      const pasted = cleanVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pasted.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) {
      setErrorMsg('Please enter the full 6-digit reset code.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    const res = await resetPassword(email.trim().toLowerCase(), fullCode, newPassword);
    setLoading(false);

    if (!res.success) {
      if (res.lockoutSeconds && res.lockoutSeconds > 0) {
        setLockoutSeconds(res.lockoutSeconds);
        setErrorMsg(null);
        return;
      }
      setErrorMsg(res.message);
      return;
    }

    setSuccessMsg('Password reset successfully! Redirecting to sign in...');
    setTimeout(() => {
      router.push('/login?reset=success');
    }, 1200);
  };

  const [resending, setResending] = useState(false);
  const handleResend = async () => {
    if (cooldown > 0 || resending || lockoutSeconds > 0) return;
    setErrorMsg(null);
    setResending(true);
    const res = await requestPasswordReset(email.trim().toLowerCase());
    setResending(false);

    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    setCooldown(30);
    setSuccessMsg(`A new 6-digit reset code has been dispatched to ${email}.`);
    setOtpDigits(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
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
              PASSWORD RECOVERY
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link 
              href="/login" 
              className="inline-flex items-center gap-1.5 text-[13px] text-[#9EABB8] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────── Main Recovery Card ────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-8">
        <div className="w-full max-w-md bg-[#10161C] border border-[#1E2735] rounded-xl p-8 sm:p-9 space-y-6 shadow-2xl">
          
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#B7E89F]">
              <KeyRound className="w-3.5 h-3.5 text-[#B7E89F]" />
              <span>CREDENTIAL RECOVERY</span>
            </div>
            <h2 className="text-2xl font-normal tracking-[-0.02em] text-white">
              {step === 1 ? 'Reset your password' : 'Enter 6-digit recovery code'}
            </h2>
            <p className="text-[13.5px] text-[#9EABB8] leading-relaxed max-w-sm mx-auto">
              {step === 1 
                ? 'Enter your registered email address to receive a secure 6-digit recovery code' 
                : `Enter the 6-digit code sent to ${email} and set your new password`}
            </p>
          </div>

          {/* Live Lockout Alert */}
          {lockoutSeconds > 0 && (
            <div className="p-3.5 rounded-lg bg-[#2A1517] border border-[#EF4444]/40 text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed flex-1">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>Recovery Locked</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#EF4444]">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span className="text-sm font-bold">{lockoutSeconds}s</span>
                  </span>
                </div>
                <div className="text-[#FCA5A5]">
                  Too many reset attempts. Lockout automatically resets in{' '}
                  <strong className="font-mono text-white">{lockoutSeconds}s</strong>.
                </div>
              </div>
            </div>
          )}

          {errorMsg && lockoutSeconds <= 0 && (
            <div className="p-3.5 rounded-lg bg-[#2A1517] border border-[#EF4444]/40 text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-[#14261C] border border-[#B7E89F]/40 text-[#C8FFB2] text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#B7E89F] flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Step 1: Request Code */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                  Registered Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="geologist@exploration.com"
                    className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-semibold text-[13.5px] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
              >
                <span>{loading ? 'Dispatching Recovery Code...' : 'Send 6-Digit Reset Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Step 2: Code Verification & Password Reset */}
          {step === 2 && (
            <form onSubmit={handleReset} className="space-y-5 pt-1">
              
              {/* Notice */}
              <div className="p-3.5 rounded-lg bg-[#0B0F12] border border-[#1E2735] flex items-center gap-3 text-xs text-[#CBD5E1]">
                <Mail className="w-4 h-4 text-[#B7E89F] flex-shrink-0" />
                <span>Recovery code sent to <strong className="text-white">{email}</strong>. Check your inbox and spam.</span>
              </div>

              <div className="space-y-2">
                <label className="block text-center text-xs font-mono uppercase tracking-[0.12em] text-[#9EABB8]">
                  6-Digit Recovery Code
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={lockoutSeconds > 0}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-11 h-13 sm:w-13 sm:h-14 bg-[#0B0F12] border rounded-lg text-center text-xl sm:text-2xl font-mono font-bold outline-none transition-colors shadow-inner ${
                        lockoutSeconds > 0 
                          ? 'border-[#EF4444]/40 text-[#69766F] cursor-not-allowed' 
                          : 'border-[#1E2735] focus:border-[#B7E89F] text-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || lockoutSeconds > 0}
                className={`w-full h-11 font-semibold text-[13.5px] rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  lockoutSeconds > 0
                    ? 'bg-[#182328] text-[#9EABB8] border border-[#1E2735] cursor-not-allowed'
                    : 'bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] cursor-pointer shadow-sm'
                }`}
              >
                <span>
                  {loading 
                    ? 'Resetting Password...' 
                    : lockoutSeconds > 0 
                      ? `Locked · Resets in ${lockoutSeconds}s` 
                      : 'Save New Password & Sign In'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[#9EABB8] hover:text-white transition-colors cursor-pointer"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading || resending || lockoutSeconds > 0}
                  className={`inline-flex items-center gap-1 font-mono transition-colors cursor-pointer ${
                    cooldown > 0 || loading || resending || lockoutSeconds > 0 ? 'text-[#606F7B] cursor-not-allowed' : 'text-[#B7E89F] hover:underline'
                  }`}
                >
                  <RotateCcw className={`w-3 h-3 ${cooldown > 0 || loading || resending || lockoutSeconds > 0 ? '' : 'text-[#B7E89F]'} ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Dispatching New Code...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code via Email'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="text-center text-[13px] text-[#9EABB8] pt-2 border-t border-[#1E2735]">
            Remember your password?{' '}
            <Link href="/login" className="text-[#B7E89F] hover:underline font-medium">
              Sign in
            </Link>
          </div>

        </div>
      </main>

      <footer className="border-t border-[#1D262F] py-6 text-center text-xs text-[#606F7B] font-mono">
        GeoMiner Geospatial Systems · Multi-Sensor Exploration Security Engine
      </footer>
    </div>
  );
}
