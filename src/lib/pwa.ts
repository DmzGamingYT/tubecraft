import { useCallback, useEffect, useState } from 'react';

/**
 * Installation de la web app (PWA).
 *
 * Chrome / Edge / Samsung Internet déclenchent `beforeinstallprompt` très tôt,
 * parfois avant que la page « Télécharger » ne soit montée. On capture donc
 * l’événement au démarrage de l’app, puis on le rejoue quand l’utilisateur
 * clique sur « Installer ». Sur iOS, aucun prompt n’existe : la page affiche
 * les étapes du menu Partager.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedDuringSession = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((listener) => listener());
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** À appeler une fois au démarrage (avant le rendu React). */
export function initPwa() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedDuringSession = true;
    notify();
  });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => {
          /* pas de SW : l’app reste utilisable en ligne */
        });
    });
  }
}

export function useInstallPrompt() {
  const [state, setState] = useState(() => ({
    available: Boolean(deferredPrompt),
    installed: installedDuringSession || isStandalone(),
  }));

  useEffect(() => {
    const update = () =>
      setState({
        available: Boolean(deferredPrompt),
        installed: installedDuringSession || isStandalone(),
      });
    subscribers.add(update);
    update();
    return () => {
      subscribers.delete(update);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    const event = deferredPrompt;
    deferredPrompt = null;
    notify();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        installedDuringSession = true;
        notify();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, []);

  return { ...state, promptInstall };
}
