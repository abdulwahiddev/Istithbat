'use client';
import { useEffect } from 'react';

/**
 * Motion for everything below the (frozen) hero. No library: IntersectionObserver, timers, one
 * passive rAF scroll loop and CSS transitions.
 *
 *  · Scenes (`[data-seq]`) play a short narrative once when they enter view. Each step inside is an
 *    element with `data-t` (ms after entry) and an effect class (`fx-*`, see sections.css); the
 *    engine adds `.on` at its time. Quick transition → readable hold → next step.
 *  · Measured values (hashes, counts) are never animated through intermediate values: only their
 *    container's opacity/mask moves, so the string on screen is correct at every frame.
 *  · `[data-par]` elements drift with scroll (a few px), `--rise` lifts the evidence plane.
 *  · `[data-live]` is set on scenes that are on screen and visible, so continuous motion (serving
 *    packets, dependency signal) runs only while it can be seen.
 *  · The landing bar gets `data-scrolled` once the page leaves the top.
 *
 * The server renders every final state. Under prefers-reduced-motion nothing is armed and nothing
 * moves; the page is the complete static story. Scenes above the fold on load stay final.
 */
export function LandingMotion() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.lbar-shell');
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-seq]')];
    const live = [...document.querySelectorAll<HTMLElement>('[data-seq], .ls')];
    const par = [...document.querySelectorAll<HTMLElement>('[data-par]')];
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers: number[] = [];
    const vh = () => window.innerHeight;

    // sticky bar state (also under reduced motion: it is state, not motion)
    const onTop = () => bar?.toggleAttribute('data-scrolled', window.scrollY > 8);
    onTop();
    const menu = document.querySelector<HTMLDetailsElement>('.lmenu');
    const closeMenu = (e: Event) => {
      if (!menu?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.contains(e.target as Node)) { menu.open = false; if (e instanceof KeyboardEvent) menu.querySelector('summary')?.focus(); }
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', closeMenu);

    const play = (scene: HTMLElement) => {
      if (scene.dataset.seq !== 'armed') return;
      scene.dataset.seq = 'play';
      for (const el of scene.querySelectorAll<HTMLElement>('[data-t]')) {
        timers.push(window.setTimeout(() => {
          el.classList.add('on');
        }, Number(el.dataset.t) || 0));
      }
    };
    const enter = new IntersectionObserver(() => {
      // also plays scenes jumped past (anchors, fast scrolls): nothing is left armed above the fold
      for (const s of scenes) if (s.dataset.seq === 'armed' && s.getBoundingClientRect().top < vh() * 0.78) play(s);
    }, { threshold: [0, 0.2, 0.5] });

    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-live', e.isIntersecting && !document.hidden);
    });
    live.forEach((s) => seen.observe(s));
    const onVis = () => live.forEach((s) => { const r = s.getBoundingClientRect(); s.toggleAttribute('data-live', !document.hidden && r.bottom > 0 && r.top < vh()); });
    document.addEventListener('visibilitychange', onVis);

    let raf = 0;
    const frame = () => {
      raf = 0;
      onTop();
      if (mq.matches) return;
      const h = vh();
      for (const el of par) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > h + 200) continue;
        const k = Number(el.dataset.par) || 0;
        // -1 … 1 as the element crosses the viewport; 0 when its centre is at the centre
        const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - h / 2) / h));
        el.style.setProperty('--par', `${(p * k).toFixed(1)}px`);
        el.style.setProperty('--rise', Math.max(0, Math.min(1, 1 - (r.top - h * 0.35) / (h * 0.65))).toFixed(3));
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();

    const arm = () => {
      if (mq.matches) return;
      for (const s of scenes) {
        if (s.getBoundingClientRect().top < vh() * 0.9) continue; // already in view: leave final
        s.dataset.seq = 'armed';
        enter.observe(s);
      }
    };
    arm();
    const finish = () => {
      // switching to reduced motion mid-page: land every scene in its final state immediately
      if (!mq.matches) return;
      timers.forEach(clearTimeout);
      for (const s of scenes) {
        s.dataset.seq = 'done';
        s.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => el.classList.add('on'));
      }
      par.forEach((el) => { el.style.removeProperty('--par'); el.style.removeProperty('--rise'); });
    };
    mq.addEventListener('change', finish);

    return () => {
      timers.forEach(clearTimeout); enter.disconnect(); seen.disconnect(); cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onVis); mq.removeEventListener('change', finish);
      document.removeEventListener('click', closeMenu); document.removeEventListener('keydown', closeMenu);
    };
  }, []);
  return null;
}
