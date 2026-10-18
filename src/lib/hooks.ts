import { useEffect, useRef, useState } from 'react';

export function useIsMobile(breakpoint = 1023): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

/** Empêche le scroll de la page derrière une surface plein écran (Shorts). */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/** État réseau réactif (navigator.onLine + évènements online/offline). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}
