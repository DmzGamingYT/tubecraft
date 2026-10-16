import { Link, useParams } from 'react-router-dom';
import { getVideo } from '../data';
import { useStore } from '../store';
import type { Video } from '../types';
import { VideoCard } from '../components/VideoCard';

/** Détail d'une playlist : lecture séquentielle, retrait, renommage. */
export function PlaylistDetail() {
  const { id } = useParams();
  const playlist = useStore((s) => s.playlists.find((p) => p.id === id));
  const removeFromPlaylist = useStore((s) => s.removeFromPlaylist);
  const renamePlaylist = useStore((s) => s.renamePlaylist);

  if (!playlist) {
    return (
      <div className="page">
        <p className="empty">
          Cette playlist n’existe pas (ou a été supprimée). <Link to="/playlists">Voir mes playlists</Link>
        </p>
      </div>
    );
  }

  const videos = playlist.videoIds.map((videoId) => getVideo(videoId)).filter((v): v is Video => Boolean(v));
  const first = videos[0];

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">{playlist.name}</h1>
          <p className="muted">
            {videos.length} vidéo{videos.length > 1 ? 's' : ''} ·{' '}
            {first ? <Link to={`/watch?v=${first.id}&list=${playlist.id}`}>Tout lire</Link> : 'playlist vide'}
          </p>
        </div>
        <button
          className="btn btn--ghost"
          onClick={() => {
            const name = window.prompt('Nouveau nom de la playlist', playlist.name);
            if (name) renamePlaylist(playlist.id, name);
          }}
        >
          Renommer
        </button>
      </header>

      <section className="grid">
        {videos.map((video, index) => (
          <div key={video.id} className="playlistitem">
            <span className="playlistitem__index">{index + 1}</span>
            <Link className="playlistitem__link" to={`/watch?v=${video.id}&list=${playlist.id}`}>
              <VideoCard video={video} />
            </Link>
            <button
              className="card__remove"
              onClick={() => removeFromPlaylist(playlist.id, video.id)}
              title="Retirer de la playlist"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {videos.length === 0 && <p className="empty">Playlist vide : ajoutez des vidéos via « Enregistrer ».</p>}
    </div>
  );
}
