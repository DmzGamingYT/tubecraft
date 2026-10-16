import { useState } from 'react';

interface Props {
  videoId: string;
  isShort?: boolean;
  alt?: string;
}

/**
 * Vignette vidéo avec chaîne de repli :
 *   Shorts -> frame0.jpg (portrait), sinon hq720, puis hqdefault.
 */
export function Thumb({ videoId, isShort, alt = '' }: Props) {
  const chain = isShort
    ? [`https://i.ytimg.com/vi/${videoId}/frame0.jpg`, `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`]
    : [
        `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      ];
  const [step, setStep] = useState(0);

  if (step >= chain.length) return <div className="thumb thumb--empty" />;

  return (
    <img
      src={chain[step]}
      alt={alt}
      loading="lazy"
      onError={() => setStep((s) => s + 1)}
    />
  );
}
