'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkspaceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#13140e] flex items-center justify-center font-mono text-[#84837b] text-sm">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ebfc72] animate-ping" />
        <span>INITIALIZING GEOMINER TERMINAL WORKSPACE...</span>
      </div>
    </div>
  );
}
