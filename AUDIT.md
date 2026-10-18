# Audit TubeCraft — état des lieux et feuille de route

_Revue complète du projet, 17 octobre 2026. Ce document liste ce qui a été corrigé dans cette
passe, les risques restants et les fonctionnalités qui feraient passer TubeCraft au niveau
supérieur._

## 1. Synthèse

TubeCraft est déjà bien plus qu'une maquette : le catalogue est réel, la recherche interroge
YouTube en direct, le lecteur officiel fonctionne, les commentaires sont authentiques et
l'expérience (thème, Shorts, playlists, historique) tient debout. Le code est lisible, typé et
correctement découpé.

Les trois faiblesses structurelles étaient :

1. **La page de lecture était aveugle.** Une vidéo ouverte depuis une recherche n'avait ni
   description, ni vraies vues, ni vraies suggestions : tout venait d'un catalogue figé.
2. **L'API InnerTube était utilisée « au fil de l'eau ».** Aucun cache, aucun timeout, aucune
   pagination, aucune validation, et le proxy renvoyait `Access-Control-Allow-Origin: *`.
3. **Aucun filet de sécurité.** Zéro test, zéro CI, aucun lint, et des bugs de déploiement
   (base Vite ignorée pour les liens de partage et le routeur).

Ces trois points sont traités ci-dessous. Le reste du document décrit ce qui reste à faire.

## 2. Ce qui a été corrigé / ajouté dans cette passe

### Données et proxy (`server/ytProxy.ts`, `src/api/youtube.ts`)

- **Métadonnées réelles** pour la page de lecture : titre, vues exactes, description, tags,
  catégorie, durée, chaîne, avatar, abonnés — via `/yt/api/video` qui fusionne `player` + `next`.
- **Suggestions YouTube réelles** (20 par vidéo) au lieu du catalogue local, avec repli automatique.
- **Chaînes en direct** : en-tête réel (bannière, avatar, handle, abonnés, description, nombre de
  vidéos), onglets Vidéos/Shorts, pagination.
- **Recherche paginée** par continuation, avec tri (pertinence / vues), filtre vidéos et filtre de
  durée. Le parseur lit désormais la durée des nouveaux `lockupViewModel`, ce qui rend le filtre
  de durée réellement fonctionnel.
- **Commentaires paginés** (`Charger plus`). Correction importante : le jeton de continuation
  choisi était celui des réponses imbriquées, ce qui rechargeait la même page.
- **SponsorBlock** : saut automatique des sponsors/intros/outros, badge pendant 3,5 s, réglage
  persistant et coupure possible sous la vidéo.
