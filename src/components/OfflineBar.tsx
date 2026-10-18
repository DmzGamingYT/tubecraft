/** Bandeau discret quand le navigateur n'a plus de réseau. */
export function OfflineBar({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="offlinebar" role="status" aria-live="polite">
      <span className="offlinebar__dot" aria-hidden />
      <span>
        <strong>Hors ligne.</strong> Les pages, vignettes et métadonnées déjà visitées restent
        disponibles. Vos likes, playlists et la file « Lire ensuite » sont enregistrés localement et
        seront intacts au retour du réseau.
      </span>
    </div>
  );
}
