import type { CSSProperties } from 'react';
import { proposalStatusLabel, type FeatureProposal } from '../../data/proposals';

/**
 * Aperçus animés des propositions : une petite interface qui boucle, comme un
 * extrait de démo. Le visuel change quand on survole ou sélectionne une idée.
 */
export function IdeaPreview({
  proposal,
  variant = 'side',
}: {
  proposal: FeatureProposal;
  /** « side » sur ordinateur, « inline » dans la liste sur mobile. */
  variant?: 'side' | 'inline';
}) {
  return (
    <aside className={`sc-ideaPreview sc-ideaPreview--${variant}`} aria-live="polite">
      <div className="sc-ideaPreview__head">
        <span>Aperçu de la proposition</span>
        <span className="sc-ideaPreview__loop">
          <i aria-hidden /> démo
        </span>
      </div>

      <div className="sc-ideaPreview__screen" key={proposal.id}>
        {proposal.id === 'command-palette' && <CommandPalette />}
        {proposal.id === 'audio-mode' && <AudioMode />}
        {proposal.id === 'encrypted-portability' && <EncryptedVault />}
        {proposal.id === 'local-watch-party' && <WatchParty />}
        {proposal.id === 'import-subscriptions' && <ImportSubscriptions />}
        {proposal.id === 'local-yearly-recap' && <YearlyRecap />}
      </div>

      <div className="sc-ideaPreview__foot">
        <strong>{proposal.title}</strong>
        <span>{proposalStatusLabel[proposal.status]}</span>
      </div>
    </aside>
  );
}

function CommandPalette() {
  return (
    <div className="ip ip--cmd" aria-hidden>
      <div className="ip-cmd">
        <div className="ip-cmd__search">
          <span>⌘K</span>
          <b>regarder spring</b>
          <i className="ip-caret" />
        </div>
        <ul className="ip-cmd__list">
          <li className="ip-cmd__item ip-cmd__item--1">
            <span className="ip-cmd__icon">▶</span>
            <span>
              <b>Spring — Blender Open Movie</b>
              <em>Vidéo · 7:44</em>
            </span>
            <i>↵</i>
          </li>
          <li className="ip-cmd__item ip-cmd__item--2">
            <span className="ip-cmd__icon">▤</span>
            <span>
              <b>Reprendre « Spring »</b>
              <em>Historique · 02:18</em>
            </span>
          </li>
          <li className="ip-cmd__item ip-cmd__item--3">
            <span className="ip-cmd__icon">☾</span>
            <span>
              <b>Passer en thème sombre</b>
              <em>Apparence</em>
            </span>
          </li>
          <li className="ip-cmd__item ip-cmd__item--4">
            <span className="ip-cmd__icon">⚙</span>
            <span>
              <b>Paramètres de lecture</b>
              <em>Réglages</em>
            </span>
          </li>
        </ul>
        <div className="ip-cmd__foot">
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>esc fermer</span>
        </div>
      </div>
    </div>
  );
}

function AudioMode() {
  return (
    <div className="ip ip--audio" aria-hidden>
      <div className="ip-audio__poster">
        <span className="ip-audio__pill">Mode écoute</span>
        <span className="ip-audio__off">Image coupée</span>
        <span className="ip-audio__posterMeta">
          <b>Spring</b>
          <em>Blender Open Movie · chapitre 2/8</em>
        </span>
      </div>
      <div className="ip-audio__panel">
        <span className="ip-kicker">En lecture · audio seul</span>
        <strong>Spring — Blender Open Movie</strong>
        <em>Blender Studio · il y a 4 min</em>

        <div className="ip-wave">
          {Array.from({ length: 32 }).map((_, index) => (
            <i key={index} style={{ '--i': index } as CSSProperties} />
          ))}
        </div>

        <div className="ip-audio__time">
          <span>02:18</span>
          <span>07:44</span>
        </div>

        <div className="ip-audio__controls">
          <span>⏮</span>
          <span className="ip-audio__play">▶</span>
          <span>⏭</span>
          <em>1,5×</em>
        </div>

        <div className="ip-audio__row">
          <span className="ip-switch is-on">
            <i />
          </span>
          <span>Audio seul · 0 Mo de vidéo</span>
          <b>-82 % de données</b>
        </div>
      </div>
    </div>
  );
}

