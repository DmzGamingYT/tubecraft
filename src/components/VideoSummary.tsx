import { useCallback, useEffect, useRef, useState } from 'react';
import type { Video } from '../types';
import { formatDuration } from '../lib/format';
import {
  autoSummary,
  generateSummary,
  summaryInput,
  type VideoSummary,
} from '../lib/videoSummary';
import { IconSparkle } from './icons';

interface Props {
  video: Video;
  /** déplace le lecteur au chapitre choisi */
  onSeek: (seconds: number) => void;
}

/**
 * Résumé de la vidéo et chapitres cliquables. L'IA travaille à partir de la
 * description et des métadonnées ; si elle est indisponible, on affiche un
 * résumé automatique et les chapitres horodatés par la chaîne, sans rien
 * inventer.
 */
export function VideoSummaryCard({ video, onSeek }: Props) {
  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(
    (force: boolean) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      const controller = new AbortController();
      setLoading(true);

      generateSummary(summaryInput(video), { signal: controller.signal, force })
        .then((result) => {
          if (request !== requestRef.current) return;
          setSummary(result);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted || request !== requestRef.current) return;
          setSummary(autoSummary(summaryInput(video)));
          setLoading(false);
        });

      return controller;
    },
    [video]
  );

  useEffect(() => {
    let controller: AbortController | null = null;
    // petit délai : laisse arriver les métadonnées complètes du proxy avant
    // de figer un résumé (évite un appel IA sur la description tronquée du
    // catalogue et le double appel au premier chargement)
    const timer = window.setTimeout(() => {
      controller = load(false);
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [load]);

  const regenerate = () => {
    load(true);
  };

  const sourceLabel = summary?.source === 'ai' ? 'IA' : 'Automatique';

  return (
    <section className="aisummary" aria-labelledby="aisummary-title">
      <header className="aisummary__head">
        <h2 className="aisummary__title" id="aisummary-title">
          <IconSparkle width={18} height={18} /> Résumé IA
        </h2>
        {summary && !loading && (
          <span className={`aisummary__badge aisummary__badge--${summary.source}`}>
            {sourceLabel}
          </span>
        )}
        <button
          type="button"
          className="aisummary__regen"
          onClick={regenerate}
          disabled={loading}
          title="Relancer la génération à partir de la description et des métadonnées"
        >
          {loading ? 'Génération…' : 'Régénérer'}
        </button>
      </header>

      {loading && !summary ? (
        <div className="aisummary__skeleton" aria-label="Génération du résumé">
          <span className="skeleton skeleton--line" style={{ width: '94%' }} />
          <span className="skeleton skeleton--line" style={{ width: '86%' }} />
          <span className="skeleton skeleton--line" style={{ width: '58%' }} />
        </div>
      ) : (
        summary && (
          <>
            <p className="aisummary__text">{summary.summary}</p>

            {summary.chapters.length > 0 ? (
              <ol className="aisummary__chapters">
                {summary.chapters.map((chapter) => (
                  <li key={`${chapter.sec}-${chapter.title}`}>
                    <button type="button" onClick={() => onSeek(chapter.sec)}>
                      <span className="aisummary__time">{formatDuration(chapter.sec)}</span>
                      <span>{chapter.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="aisummary__hint">
                Aucun horodatage exploitable dans la description : les chapitres apparaîtront dès
                que la chaîne en publiera, ou via l’IA.
              </p>
            )}

            <p className="aisummary__note">
              {summary.source === 'ai'
                ? 'Généré par IA à partir de la description et des métadonnées — peut contenir des erreurs.'
                : 'IA indisponible : résumé automatique construit uniquement à partir de la description et des métadonnées.'}
              {loading && ' Nouvelle génération en cours…'}
            </p>
          </>
        )
      )}
    </section>
  );
}
