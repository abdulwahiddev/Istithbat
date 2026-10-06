'use client';
import { useEffect } from 'react';

/**
 * One-shot reveals for the sections below the hero. Sections render in their final state on the
 * server; only sections that are still below the fold when the page hydrates are set to `pending`
 * and play once as they enter view. Under reduced motion nothing is touched. Continuous motion
 * (the gateway's serving packets) runs only while its section is on screen and the tab is visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>('.ls')];
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches || !('IntersectionObserver' in window)) return;
    // A section jumped past (anchor links, fast scrolls) is revealed too, never left pending.
    const reveal = new IntersectionObserver(() => {
      for (const s of sections) {
        if (s.dataset.reveal !== 'pending' || s.getBoundingClientRect().top > window.innerHeight * 0.88) continue;
        s.dataset.reveal = 'in'; reveal.unobserve(s);
      }
    }, { threshold: [0, 0.12] });
    for (const s of sections) {
      if (s.getBoundingClientRect().top < window.innerHeight * 0.9) continue; // already visible: leave final
      s.dataset.reveal = 'pending';
      reveal.observe(s);
    }
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-live', e.isIntersecting && !document.hidden);
    });
    sections.forEach((s) => live.observe(s));
    const onVis = () => sections.forEach((s) => { const r = s.getBoundingClientRect(); s.toggleAttribute('data-live', !document.hidden && r.bottom > 0 && r.top < window.innerHeight); });
    document.addEventListener('visibilitychange', onVis);
    const onMq = () => { if (mq.matches) sections.forEach((s) => { s.dataset.reveal = 'in'; s.removeAttribute('data-live'); }); };
    mq.addEventListener('change', onMq);
    return () => { reveal.disconnect(); live.disconnect(); document.removeEventListener('visibilitychange', onVis); mq.removeEventListener('change', onMq); };
  }, []);
  return null;
}