function EncryptedVault() {
  return (
    <div className="ip ip--vault" aria-hidden>
      <span className="ip-kicker">Export chiffré</span>

      <div className="ip-file">
        <span className="ip-lock">
          <i />
        </span>
        <span className="ip-file__text">
          <strong>tubecraft-2026.age</strong>
          <em>progression · playlists · abonnements</em>
        </span>
        <span className="ip-file__size">428 ko</span>
      </div>

      <div className="ip-progress">
        <i />
      </div>

      <ul className="ip-vault__items">
        {[
          ['Progression', '1 284 vidéos'],
          ['Playlists', '12 listes'],
          ['Abonnements', '128 chaînes'],
        ].map(([label, count], index) => (
          <li key={label} style={{ '--i': index } as CSSProperties}>
            <span>{label}</span>
            <em>{count}</em>
            <b>✓</b>
          </li>
        ))}
      </ul>

      <div className="ip-vault__pass">
        <span>Phrase secrète</span>
        <b>••••••••••••</b>
        <i>afficher</i>
      </div>

      <div className="ip-vault__status">
        <span>Chiffré en local · AES-256</span>
        <span className="ip-vault__check">✓</span>
      </div>
      <div className="ip-vault__hint">Aucun serveur · phrase secrète jamais transmise</div>
    </div>
  );
}

function WatchParty() {
  return (
    <div className="ip ip--party" aria-hidden>
      <div className="ip-party__screens">
        <div className="ip-party__screen">
          <span className="ip-party__windowBar">onglet 1 · écran</span>
          <span className="ip-party__thumb" />
          <span className="ip-party__play">❚❚</span>
          <span className="ip-party__bar">
            <i />
          </span>
        </div>
        <span className="ip-party__pulse">
          <i />
        </span>
        <div className="ip-party__screen">
          <span className="ip-party__windowBar">onglet 2 · projecteur</span>
          <span className="ip-party__thumb" />
          <span className="ip-party__play">❚❚</span>
          <span className="ip-party__bar">
            <i />
          </span>
        </div>
      </div>
      <div className="ip-party__status">
        <span className="ip-party__dot" />
        Lecture synchronisée · 2 onglets
        <em>BroadcastChannel · 0 serveur</em>
      </div>
    </div>
  );
}

function ImportSubscriptions() {
  return (
    <div className="ip ip--import" aria-hidden>
      <div className="ip-import__bar">
        <span>abonnements.csv</span>
        <em>128 chaînes</em>
      </div>
      <ul className="ip-import__list">
        {[
          ['Blender Studio', '1,2 M'],
          ['Kurzgesagt', '22,7 M'],
          ['Fireship', '3,6 M'],
          ['Arte', '2,9 M'],
        ].map(([name, count], index) => (
          <li key={name} style={{ '--i': index } as CSSProperties}>
            <span className="ip-import__avatar" />
            <b>{name}</b>
            <em>{count} abonnés</em>
            <span className="ip-import__check">✓</span>
          </li>
        ))}
      </ul>
      <div className="ip-import__foot">
        <span className="ip-import__count">124 / 128 importés</span>
        <span className="ip-import__btn">Terminer</span>
      </div>
    </div>
  );
}

function YearlyRecap() {
  const bars = [38, 62, 44, 78, 56, 92, 70, 48, 84, 66, 58, 88];
  return (
    <div className="ip ip--recap" aria-hidden>
      <div className="ip-recap__head">
        <span className="ip-kicker">Votre année TubeCraft</span>
        <strong>128 h</strong>
        <em>de vidéos regardées en local</em>
      </div>
      <div className="ip-recap__chart">
        {bars.map((height, index) => (
          <i key={index} style={{ '--h': `${height}%`, '--i': index } as CSSProperties} />
        ))}
      </div>
      <div className="ip-recap__legend">
        <span>Jan</span>
        <span>Juin</span>
        <span>Déc.</span>
      </div>
      <div className="ip-recap__tags">
        <span>Animation</span>
        <span>Science</span>
        <span>Blender Studio</span>
      </div>
    </div>
  );
}
