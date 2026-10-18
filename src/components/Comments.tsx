import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import type { Comment } from '../types';
import { timeAgo } from '../lib/format';
import { fetchComments, type LiveComment } from '../api/youtube';
import { Avatar } from './Avatar';
import { IconLike, IconTrash } from './icons';

interface Props {
  videoId: string;
}

/** Référence stable : `?? []` dans un sélecteur zustand provoquerait une boucle de rendu. */
const NO_COMMENTS: Comment[] = [];

/** Section commentaires : commentaires RÉELS YouTube (paginés) + vos commentaires locaux. */
export function Comments({ videoId }: Props) {
  const stored = useStore((s) => s.comments[videoId]);
  const localComments = stored ?? NO_COMMENTS;
  const addComment = useStore((s) => s.addComment);
  const likeComment = useStore((s) => s.likeComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const user = useStore((s) => s.user);

  const [live, setLive] = useState<LiveComment[]>([]);
  const [liveCount, setLiveCount] = useState('');
  const [continuation, setContinuation] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sort, setSort] = useState<'top' | 'newest'>('top');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setLive([]);
    setContinuation(null);
    setLiveCount('');

    fetchComments({ videoId }, controller.signal)
      .then((page) => {
        setLive(page.comments ?? []);
        setLiveCount(typeof page.count === 'string' ? page.count : '');
        setContinuation(page.continuation ?? null);
        setStatus('ok');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLive([]);
        setStatus('error');
      });

    return () => controller.abort();
  }, [videoId]);

  const loadMore = async () => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchComments({ continuation });
      setLive((current) => {
        const seen = new Set(current.map((c) => c.id));
        return [...current, ...page.comments.filter((c) => !seen.has(c.id))];
      });
      setContinuation(page.continuation ?? null);
    } catch {
      /* on garde la page déjà chargée */
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    addComment(videoId, text, replyTo ?? undefined);
    setDraft('');
    setReplyTo(null);
  };

  const total = localComments.length + live.length;
  const displayCount = liveCount || (total > 0 ? String(total) : '');

  return (
    <section className="comments">
      <h2 className="comments__count">
        {displayCount ? `${displayCount} commentaires` : 'Commentaires'}
        {status === 'error' && <span className="comments__offline"> · hors connexion</span>}
      </h2>
      {total > 0 && (
        <div className="comments__sort">
          <button
            className={`comment__action${sort === 'top' ? ' comment__action--on' : ''}`}
            onClick={() => setSort('top')}
          >
            Populaires
          </button>
          <button
            className={`comment__action${sort === 'newest' ? ' comment__action--on' : ''}`}
            onClick={() => setSort('newest')}
          >
            Plus récents
          </button>
        </div>
      )}

      <form className="comments__composer" onSubmit={submit}>
        <Avatar name={user?.name ?? 'Vous'} src={user?.photo} size={40} />
        <div className="comments__composer-body">
          <input
            className="comments__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={replyTo ? 'Ajouter une réponse…' : 'Ajouter un commentaire…'}
            aria-label="Ajouter un commentaire"
          />
          {draft.trim() && (
            <div className="comments__composer-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setDraft('')}>
                Annuler
              </button>
              <button type="submit" className="btn btn--primary">
                Commenter
              </button>
            </div>
          )}
        </div>
      </form>

      <ul className="comments__list">
        {(sort === 'top'
          ? [...localComments].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)
          : [...localComments].sort((a, b) => b.createdAt - a.createdAt)
        )
          .filter((c) => !c.parentId)
          .map((c) => (
            <li key={c.id} className="comment comment--local">
              <Avatar name={user?.name ?? c.author} src={user?.photo} size={40} />
              <div className="comment__body">
                <div className="comment__head">
                  <span className="comment__author">{c.author}</span>
                  <span className="comment__time">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="comment__text">{c.text}</p>
                <div className="comment__actions">
                  <button className="comment__action" onClick={() => likeComment(videoId, c.id)}>
                    <IconLike width={16} height={16} /> {c.likes > 0 ? c.likes : ''}
                  </button>
                  <button className="comment__action" onClick={() => deleteComment(videoId, c.id)}>
                    <IconTrash width={16} height={16} /> Supprimer
                  </button>
                  <button className="comment__action" onClick={() => setReplyTo(c.id)}>
                    Répondre
                  </button>
                </div>
              </div>
              {localComments.filter((r) => r.parentId === c.id).length > 0 && (
                <ul className="comment__replies">
                  {localComments
                    .filter((r) => r.parentId === c.id)
                    .map((r) => (
                      <li key={r.id} className="comment comment--local comment--reply">
                        <Avatar name={user?.name ?? r.author} src={user?.photo} size={32} />
                        <div className="comment__body">
                          <div className="comment__head">
                            <span className="comment__author">{r.author}</span>
                            <span className="comment__time">{timeAgo(r.createdAt)}</span>
                          </div>
                          <p className="comment__text">{r.text}</p>
                          <div className="comment__actions">
                            <button
                              className="comment__action"
                              onClick={() => likeComment(videoId, r.id)}
                            >
                              <IconLike width={16} height={16} /> {r.likes > 0 ? r.likes : ''}
                            </button>
                            <button
                              className="comment__action"
                              onClick={() => deleteComment(videoId, r.id)}
                            >
                              <IconTrash width={16} height={16} /> Supprimer
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}

        {status === 'loading' &&
          [0, 1, 2].map((i) => (
            <li key={i} className="comment comment--skeleton">
              <span className="skeleton skeleton--avatar" />
              <div className="comment__body">
                <span className="skeleton skeleton--line" style={{ width: '30%' }} />
                <span className="skeleton skeleton--line" style={{ width: '85%' }} />
              </div>
            </li>
          ))}

        {live.map((c) => (
          <li key={c.id} className="comment">
            {c.channelId ? (
              <Link to={`/channel/${encodeURIComponent(c.channelId)}`} className="comment__avatar-link">
                <Avatar name={c.author} src={c.avatar} size={40} />
              </Link>
            ) : (
              <Avatar name={c.author} src={c.avatar} size={40} />
            )}
            <div className="comment__body">
              <div className="comment__head">
                <span className="comment__author">{c.author}</span>
                <span className="comment__time">{c.publishedAt}</span>
              </div>
              <p className="comment__text">{c.text}</p>
              <div className="comment__actions">
                <span className="comment__action">
                  <IconLike width={16} height={16} /> {c.likes}
                </span>
                {c.replies && <span className="comment__action">{c.replies} réponses</span>}
              </div>
            </div>
          </li>
        ))}

        {status === 'ok' && live.length === 0 && localComments.length === 0 && (
          <li className="comments__empty">
            Aucun commentaire pour l’instant. Soyez le premier à réagir.
          </li>
        )}
      </ul>

      {status === 'ok' && continuation && (
        <button className="btn btn--ghost comments__more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Chargement…' : 'Charger plus de commentaires'}
        </button>
      )}
    </section>
  );
}
