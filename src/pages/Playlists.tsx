import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getVideo } from '../data';
import { useStore } from '../store';
import { Thumb } from '../components/Thumb';

/** Bibliothèque : playlists créées + accès à Regarder plus tard. */
export function Playlists() {
  const playlists = useStore((s) => s.playlists);
  const createPlaylist = useStore((s) => s.createPlaylist);
  const deletePlaylist = useStore((s) => s.deletePlaylist);
  const watchLaterCount = useStore((s) => s.watchLater.length);
  const [name, setName] = useState('');

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Playlists</h1>
      </header>

      <form
        className="createbar"
        onSubmit={(e) => {
          e.preventDefault();
          createPlaylist(name);
          setName('');
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Créer une playlist (nom)"
          aria-label="Nom de la nouvelle playlist"
        />
        <button className="btn btn--primary" type="submit">
          Créer
        </button>
      </form>

      <section className="grid">
        <Link to="/watch-later" className="playlistcard playlistcard--later">
          <div className="playlistcard__cover">
            <span className="playlistcard__glyph">🕒</span>
          </div>
          <h3>Regarder plus tard</h3>
          <p className="muted">{watchLaterCount} vidéo{watchLaterCount > 1 ? 's' : ''}</p>
        </Link>

        {playlists.map((playlist) => {
          const first = playlist.videoIds.map((id) => getVideo(id)).find(Boolean);
          return (
            <article key={playlist.id} className="playlistcard">
              <Link to={`/playlist/${playlist.id}`} className="playlistcard__cover">
                {first ? (
                  <Thumb videoId={first.id} isShort={first.isShort} />
                ) : (
                  <span className="playlistcard__glyph">♪</span>
                )}
              </Link>
              <h3>
                <Link to={`/playlist/${playlist.id}`}>{playlist.name}</Link>
              </h3>
              <p className="muted">
                {playlist.videoIds.length} vidéo{playlist.videoIds.length > 1 ? 's' : ''} ·{' '}
                <Link to={`/playlist/${playlist.id}`}>voir la playlist</Link>
              </p>
              <button className="btn btn--ghost" onClick={() => deletePlaylist(playlist.id)}>
                Supprimer
              </button>
            </article>
          );
        })}
      </section>

      {playlists.length === 0 && (
        <p className="empty">
          Aucune playlist. Créez-en une ci-dessus, ou utilisez « Enregistrer » sous une vidéo.
        </p>
      )}
    </div>
  );
}
