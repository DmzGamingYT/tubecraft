import type { CSSProperties } from 'react';
import { MIXES, TRACKS, YT_THUMBS } from './media';

/**
 * Scènes courtes de la galerie d'une app : accueil, recherche, Shorts,
 * mini-lecteur, lecture, file d'attente, égaliseur, import…
 *
 * Même principe que les grandes démos : des maquettes HTML/CSS animées, avec
 * les vraies vignettes YouTube et les vraies pochettes iTunes.
 */

const HOME_VIDEOS = [
  {
    thumb: YT_THUMBS.spring,
    title: 'Spring — Blender Open Movie',
    meta: 'Blender Studio · 10,9 M de vues',
    duration: '7:44',
  },
  {
    thumb: YT_THUMBS.sprite,
    title: 'Sprite Fright — Blender Open Movie',
    meta: 'Blender Studio · 9,4 M de vues',
    duration: '10:30',
  },
  {
    thumb: YT_THUMBS.charge,
    title: 'CHARGE — Blender Open Movie',
    meta: 'Blender Studio · 2,5 M de vues',
    duration: '4:23',
  },
  {
    thumb: YT_THUMBS.singularity,
    title: 'The Making of SINGULARITY',
    meta: 'Blender Studio · 55 k vues',
    duration: '16:59',
  },
];