- **Dislikes réels** via Return YouTube Dislike, en complément des likes.
- **Proxy durci** :
  - timeout de 9 s sur chaque appel YouTube, 5 s pour les suggestions ;
  - cache mémoire TTL (recherche 5 min, vidéo 10 min, chaîne 5 min, commentaires 3 min) ;
  - limite de 240 requêtes/min par IP avec `429` et `Retry-After` ;
  - validation stricte des identifiants (`[A-Za-z0-9_-]{11}`, `UC…`) et de la longueur des requêtes ;
  - suppression du CORS `*`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` ;
  - `/yt/api/raw` réservé au serveur de développement ;
  - messages d'erreur génériques (aucune stack renvoyée au client).
- **Registre local durable** : les vidéos et chaînes découvertes passent de `sessionStorage` à
  `localStorage` (plafonné, fusion non destructive). Un lien « Regarder plus tard » survit donc à
  un redémarrage.

### Lecture (`src/pages/Watch.tsx`, `src/components/Player.tsx`)

- Reprise de lecture calculée **une fois par vidéo** : la page ne se re-rend plus toutes les 2 s.
- Sauvegarde de la position **toutes les 5 s**, à la pause, à la fin et sur `pagehide` (au lieu de
  deux écritures `localStorage` par seconde).
- Hôte d'iframe stable (plus de conflit React / `YT.Player`), message d'erreur si l'API YouTube ne
  charge pas.
- Chapitres extraits dans un module testable (`src/lib/chapters.ts`) ; `?t=1h2m3s` et `?t=1:30`
  sont acceptés.
- Partage et liens absolus compatibles `--base=/repo/` (`src/lib/url.ts`).
- Actions utiles ajoutées : ouvrir sur YouTube, copier le lien, activer/désactiver SponsorBlock.

### Recherche, accueil, Shorts, navigation

- Recherche : pagination infinie (IntersectionObserver + bouton), compteur estimé, filtres,
  squelettes, `aria-live` sur le compteur, titre de page dynamique.
- Accueil : rendu progressif (24 cartes puis « Charger plus ») au lieu de charger tout le catalogue
  d'un coup, rayon « Reprendre la lecture ».
- Shorts : **un seul iframe actif** (avant : trois lecteurs simultanés), historique alimenté,
  partage compatible base, vignettes `frame0` préchargées.
- Routes chargées à la demande (`React.lazy` + `Suspense`) : le bundle principal passe de
  ~326 kB à ~290 kB (gzip 112 → 102 kB) et les pages deviennent des chunks séparés.
- Routeur et liens tenant compte de `BASE_URL` (GitHub Pages), lien d'évitement, `:focus-visible`,
  `prefers-reduced-motion`, raccourcis `Ctrl/⌘+B` et `/`, remise en haut de page à la navigation.
- Métadonnées par page (`document.title`, description, Open Graph) via `src/lib/meta.ts`.
- **Page Paramètres** (`/settings`) : thème, lecture (autoplay, boucle, théâtre, sous-titres,
  vitesse, volume), IA, SponsorBlock, profils mémorisés, export/import JSON, effacement sélectif
  et total. Les réglages de vitesse, volume, boucle et sous-titres sont désormais réellement
  appliqués au lecteur (ils existaient dans le store sans effet).
- **Résumé IA sous chaque vidéo** : résumé et chapitres générés à partir de la description et des
  métadonnées, chapitres cliquables qui déplacent le lecteur sans rechargement, cache de session,
  bouton « Régénérer », repli extractif sans invention, relais `POST /yt/api/summary` validé et
  réglage dédié dans Paramètres.

### Mini-lecteur et Picture-in-Picture (`src/components/PlayerHost.tsx`, `src/components/Player.tsx`)

- **Hôte unique du lecteur** monté au-dessus des routes : quitter `/watch` ne détruit plus l'iframe,
  la lecture continue et le lecteur se réduit en bas à droite. La page Watch ne fournit plus qu'un
  emplacement que l'hôte recouvre au pixel près (mesure au scroll et au redimensionnement).
- **Contrôles intégrés au mini-lecteur** : lecture/pause synchronisé sur l'état réel du lecteur,
  vidéo suivante, file d'attente (panneau listé avec vignettes, compteur, libellé contextuel
  playlist / « À suivre »), Picture-in-Picture, agrandir, fermer.
- **Picture-in-Picture** via l'API Document PiP : le lecteur est déplacé dans la fenêtre par un
  portail React, les feuilles de style y sont recopiées, l'API YouTube y est chargée dans sa propre
  fenêtre et la lecture reprend à la seconde courante. `Échap` et la fermeture par la fenêtre
  ramènent le lecteur dans la page. Un échec du PiP est rattrapé avec un message explicite.
- **Enchaînement sûr** : les segments SponsorBlock sont étiquetés par vidéo (un segment de la
  vidéo précédente ne peut plus envoyer la suivante à la fin) et l'enchaînement automatique
  n'a lieu que si la lecture a réellement atteint la fin, ce qui évite qu'un état « terminé »
  parasite vide toute la file d'attente.

### Qualité

- **62 tests unitaires** (Vitest) : parseurs InnerTube, pagination des commentaires, formatage
  français, chapitres, horodatages, sauvegarde/import des données, instantanés de profils et
  migration v4 → v5, prompts/résumés IA et repli automatique, sélecteurs et recommandations.
- **CI GitHub Actions** : `typecheck`, `test`, `build` sur chaque push/PR.
- Correction de `compactNumber` (« 1.2 k » → « 1,2 k ») et de l'accord des dates relatives
  (« il y a 1 jours » → « il y a 1 jour »).

## 3. Risques et bugs restants

### P0 — à traiter avant toute ambition multi-utilisateur

| Sujet | Constat | Correctif recommandé |
| --- | --- | --- |
| **Authentification factice** | Les comptes « Microsoft / Apple / GitHub / e-mail » sont de simples entrées `localStorage`. Aucun mot de passe, aucune session vérifiée. | Ne jamais présenter cela comme une connexion sécurisée. Pour du multi-utilisateur : backend, cookies `HttpOnly`, OAuth côté serveur. |
| **Proxy ouvert** | En preview, n'importe qui peut appeler `/yt/api/*` (limite par IP seulement). Un déploiement public devient un proxy YouTube gratuit. | Vérifier `Origin`/`Referer`, ajouter un secret d'instance ou une signature, plafonner par IP et globalement, surveiller les 429. |
| **CGU / légal** | InnerTube et le scraping ne sont pas des API publiques. Le projet ne télécharge pas de flux (bon point) mais extrait des métadonnées. | Documenter clairement l'usage personnel/éducation, ne pas héberger de contenu, prévoir un moyen de désactiver le proxy. |

### P1 — qualité produit et robustesse

1. **Aucune persistance serveur.** Tout est dans `localStorage` : perte au nettoyage, pas de synchro
   multi-appareils, pas de sauvegarde. Un compte serveur + base (D1/Postgres) est le prochain
   palier naturel.
2. **Commentaires incomplets.** Les réponses ne sont pas chargées, les likes de commentaires ne
   sont pas interactifs, et les commentaires locaux sont mélangés aux vrais sans marquage explicite.
3. **Tri par date masqué.** InnerTube accepte `CAISAhAB` mais renvoie un ordre mixte ; seuls
   pertinence et vues sont proposés. Il faudrait retrouver le token exact ou trier côté serveur.
4. **Recommandations simples.** `recommendFor` compte les catégories et les abonnements. Pas de
   signaux négatifs (dislikes, « pas intéressé »), pas de co-occurrence, pas de fraîcheur.
5. **Notifications statiques.** La cloche ne lit que le catalogue embarqué ; elle n'interroge pas
   les dernières vidéos des chaînes abonnées.
6. **Accessibilité partielle.** Lien d'évitement, focus visible et `aria-live` ont été ajoutés,
   mais les menus ne se ferment pas avec `Échap`, les modales n'ont pas de piège de focus, le
   tiroir mobile ne gère pas le focus, et les contrastes n'ont pas été audités.
7. **Observabilité nulle.** Aucune remontée d'erreur, aucun temps de réponse, aucun taux de succès
   des appels InnerTube. En production, les pannes seraient invisibles.
8. **Qualité de code.** Pas d'ESLint ni de Prettier ; `tsc` strict mais aucune règle de style. Le
   contournement `--legacy-peer-deps` est nécessaire à cause d'un bug d'arborist avec npm 10 ;
   envisager pnpm.
9. **Performance des médias.** Les vignettes sont chargées en `hq720` sans `srcset` ; une grille de
   24 cartes déclenche beaucoup de requêtes. Ajouter `srcset`/`sizes`, `decoding="async"` et un
   budget d'images.

### P2 — confort et fonctionnalités

- Le mini-lecteur, le PiP et la file d'attente existent désormais ; il reste à en faire une
  **file personnelle** (« Lire ensuite » depuis n'importe quelle carte, ordre modifiable,
  suppression, persistance) plutôt qu'une simple reprise des suggestions de la page Watch.
- Le mini-lecteur n'affiche **ni progression ni volume** : seuls les contrôles YouTube (à l'échelle
  d'une vignette de 360 px) les donnent.
- Pas de **raccourcis clavier hors de l'iframe** (espace, `k`, `j`/`l`, `m` inopérants tant que le
  focus n'est pas dans le lecteur) ni d'aide `?`.
- Pas de **mode théâtre mémorisé par vidéo**, ni de vitesse/qualité persistées (le lecteur YouTube
  garde ses propres réglages).
- Pas de **raccourcis clavier globaux** (k, j/l, f, m) : ils appartiennent à l'iframe et ne
  fonctionnent qu'après un clic dedans.
- Pas de **mode hors ligne / PWA** (manifest, service worker, cache des coquilles).
- Pas d'**i18n** : tout est en français en dur, y compris les libellés de dates.
- Pas de **playlists YouTube importées** ni de favoris synchronisés.
- Pas de **watch party**, de **chapitres cliquables dans la barre de progression**, ni de
  **statistiques de visionnage** (temps regardé, temps gagné grâce à SponsorBlock).
- Pas de **recherche vocale**, de **filtres avancés** (4K, direct, sous-titres, date de mise en
  ligne) ni de **résultats « Shorts » dédiés**.
- Pas de **gestion d'erreurs unifiée** : chaque page a son propre `catch` silencieux.

## 4. Feuille de route proposée

### Sprint 1 — consolider (1 à 2 semaines)

- Réponses aux commentaires + likes interactifs.
- ESLint + Prettier + `lint-staged`, puis tests E2E Playwright sur les parcours clés (accueil,
  recherche, lecture, commentaire, playlist, changement de thème).
- Gestion d'erreurs homogène : bandeau « YouTube indisponible », bouton « réessayer », journal
  local des échecs.

### Sprint 2 — expérience (2 à 4 semaines)

- ~~Mini-lecteur persistant + Picture-in-Picture natif.~~ **Fait** (voir §2) ; suite logique :
  file d'attente personnelle et contrôles de progression dans le mini-lecteur.
- Notifications live basées sur les dernières vidéos des chaînes abonnées (endpoint chaîne déjà
  prêt).
- Recommandations enrichies : dislikes, « pas intéressé », fraîcheur, co-occurrence.
- PWA : manifest, service worker, écran hors ligne, installation.
- Raccourcis clavier app-level avec une aide `?`, et navigation clavier complète des menus.
- Vignettes responsives (`srcset`), préchargement intelligent, budget de performance CI.

### Sprint 3 — passer à l'échelle (1 à 2 mois)

- Backend serverless (Cloudflare Worker) exposant les routes `/yt/api/*` avec cache edge, limite
  globale, vérification d'origine et métriques.
- Comptes serveur (OAuth), synchronisation des abonnements/playlists/historique.
- Base de données (D1/Postgres) + files d'attente pour le rafraîchissement du catalogue.
- Observabilité : logs structurés, traces, tableau de bord des erreurs et des latences.
- Tests de charge du proxy et stratégie de repli (catalogue, cache, dégradation gracieuse).

## 5. Notes d'architecture

```
Navigateur
  ├─ React (Vite) ── src/api/youtube.ts ── cache mémoire ── /yt/api/*
  │      │
  │      ├─ catalogue embarqué (repli hors ligne)
  │      └─ localStorage (compte, likes, historique, playlists, progression)
  │
  └─ iframe YouTube (lecteur officiel)

Serveur (Vite dev / preview, puis Worker en prod)
  ├─ config InnerTube (cache 6 h)
  ├─ cache TTL + limite par IP
  ├─ parseurs search / video / channel / comments
  └─ SponsorBlock + Return YouTube Dislike (best effort)
```

Le point de couplage est volontairement étroit : **toutes** les routes renvoient du JSON normalisé.
Remplacer le proxy Vite par un Worker ne demande aucune modification du front.

## 6. Vérifications effectuées

- `npm run typecheck` : OK.
- `npm test` : 62 tests, 7 fichiers, OK.
- `npm run build` : OK, chunks séparés, bundle principal ~295 kB (104 kB gzip), page Lecture
  dans son propre chunk (~25,6 kB) et Paramètres ~14,3 kB.
- **Résumé IA vérifié dans le navigateur** : badges « IA » et « Automatique », génération directe
  puis régénération, 5 chapitres cliquables (clic sur 3:15 → `getCurrentTime()` à 195 s),
  désactivation via les réglages, aucune erreur console.
- **Profils isolés vérifiés dans le navigateur** : migration d'un état v4 (likes, historique,
  playlists, commentaires) vers `tubecraft-profiles`, bascule Alice → Bob → Alice, chacun
  retrouvant ses propres données (Bob garde son like, Alice sa playlist et son historique),
  résumés de données par compte et effacement ciblé affichés dans le sélecteur.
- Page Paramètres vérifiée dans le navigateur : thème, interrupteurs, vitesse, volume, profil,
  taille du stockage, import invalide rejeté avec message d’erreur ; réglages persistés dans
  `tubecraft-store`.
- Endpoints testés en direct sur `127.0.0.1:5183` : recherche (+ pagination, tri, filtre),
  vidéo (`dQw4w9WgXcQ`, `jNQXAC9IVRw`), chaîne (vidéos + shorts), commentaires (2 pages sans
  doublon), SponsorBlock (3+ segments), identifiants invalides (400), route inconnue (404).
- Navigateur : accueil, recherche (14 → 31 résultats, filtre durée), lecture (titre, 19 M likes,
  521 k dislikes, 20 commentaires → 40), chaîne live (bannière, 30 vidéos, 48 shorts), Shorts
  (1 iframe actif), absence d'erreurs console applicatives.
- **Mini-lecteur vérifié dans le navigateur** : barre complète, bascule lecture/pause dans les deux
  sens, file d'attente (ouverture, clic sur un élément, compteur 20 → 17 puis 19 → 18, fermeture au
  clic extérieur), enchaînement d'exactement une vidéo à la fin en mini **et** sur `/watch`,
  cycle PiP complet exercé avec une fenêtre équivalente (styles copiés, lecteur déplacé, `Échap`
  qui restaure la lecture dans la page), échec du PiP rattrapé avec message.
- Non vérifié : fenêtre `documentPictureInPicture` **réelle** (son ouverture fige l'automatisation
  du navigateur de prévisualisation — seul le chemin applicatif avec une fenêtre équivalente a été
  exercé), OAuth Google (pas de client ID configuré), déploiement GitHub Pages, Safari/Firefox.

## 7. Conclusion

Le socle est solide et le projet a maintenant une vraie colonne vertébrale de données. Les
prochains gains ne viennent plus d'« ajouter des écrans » mais de **sortir du navigateur** pour la
persistance (comptes réels, synchronisation), et de **mesurer** ce qui casse. C'est le passage d'un
très bon clone de démonstration à un produit crédible.
