import { useEffect, useRef, useState } from 'react';

/**
 * Visuel de la section « Sous le capot ».
 *
 * Un schéma de flux animé (navigateur → proxy → InnerTube) et un journal de
 * requêtes qui défile : de quoi montrer l'architecture sans capture d'écran.
 */

const REQUESTS = [
  { method: 'GET', path: '/yt/api/search?q=blender', status: '200', time: '61 ms', note: '12 résultats · 3 chaînes' },
  { method: 'GET', path: '/yt/api/video?v=WhWc3b3KhnY', status: '200', time: '94 ms', note: 'métadonnées + dislikes' },
  { method: 'GET', path: '/yt/api/comments?v=WhWc3b3KhnY', status: '200', time: '128 ms', note: '20 commentaires · continuation' },
  { method: 'GET', path: '/yt/api/channel?id=UC…', status: '200', time: '77 ms', note: 'cache mémoire · 60 s' },
  { method: 'GET', path: '/yt/api/sponsorblock?v=…', status: '200', time: '203 ms', note: 'segments communautaires' },
];

export function UnderTheHood() {
  const [index, setIndex] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setLive(entries[0]?.isIntersecting ?? true),
      { rootMargin: '120px 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % REQUESTS.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [live]);

  return (
    <div className="sc-under" ref={hostRef}>
      <div className="sc-flow" aria-hidden>
        <div className="sc-flow__node">
          <span className="sc-flow__kind">Navigateur</span>
          <strong>TubeCraft</strong>
          <small>React · état local</small>
          <span className="sc-flow__chip">0 clé API</span>
        </div>

        <span className="sc-flow__link">
          <i />
          <em>same-origin</em>
        </span>

        <div className="sc-flow__node sc-flow__node--accent">
          <span className="sc-flow__kind">Proxy local</span>
          <strong>/yt/api</strong>
          <small>cache · timeout · quota</small>
          <span className="sc-flow__chip">aucun secret</span>
        </div>

        <span className="sc-flow__link sc-flow__link--slow">
          <i />
          <em>InnerTube</em>
        </span>

        <div className="sc-flow__node">
          <span className="sc-flow__kind">Côté YouTube</span>
          <strong>InnerTube</strong>
          <small>hl=fr · continuation</small>
          <span className="sc-flow__chip">données réelles</span>
        </div>
      </div>

      <div className="sc-terminal" aria-hidden>
        <div className="sc-terminal__head">
          <span className="sc-terminal__dots">
            <i />
            <i />
            <i />
          </span>
          <span>proxy /yt/api — journal</span>
          <span className="sc-terminal__live">
            <i /> live
          </span>
        </div>
        <div className="sc-terminal__body">
          {REQUESTS.map((request, requestIndex) => (
            <div
              className={`sc-terminal__line${
                requestIndex === index ? ' is-current' : requestIndex < index ? ' is-past' : ''
              }`}
              key={request.path}
            >
              <span className="sc-terminal__method">{request.method}</span>
              <span className="sc-terminal__path">{request.path}</span>
              <span className="sc-terminal__status">{request.status}</span>
              <span className="sc-terminal__time">{request.time}</span>
              <em>{request.note}</em>
            </div>
          ))}
          <div className="sc-terminal__prompt">
            <span>›</span>
            <i />
          </div>
        </div>
        <div className="sc-terminal__foot">
          <span>timeout 8 s</span>
          <span>cache 60 s</span>
          <span>Rate limit 60/min</span>
        </div>
      </div>
    </div>
  );
}
