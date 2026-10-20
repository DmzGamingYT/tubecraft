import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Visite guidée de la vitrine.
 *
 * La visite fait défiler la page jusqu’à chaque étape, met le reste en retrait
 * (spotlight), puis pilote les démos via l’événement `showcase:scene`. La démo
 * Séquence reçoit ainsi ses trois scènes : recherche, lecture, mini-lecteur.
 * Sans `prefers-reduced-motion`, les étapes avancent seules ; sinon (ou après
 * une pause), l’utilisateur garde la main.
 */

export interface TourStep {
  /** sélecteur CSS de la cible à éclairer */
  target: string;
  title: string;
  text: string;
  /** scène à déclencher dans une démo */
  demo?: { app: 'tubecraft' | 'spotifycraft' | 'pulsecraft'; scene?: string; hold?: boolean };
  /** durée d’avance automatique, en ms */
  duration?: number;
}

interface Props {
  steps: TourStep[];
  onClose: () => void;
}

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GuidedTour({ steps, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  // incrémenté à chaque reprise : la barre de progression repart de zéro
  const [runId, setRunId] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const go = (next: number) => {
    if (next < 0) return;
    if (next >= steps.length) {
      onClose();
      return;
    }
    setIndex(next);
  };

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // défilement + mesure de la cible (le spotlight suit le scroll)
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(step.target);
    target?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    if (step.demo) {
      window.dispatchEvent(new CustomEvent('showcase:scene', { detail: step.demo }));
    }

    let frame = 0;
    let polling = 0;
    const update = () => {
      const element = document.querySelector<HTMLElement>(step.target);
      if (!element) {
        setSpot(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const maxBottom = window.innerHeight - (window.innerWidth < 760 ? 250 : 190);
      const top = Math.max(10, rect.top);
      const bottom = Math.min(rect.bottom, Math.max(top + 70, maxBottom));
      setSpot({
        top,
        left: Math.max(10, rect.left),
        width: Math.max(80, Math.min(window.innerWidth - 20, rect.width)),
        height: Math.max(70, bottom - top),
      });
    };

    const loop = () => {
      update();
      frame = window.requestAnimationFrame(loop);
      if (performance.now() > started + 900) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const started = performance.now();
    update();
    frame = window.requestAnimationFrame(loop);
    // filet de sécurité pour les navigateurs qui n’émettent pas de scroll
    polling = window.setTimeout(update, 950);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(polling);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [index, step]);

  // avance automatique
  useEffect(() => {
    if (!playing) return;
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => {
      if (last) onClose();
      else setIndex((current) => current + 1);
    }, step.duration ?? 5400);
    return () => window.clearTimeout(timer);
  }, [index, playing, last, onClose, step.duration]);

  // Échap, flèches, espace
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const interactive =
        target?.tagName === 'BUTTON' ||
        target?.tagName === 'A' ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA';

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (last) onClose();
        else setIndex((current) => current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === ' ' && !interactive) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  // à la fermeture : la boucle normale des démos reprend
  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent('showcase:scene', {
          detail: { app: 'tubecraft', scene: 'search', hold: false },
        })
      );
    };
  }, []);

  return (
    <div className="sc-tour" role="dialog" aria-label="Visite guidée de la vitrine">
      {spot ? (
        <span
          className="sc-tour__spot"
          aria-hidden
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      ) : (
        <span className="sc-tour__veil" aria-hidden />
      )}

      <div
        className="sc-tour__card"
        ref={cardRef}
        tabIndex={-1}
        style={{ '--tour-duration': `${step.duration ?? 5400}ms` } as CSSProperties}
      >
        <div className="sc-tour__progress" aria-hidden>
          <i
            key={`${index}-${runId}`}
            style={{ animationPlayState: playing ? 'running' : 'paused' }}
          />
        </div>

        <div className="sc-tour__top">
          <span className="sc-tour__badge">
            <i aria-hidden /> Visite guidée
          </span>
          <span className="sc-tour__count">
            {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </span>
          <button ref={closeRef} type="button" className="sc-tour__close" onClick={onClose}>
            Quitter <span aria-hidden>×</span>
          </button>
        </div>

        <div className="sc-tour__body">
          <div className="sc-tour__copy">
            <p className="sc-tour__eyebrow">Étape {index + 1}</p>
            <h2 className="sc-tour__title">{step.title}</h2>
            <p className="sc-tour__text">{step.text}</p>
          </div>

          <div className="sc-tour__controls">
            <button
              type="button"
              className="sc-tour__arrow"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Étape précédente"
            >
              ←
            </button>
            <button
              type="button"
              className="sc-tour__play"
              onClick={() => {
                setPlaying((value) => {
                  if (!value) setRunId((id) => id + 1);
                  return !value;
                });
              }}
              aria-pressed={playing}
            >
              {playing ? '❚❚' : '▶'} {playing ? 'Pause' : 'Reprendre'}
            </button>
            <button
              type="button"
              className="sc-tour__next"
              onClick={() => (last ? onClose() : go(index + 1))}
            >
              {last ? 'Terminer' : 'Suivant'} <span aria-hidden>→</span>
            </button>
          </div>
        </div>

        <ol className="sc-tour__dots" aria-label="Étapes de la visite">
          {steps.map((item, itemIndex) => (
            <li key={item.title}>
              <button
                type="button"
                className={itemIndex === index ? 'is-on' : itemIndex < index ? 'is-past' : ''}
                onClick={() => go(itemIndex)}
                aria-label={`Étape ${itemIndex + 1} : ${item.title}`}
                aria-current={itemIndex === index ? 'step' : undefined}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