export function TubeHomeScene() {
  return (
    <div className="gx gx--tchome" aria-hidden>
      <div className="gx__tbar">
        <span className="gx__brand">
          <b>▶</b> Séquence <i>FR</i>
        </span>
        <span className="gx__searchPill">Rechercher</span>
        <span className="gx__avatar" />
      </div>

      <div className="gx__chips">
        {['Toutes', 'Animation', 'Musique', 'Science', 'Jeux vidéo'].map((chip, index) => (
          <span key={chip} className={index === 0 ? 'is-on' : undefined}>
            {chip}
          </span>
        ))}
      </div>

      <div className="gx__vgrid">
        {HOME_VIDEOS.map((video, index) => (
          <div className={`gx__vcard${index === 0 ? ' is-live' : ''}`} key={video.title}>
            <span className="gx__vthumb">
              <img src={video.thumb} alt="" loading="lazy" decoding="async" />
              <i>{video.duration}</i>
              <b className="gx__vbar">
                <i />
              </b>
            </span>
            <strong>{video.title}</strong>
            <em>{video.meta}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TubeSearchScene() {
  return (
    <div className="gx gx--tcsearch" aria-hidden>
      <div className="gx__tbar">
        <span className="gx__brand">
          <b>▶</b> Séquence <i>FR</i>
        </span>
        <span className="gx__queryBar">
          <span className="gx__mag" />
          <b>blender spring</b>
          <i className="gx__caret" />
        </span>
        <span className="gx__avatar" />
      </div>

      <div className="gx__filterRow">
        <span className="gx__count">Environ 11 344 531 résultats</span>
        {['Toutes', 'Vidéos', 'Chaînes', 'Playlists'].map((filter, index) => (
          <span key={filter} className={index === 0 ? 'is-on' : undefined}>
            {filter}
          </span>
        ))}
      </div>

      <div className="gx__results">
        {HOME_VIDEOS.map((video) => (
          <div className="gx__result" key={video.title}>
            <span className="gx__rthumb">
              <img src={video.thumb} alt="" loading="lazy" decoding="async" />
              <i>{video.duration}</i>
            </span>
            <span className="gx__rtext">
              <b>{video.title}</b>
              <em>{video.meta}</em>
              <span>{video.meta.split(' · ')[0]} · il y a 2 ans</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TubeShortsScene() {
  return (
    <div className="gx gx--tcshorts" aria-hidden>
      <div className="gx__shortStage">
        <img src={YT_THUMBS.sprite} alt="" loading="lazy" decoding="async" />
        <span className="gx__shortShade" />
        <span className="gx__shortPlay">❚❚</span>
        <div className="gx__shortRail">
          <span>
            ♥<i>128 k</i>
          </span>
          <span>
            💬<i>2 140</i>
          </span>
          <span>
            ↗<i>Partager</i>
          </span>
        </div>
        <div className="gx__shortInfo">
          <b>@blenderstudio</b>
          <span>Dans les coulisses de Sprite Fright · épisode 2</span>
        </div>
        <span className="gx__shortProgress">
          <i />
        </span>
      </div>

      <div className="gx__shortSide">
        {[YT_THUMBS.spring, YT_THUMBS.charge, YT_THUMBS.singularity].map((thumb, index) => (
          <span className={`gx__shortThumb${index === 0 ? ' is-on' : ''}`} key={thumb}>
            <img src={thumb} alt="" loading="lazy" decoding="async" />
          </span>
        ))}
        <span className="gx__shortMore">Tout afficher</span>
      </div>
    </div>
  );
}

export function TubeMiniScene() {
  return (
    <div className="gx gx--tcmini" aria-hidden>
      <div className="gx__miniBg">
        {HOME_VIDEOS.map((video) => (
          <span className="gx__miniCard" key={video.title}>
            <img src={video.thumb} alt="" loading="lazy" decoding="async" />
            <b />
            <em />
          </span>
        ))}
      </div>

      <div className="gx__pip">
        <span className="gx__pipThumb">
          <img src={YT_THUMBS.spring} alt="" loading="lazy" decoding="async" />
        </span>
        <span className="gx__pipText">
          <b>Spring — Blender Open Movie</b>
          <em>mini-lecteur · continue hors de la page</em>
        </span>
        <span className="gx__pipBar">
          <i />
        </span>
        <span className="gx__pipBtn">❚❚</span>
      </div>

      <span className="gx__miniHint">Le lecteur reste visible sur toutes les pages</span>
    </div>
  );
}

export function MusicNowScene() {
  return (
    <div className="gx gx--spnow" aria-hidden>
      <span
        className="gx__nowBg"
        style={{ backgroundImage: `url(${TRACKS[0].cover})` } as CSSProperties}
      />
      <div className="gx__nowCover">
        <img src={TRACKS[0].cover} alt="" loading="lazy" decoding="async" />
        <span className="gx__nowBadge">♪ extrait 30 s</span>
      </div>

      <div className="gx__nowPanel">
        <span className="gx__eyebrow">En lecture · catalogue iTunes</span>
        <strong className="gx__nowTitle">{TRACKS[0].title}</strong>
        <em className="gx__nowArtist">{TRACKS[0].artist}</em>

        <div className="gx__lyrics">
          <span>Paroles synchronisées</span>
          <span className="is-past">••••••• ••••</span>
          <span className="is-on">•••• •••••• •••</span>
          <span>•••••• ••••</span>
        </div>

        <div className="gx__scrub">
          <i />
        </div>
        <div className="gx__times">
          <span>0:12</span>
          <span>0:30</span>
        </div>

        <div className="gx__transport">
          <span>⏮</span>
          <span className="gx__transportPlay">❚❚</span>
          <span>⏭</span>
          <b>♡</b>
        </div>
      </div>
    </div>
  );
}

export function MusicQueueScene() {
  return (
    <div className="gx gx--spqueue" aria-hidden>
      <div className="gx__qhead">
        <span className="gx__qart">
          <i style={{ backgroundImage: `url(${MIXES[1].covers[0]})` }} />
          <i style={{ backgroundImage: `url(${MIXES[1].covers[1]})` }} />
          <i style={{ backgroundImage: `url(${MIXES[1].covers[2]})` }} />
          <i style={{ backgroundImage: `url(${MIXES[1].covers[3]})` }} />
        </span>
        <span>
          <b>Mix Pop</b>
          <em>24 titres · 1 h 18 · calculé en local</em>
        </span>
        <b className="gx__qplay">▶</b>
      </div>

      <ul className="gx__qlist">
        {TRACKS.map((track, index) => (
          <li className={index === 0 ? 'is-on' : undefined} key={track.title}>
            <span className="gx__qnum">
              {index === 0 ? (
                <i className="gx__eq">
                  <b />
                  <b />
                  <b />
                </i>
              ) : (
                index + 1
              )}
            </span>
            <img src={track.cover} alt="" loading="lazy" decoding="async" />
            <span className="gx__qtext">
              <b>{track.title}</b>
              <em>{track.artist}</em>
            </span>
            <span className="gx__qtime">{track.duration}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MusicEqScene() {
  const bands = [32, 64, 125, 250, 500, 1, 2, 4, 8, 16];
  const heights = [42, 58, 36, 66, 49, 72, 54, 63, 45, 58];

  return (
    <div className="gx gx--speq" aria-hidden>
      <div className="gx__eqHead">
        <span>
          <b>Égaliseur</b>
          <em>10 bandes · Preset Studio</em>
        </span>
        <span className="gx__eqOn">Activé</span>
      </div>

      <div className="gx__bands">
        {bands.map((band, index) => (
          <span className="gx__band" key={band} style={{ '--i': index } as CSSProperties}>
            <i style={{ '--h': `${heights[index]}%` } as CSSProperties}>
              <b />
            </i>
            <em>{band < 1 ? `${band * 1000}` : `${band}k`}</em>
          </span>
        ))}
      </div>

      <div className="gx__presets">
        {['Studio', 'Basses', 'Voix', 'Live'].map((preset, index) => (
          <span className={index === 0 ? 'is-on' : undefined} key={preset}>
            {preset}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MusicImportScene() {
  return (
    <div className="gx gx--spimport" aria-hidden>
      <div className="gx__drop">
        <b>Glissez vos fichiers</b>
        <span>MP3 · FLAC · M4A — rien ne quitte le navigateur</span>
      </div>

      <ul className="gx__files">
        {[
          ['Daft Punk — Discovery', '14 titres', '100'],
          ['Angèle — Nonante-Cinq', '12 titres', '100'],
          ['Dua Lipa — Future Nostalgia', '11 titres', '62'],
          ['Aya Nakamura — Nakamura', '13 titres', '18'],
        ].map(([name, count, progress], index) => (
          <li key={name} style={{ '--i': index } as CSSProperties}>
            <span className="gx__fileIcon">♪</span>
            <span className="gx__fileText">
              <b>{name}</b>
              <em>{count}</em>
            </span>
            <span className="gx__fileBar">
              <i style={{ width: `${progress}%` }} />
            </span>
            <span className={progress === '100' ? 'gx__fileOk' : 'gx__fileWait'}>
              {progress === '100' ? '✓' : `${progress} %`}
            </span>
          </li>
        ))}
      </ul>

      <div className="gx__libFoot">
        <span>4 albums · 50 titres disponibles hors ligne</span>
        <b>Prêt</b>
      </div>
    </div>
  );
}
