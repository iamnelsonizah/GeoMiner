'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  Shield, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  Mail,
  Compass,
  User,
  Building,
  Briefcase,
  Lock
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { register, verifyOTP, resendOTP, checkRateLimit, clearRateLimit, isAuthenticated } = useAuth();

  // Step 1: Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('exploration_geologist');

  // Step state: 1 = registration form, 2 = 6-digit OTP verification
  const [step, setStep] = useState<1 | 2>(1);

  // 6-digit OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Input refs for auto-focus navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If already authenticated, redirect to /app
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/app');
    }
  }, [isAuthenticated, router]);

  // Cooldown countdown timer
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
            clearRateLimit(`otp_${email.trim().toLowerCase()}`);
          }
          setErrorMsg(null);
          setSuccessMsg('Security lockout expired. You can now enter your verification code.');
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
    const rate = checkRateLimit(`otp_${email.trim().toLowerCase()}`);
    if (rate.isLocked && rate.remainingSeconds > 0) {
      setLockoutSeconds(rate.remainingSeconds);
    }
  }, [email, step, checkRateLimit]);

  // Auto-focus first OTP box when entering Step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Step 1 Submit: Register and request OTP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await register({
      fullName,
      email: email.trim().toLowerCase(),
      password,
      role,
      organization,
    });

    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.message);
      return;
    }

    // Move to step 2: 6-digit code verification
    setCooldown(30);
    setStep(2);
    setSuccessMsg(`A 6-digit verification code has been dispatched to ${email}. Please check your inbox.`);
  };

  // Handle individual OTP digit change
  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');

    // Handle multi-character paste
    if (cleanVal.length > 1) {
      const pastedDigits = cleanVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-advance to next box if digit was entered
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2 Submit: Verify OTP code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    const res = await verifyOTP(email.trim().toLowerCase(), fullCode);
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

    setSuccessMsg('Account verified and authenticated! Launching exploration workbench...');
    setTimeout(() => {
      router.push('/app');
    }, 700);
  };

  // Resend code with 30s cooldown rate limit
  const [resending, setResending] = useState(false);
  const handleResend = async () => {
    if (cooldown > 0 || resending || lockoutSeconds > 0) return;
    setErrorMsg(null);
    setResending(true);
    const res = await resendOTP(email.trim().toLowerCase());
    setResending(false);

    if (!res.success) {
      setErrorMsg(res.message);
      if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
      return;
    }

    setCooldown(res.cooldownSeconds || 30);
    setSuccessMsg(`A new 6-digit verification code has been dispatched to ${email}.`);
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
              ACCOUNT REGISTRATION
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

      {/* ────────────────────────────────── Main Signup / Verify Card ────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-8">
        <div className="w-full max-w-lg bg-[#10161C] border border-[#1E2735] rounded-xl p-8 sm:p-9 space-y-6 shadow-2xl">
          
          {/* Header Title */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#B7E89F]">
              {step === 1 ? <Compass className="w-3.5 h-3.5 text-[#B7E89F]" /> : <Shield className="w-3.5 h-3.5 text-[#B7E89F]" />}
              <span>{step === 1 ? 'PROVISION EXPLORATION WORKSPACE' : 'SECURITY VERIFICATION'}</span>
            </div>
            <h2 className="text-2xl font-normal tracking-[-0.02em] text-white">
              {step === 1 ? 'Create your GeoMiner account' : 'Enter 6-digit verification code'}
            </h2>
            <p className="text-[13.5px] text-[#9EABB8] leading-relaxed max-w-sm mx-auto">
              {step === 1 
                ? 'Join mineral exploration teams deploying satellite hydrothermal alteration and lithological index pipelines'
                : `We dispatched a 6-digit security code to ${email}`}
            </p>
          </div>

          {/* Live Lockout Alert */}
          {lockoutSeconds > 0 && (
            <div className="p-3.5 rounded-lg bg-[#2A1517] border border-[#EF4444]/40 text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed flex-1">
                <div className="font-semibold text-white flex items-center justify-between">
                  <span>Verification Locked</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#EF4444]">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span className="text-sm font-bold">{lockoutSeconds}s</span>
                  </span>
                </div>
                <div className="text-[#FCA5A5]">
                  Too many incorrect attempts. Lockout automatically resets in{' '}
                  <strong className="font-mono text-white">{lockoutSeconds}s</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Standard Feedback Messages */}
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

          {/* ───────────────── STEP 1: Registration Form ───────────────── */}
          {step === 1 && (
            <form onSubmit={handleRegister} className="space-y-4 pt-1">
              
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Katherine Vance"
                    className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                  Work Email Address
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    Organization / Company
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5" />
                    <input 
                      type="text" 
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Rio Tinto / Barrick"
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white placeholder-[#606F7B] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12.5px] font-medium text-[#C2CCD6]">
                    Exploration Specialty
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-[#606F7B] absolute left-3.5 top-3.5 pointer-events-none" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 bg-[#0B0F12] border border-[#1E2735] focus:border-[#B7E89F] rounded-lg text-sm text-white focus:outline-none transition-colors cursor-pointer appearance-none"
                    >
                      <option value="exploration_geologist">Exploration Geologist</option>
                      <option value="chief_geophysicist">Chief Geophysicist</option>
                      <option value="resource_geologist">Resource Geologist</option>
                      <option value="gis_analyst">GIS &amp; Remote Sensing Analyst</option>
                      <option value="mining_executive">Mining Executive / Director</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-[#B7E89F] hover:bg-[#C8FFB2] text-[#0B0F12] font-semibold text-[13.5px] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
              >
                <span>{loading ? 'Dispatching Verification Email...' : 'Continue to Email Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ───────────────── STEP 2: 6-Digit Code Entry ───────────────── */}
          {step === 2 && (
            <form onSubmit={handleVerify} className="space-y-6 pt-2">
              
              {/* Notice that code was sent to their email */}
              <div className="p-3.5 rounded-lg bg-[#0B0F12] border border-[#1E2735] flex items-center gap-3 text-xs text-[#CBD5E1]">
                <Mail className="w-4 h-4 text-[#B7E89F] flex-shrink-0" />
                <span>Verification code sent to <strong className="text-white">{email}</strong>. Check your inbox and spam.</span>
              </div>

              {/* 6 Auto-Advancing Digit Boxes */}
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

              {/* Rate Limit / Attempts Indicator */}
              <div className="text-center text-xs font-mono text-[#9EABB8] space-y-1">
                <div>Maximum 5 incorrect attempts before 60s security lockout</div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#606F7B]">
                  <Clock className="w-3.5 h-3.5 text-[#B7E89F]" />
                  <span>Code valid for 10 minutes</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
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
                      ? 'Verifying Code...' 
                      : lockoutSeconds > 0 
                        ? `Locked · Resets in ${lockoutSeconds}s` 
                        : 'Verify Code & Launch Workspace'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Resend button with active cooldown */}
                <div className="flex items-center justify-between pt-2 text-xs">
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
                      cooldown > 0 || loading || resending || lockoutSeconds > 0
                        ? 'text-[#606F7B] cursor-not-allowed' 
                        : 'text-[#B7E89F] hover:underline'
                    }`}
                  >
                    <RotateCcw className={`w-3 h-3 ${cooldown > 0 || loading || resending || lockoutSeconds > 0 ? '' : 'text-[#B7E89F]'} ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Dispatching New Code...' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code via Email'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

          {/* Switch to Login */}
          <div className="text-center text-[13px] text-[#9EABB8] pt-2 border-t border-[#1E2735]">
            Already have an active account?{' '}
            <Link href="/login" className="text-[#B7E89F] hover:underline font-medium">
              Sign in
            </Link>
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
