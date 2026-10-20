import { useEffect, useRef } from 'react';
import { IconClose } from './icons';

interface Props {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

/** Seuls les raccourcis réellement câblés sont listés ici. */
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Lecture',
    items: [
      { keys: ['Espace', 'K'], label: 'Lecture / pause' },
      { keys: ['J', 'L'], label: 'Reculer / avancer de 10 s' },
      { keys: ['M'], label: 'Couper ou rétablir le son' },
      { keys: ['F'], label: 'Plein écran' },
      { keys: ['Échap'], label: 'Fermer la file d’attente, puis le mini-lecteur' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['/'], label: 'Aller à la recherche' },
      { keys: ['Ctrl', 'B'], label: 'Afficher ou masquer le menu' },
      { keys: ['?'], label: 'Afficher cette aide' },
    ],
  },
  {
    title: 'Shorts',
    items: [
      { keys: ['↓'], label: 'Short suivant' },
      { keys: ['↑'], label: 'Short précédent' },
    ],
  },
];

/**
 * Aide-mémoire des raccourcis (touche `?`).
 * Le focus reste enfermé dans la fenêtre tant qu'elle est ouverte, et
 * `Échap` la referme comme n'importe quelle surface modale.
 */
export function ShortcutsHelp({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // capture + stopPropagation : `Échap` ferme l'aide seule, sans
        // refermer aussi le mini-lecteur qui écoute la même touche.
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // piège de focus : la tabulation tourne à l'intérieur de la fenêtre
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="shortcuts"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="shortcuts__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="shortcuts__head">
          <h2 className="shortcuts__title" id="shortcuts-title">
            Raccourcis clavier
          </h2>
          <button className="shortcuts__close" onClick={onClose} aria-label="Fermer">
            <IconClose width={20} height={20} />
          </button>
        </div>
        <p className="shortcuts__note">
          Les touches de lecture agissent sur le lecteur Séquence ; quand le focus est dans la
          vidéo YouTube, ce sont les raccourcis de YouTube qui s’appliquent.
        </p>

        {GROUPS.map((group) => (
          <section className="shortcuts__group" key={group.title}>
            <h3>{group.title}</h3>
            <ul className="shortcuts__list">
              {group.items.map((item) => (
                <li key={item.label}>
                  <span className="shortcuts__label">{item.label}</span>
                  <span className="shortcuts__keys">
                    {item.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
