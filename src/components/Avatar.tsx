import { useEffect, useState } from 'react';
import { initials } from '../lib/format';

interface Props {
  name: string;
  src?: string;
  size?: number;
}

/** Avatar rond : image YouTube si dispo, sinon monogramme coloré. */
export function Avatar({ name, src, size = 36 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        className="avatar"
        src={src}
        alt={name}
        loading="lazy"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="avatar avatar--fallback"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `linear-gradient(135deg, hsl(${hue} 62% 45%), hsl(${(hue + 48) % 360} 62% 35%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
