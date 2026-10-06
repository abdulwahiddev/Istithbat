'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** While a pipeline is running, re-read the server view every few seconds (no client-side state is invented). */
export function AutoRefresh({ active, everyMs = 5000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
