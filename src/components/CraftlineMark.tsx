/**
 * Marque de la collection Craftline.
 *
 * Un C ouvert (la ligne Craft) et un triangle de lecture (les apps) sur une
 * tuile rouge. Le dessin reste lisible à 16 px, sans dégradé ni détail fin.
 */
export function CraftlineMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="#e5402a" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="14.25"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.16"
        strokeWidth="1.5"
      />
      <path
        d="M45 19.5A18 18 0 1 0 45 44.5"
        fill="none"
        stroke="#fff8f1"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path d="M34.5 23.5 49 32 34.5 40.5Z" fill="#240607" />
    </svg>
  );
}
