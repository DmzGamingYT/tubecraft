/**
 * Connexion Google réelle via Google Identity Services (GSI).
 *
 * Le projet expose la variable d'environnement `VITE_GOOGLE_CLIENT_ID`
 * (voir .env.example) : créez un ID client OAuth type « Application Web »
 * sur console.cloud.google.com (API & Services → Identifiants) et ajoutez
 * http://localhost:5173 aux origines JavaScript autorisées.
 *
 * Sans client_id, l'application reste en mode démonstration (comptes locaux).
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID;
export const hasGoogleClientId = Boolean(GOOGLE_CLIENT_ID);

/** Données décodées du jeton d'identité renvoyé par Google. */
export interface GooglePayload {
  name?: string;
  email?: string;
  picture?: string;
}

interface GsiCredentialResponse {
  credential: string;
}

interface GsiClient {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: GsiCredentialResponse) => void;
        auto_select?: boolean;
        use_fedcm_for_prompt?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'small' | 'medium' | 'large';
          shape?: 'rectangular' | 'pill' | 'circle' | 'square';
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
          width?: number;
          locale?: string;
        }
      ): void;
      prompt(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GsiClient;
  }
}

let loadPromise: Promise<void> | null = null;
let gsiInitialized = false;
let credentialHandler: ((payload: GooglePayload) => void) | null = null;

/** Charge le script officiel GSI une seule fois. */
export function loadGoogleScript(): Promise<void> {
  if (!hasGoogleClientId) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID manquant'));
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossible de charger Google Identity Services'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

function decodeJwtPayload(token: string): GooglePayload {
  const part = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
  if (!part) return {};
  try {
    const base64 = decodeURIComponent(
      atob(part)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    return JSON.parse(base64);
  } catch {
    return {};
  }
}

/** Initialise GSI et dessine le bouton « Se connecter avec Google » officiel. */
export function renderGoogleButton(
  container: HTMLElement,
  onCredential: (payload: GooglePayload) => void
): Promise<void> {
  credentialHandler = onCredential;
  return loadGoogleScript().then(() => {
    const gsi = window.google;
    if (!gsi) throw new Error();
    if (!gsiInitialized) {
      gsi.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID as string,
        callback: (response) => credentialHandler?.(decodeJwtPayload(response.credential)),
      });
      gsiInitialized = true;
    }
    gsi.accounts.id.renderButton(container, {
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      locale: 'fr',
      width: 320,
    });
  });
}
