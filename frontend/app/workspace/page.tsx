'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function WorkspaceRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/app');
      } else {
        router.replace('/login?redirect=/app');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#0B0F12] flex items-center justify-center font-mono text-[#9EABB8] text-sm">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#B7E89F] animate-ping" />
        <span>INITIALIZING GEOMINER TERMINAL WORKSPACE...</span>
      </div>
    </div>
  );
}
