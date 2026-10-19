import { useState } from 'react';

interface Props {
  videoId: string;
  isShort?: boolean;
  alt?: string;
  /** largeur d'affichage attendue, pour que le navigateur choisisse la bonne source */
  sizes?: string;
}

/** Estimation par défaut : 1 colonne sur téléphone, ~2 sur tablette, 320 px ensuite. */
const DEFAULT_SIZES = '(max-width: 560px) 100vw, (max-width: 1024px) 48vw, 320px';

/**
 * Vignette vidéo avec chaîne de repli :
 *   Shorts -> frame0.jpg (portrait), sinon hq720, puis hqdefault, puis mqdefault.
 *
 * La première source est proposée en `srcset` : un écran classique (densité 1)
 * télécharge la vignette 320 px au lieu de la 1280 px, ce qui allège
 * sensiblement une grille de 24 cartes, sans perte visible.
 */
export function Thumb({ videoId, isShort, alt = '', sizes }: Props) {
  const [step, setStep] = useState(0);
  const base = `https://i.ytimg.com/vi/${videoId}`;

  const chain = isShort
    ? [`${base}/frame0.jpg`, `${base}/hqdefault.jpg`]
    : [`${base}/hq720.jpg`, `${base}/hqdefault.jpg`, `${base}/mqdefault.jpg`];

  if (step >= chain.length) return <div className="thumb thumb--empty" />;

  const srcset =
    !isShort && step === 0
      ? `${base}/mqdefault.jpg 320w, ${base}/hq720.jpg 1280w`
      : undefined;

  return (
    <img
      src={chain[step]}
      srcSet={srcset}
      sizes={srcset ? sizes ?? DEFAULT_SIZES : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setStep((s) => s + 1)}
    />
  );
}
