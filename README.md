# TubeCraft

Un clone open-source de YouTube : interface, lecteur, recherche, Shorts, likes, abonnements,
historique, playlists et commentaires. Même esprit que les alternatives open-source d'ArtCraft
(Photoshop, Word…) mais appliqué à YouTube.

L'application n'utilise **aucune clé API Google** : elle parle à InnerTube (l'API privée que
youtube.com utilise lui-même) via un proxy local, et lit les vidéos avec le lecteur officiel
YouTube (iframe). Les métadonnées, les résultats de recherche, les suggestions et les
commentaires affichés sont donc de **vraies données YouTube**.

> Ce projet est indépendant et non affilié à YouTube / Google. InnerTube n'est pas une API
> publique : elle peut changer sans préavis. Voir [AUDIT.md](AUDIT.md) pour les limites et la
> feuille de route.

## Démarrage

```bash
npm install
npm run dev        # http://127.0.0.1:5183
```

Sur macOS, vous pouvez aussi **double-cliquer sur `Démarrer TubeCraft.command`** : le script installe
les dépendances si besoin puis lance le serveur et ouvre le navigateur.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement + proxy InnerTube |
| `npm run build` | vérification TypeScript puis build de production dans `dist/` |
| `npm run preview` | sert `dist/` (le proxy InnerTube reste actif) |
| `npm run typecheck` | vérification TypeScript seule |
| `npm test` | tests unitaires Vitest |
| `npm run catalog` | régénère le catalogue embarqué depuis YouTube (serveur dev requis) |

## Ce que fait TubeCraft

| Domaine | Détail |
| --- | --- |
| Accueil | grille progressive (24 par 24), chips de catégories, étagère Shorts, « Reprendre la lecture », recommandations personnalisées |
| Lecture | lecteur YouTube officiel, **vraies métadonnées** (titre, vues, description, tags, catégorie), likes et **dislikes réels**, **résumé IA + chapitres cliquables**, reprise de lecture, file d'attente de playlist |
| Suggestions | **suggestions YouTube en direct** pour la vidéo regardée, avec repli sur le catalogue |
| Recherche | recherche live, **pagination par continuation**, tri (pertinence / vues), filtre vidéos, filtre de durée, assistance IA gratuite |
| Chaînes | en-tête réel (avatar, bannière, handle, abonnés, description), onglets Vidéos / Shorts, pagination |
| Shorts | flux vertical plein écran, un seul lecteur actif à la fois, clavier ↑/↓, partage, historique |
| Commentaires | **vrais commentaires YouTube paginés** + commentaires locaux (réponses, likes, suppression) |
| Bibliothèque | abonnements, historique groupé par jour, vidéos likées, playlists, « Regarder plus tard » |
| Compte | Google OAuth (bouton officiel) ou comptes locaux, sélecteur de comptes, **données isolées par profil**, avatar, recommandations |
| Paramètres | thème, lecture (autoplay, boucle, théâtre, sous-titres, vitesse, volume), IA, SponsorBlock, profils, export/import JSON et effacement sélectif ou total des données |
| Confort | thème sombre/clair, raccourcis `Ctrl/⌘+B` et `/`, lien d'évitement, chargement des routes à la demande, responsive |
| SponsorBlock | saut automatique des sponsors, intros, autopromotions et autres segments (désactivable sous chaque vidéo) |

## Connexion (Google ou compte local)

Aucun compte factice n'est pré-rempli :

- **Google** — vraie connexion OAuth via Google Identity Services dès que `VITE_GOOGLE_CLIENT_ID`
  est renseigné.
- **Microsoft / Apple / GitHub / adresse e-mail** — création d'un **compte local** avec vos propres
  nom et adresse. Rien n'est envoyé à un serveur : tout reste dans le `localStorage`.
- **Choisir un compte** — les comptes utilisés sont mémorisés pour se reconnecter en un clic.
- **Données par profil** — likes, dislikes, abonnements, historique, playlists, « Regarder plus
  tard », progression, commentaires et préférences de notifications sont propres à chaque profil.
  Le thème et les réglages de lecture restent communs au navigateur. Les données existantes sont
  rattachées automatiquement au profil actif (ou au profil invité) au premier lancement de cette
  version : rien n'est supprimé.

Pour activer une vraie connexion Google :

1. Créez un **ID client OAuth** de type *Application Web* sur
   [console.cloud.google.com](https://console.cloud.google.com) (API et services → Identifiants).
2. Ajoutez vos origines autorisées : `http://127.0.0.1:5183`, `http://localhost:5183` et, si
   besoin, l'URL de votre déploiement.
3. Copiez `.env.example` en `.env` et renseignez
   `VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com`.
4. Relancez `npm run dev`.

> ⚠️ La connexion Google ne sert qu'à récupérer nom, e-mail et photo. TubeCraft ne demande
> **aucun scope YouTube** et ne peut pas agir sur votre compte Google. Les « comptes locaux » ne
> sont pas une authentification : ne les considérez pas comme une protection.

## Recherche assistée par IA (gratuite, sans clé)

La page de résultats utilise une **IA gratuite et sans clé** ([Pollinations](https://pollinations.ai))
pour reformuler la requête, proposer des **recherches associées** et afficher l'**intention**
détectée. Aucune inscription n'est nécessaire.

Le palier gratuit limite à environ **1 requête / 30 s par IP** : les plans sont mis en cache dans la
session et, si l'IA est indisponible, la recherche YouTube classique prend le relais sans erreur
visible. Le bouton **« IA activée / désactivée »** coupe la fonctionnalité.

## Résumé IA et chapitres de la vidéo

Sous chaque vidéo, une carte **Résumé IA** condense la description et les métadonnées (titre,
chaîne, durée, date, catégorie, tags) en quelques phrases, puis propose des **chapitres
cliquables** : un clic déplace le lecteur YouTube au bon timestamp, sans recharger la page.

- génération automatique à l'ouverture, mise en cache pour la session (pas d'appel répété) ;
- bouton **Régénérer** pour relancer à la demande ;
- chapitres validés (strictement croissants, bornés à la durée, 10 maximum) ;
- si l'IA est indisponible, un **résumé extractif** de la description et les chapitres déjà
  horodatés par la chaîne sont affichés, avec un badge « Automatique » — aucun chapitre inventé ;
- désactivable dans **Paramètres → IA et confort de visionnage**.

## SponsorBlock et dislikes réels

- [SponsorBlock](https://sponsor.ajay.app) (API publique, sans clé) fournit des segments
  communautaires. Le lecteur les saute pendant la lecture et affiche un badge temporaire.
  Le réglage est persisté et se coupe sous chaque vidéo.
- [Return YouTube Dislike](https://returnyoutubedislike.com) (API publique, sans clé) rétablit le
  nombre de dislikes, que YouTube n'expose plus. Si l'API ne répond pas, seul le nombre de likes
  est affiché.

Ces deux services sont **optionnels** : une panne est silencieuse et ne bloque jamais la lecture.

## Architecture

```
vite.config.ts             config Vite + plugin proxy
server/ytProxy.ts          proxy InnerTube + parsing (search, video, channel, comments, SponsorBlock)
server/ytProxy.test.ts     tests des parseurs
src/api/youtube.ts         couche cliente typée (cache mémoire, repli catalogue)
src/lib/ai.ts              recherche assistée par IA
src/lib/chapters.ts        détection des chapitres et des horodatages
src/lib/userData.ts        export/import/effacement des données locales (liste blanche de clés)
src/lib/url.ts             URLs absolues compatibles base Vite (GitHub Pages)
src/data/                  catalogue généré, index, registre des vidéos/chaînes découvertes
src/store.ts               état persistant (thème, likes, abonnements, historique, commentaires)
src/components/            barre haute, barre latérale, cartes, commentaires, lecteur…
src/pages/                 routes chargées à la demande
```

### Routes du proxy

| Route | Réponse |
| --- | --- |
| `GET /yt/api/search?q=&continuation=&sort=&type=` | résultats normalisés + jeton de continuation |
| `GET /yt/api/video?v=` | métadonnées, chaîne, likes/dislikes, suggestions |
| `GET /yt/api/channel?id=&tab=&continuation=` | en-tête de chaîne + vidéos + continuation |
| `GET /yt/api/player?v=` | réponse `player` InnerTube brute (utilisée par `npm run catalog`) |
| `GET /yt/api/comments?v=&continuation=` | commentaires + continuation |
| `GET /yt/api/suggest?q=` | autocomplétion |
| `GET /yt/api/sponsorblock?v=` | segments SponsorBlock |
| `GET /yt/api/ai?q=` | plan de recherche IA |
| `POST /yt/api/summary` | résumé + chapitres d'une vidéo (métadonnées validées, cache 6 h) |
| `GET /yt/api/raw?q=` | JSON InnerTube brut, **développement uniquement** |

Le proxy applique un **timeout**, un **cache mémoire**, une **limite de requêtes** par IP, valide
les identifiants et ne renvoie pas d'en-tête CORS permissif. Les réponses ne sont jamais mises en
cache par le navigateur (`Cache-Control: no-store`).

### Pourquoi un proxy ?

InnerTube n'autorise pas les requêtes cross-origin depuis un navigateur. Le plugin Vite expose
donc des routes locales `/yt/api/*` qui interrogent YouTube côté serveur (aucune clé, aucun secret
stocké). Pour un déploiement statique, ces routes doivent être hébergées séparément.

## Déploiement

`npm run build` génère un site statique dans `dist/`. Le front seul suffit pour le catalogue
embarqué, mais **la recherche live, les pages chaîne/vidéo et les commentaires nécessitent le
proxy**. Deux options :

1. **Hébergement avec fonctions serveur** (Cloudflare Workers, Vercel, Netlify…) : portez les
   handlers de `server/ytProxy.ts` sur la plateforme et exposez les mêmes chemins `/yt/api/*`.
   Le front n'a pas à changer.
2. **Site purement statique** : l'application reste utilisable avec le catalogue local, mais
   affiche « hors ligne — catalogue local » pour la recherche.

Pour GitHub Pages sur `https://<pseudo>.github.io/<repo>/` :

```bash
npm run build -- --base=/<repo>/
```

L'application lit `import.meta.env.BASE_URL` pour le routeur, les partages et les liens absolus.
Ajoutez aussi un `404.html` identique à `index.html` (ou une redirection) pour que les routes
profondes (`/watch`, `/channel`, `/search`) fonctionnent au rechargement.

## Vitrine autonome (`/apps`)

La présentation des apps open source existe à deux endroits, à partir du **même composant**
(`src/components/ShowcaseSite.tsx`) :

- `/apps` dans l'application (route React, hors du chrome YouTube) ;
- un **site statique séparé**, compilé dans `dist-showcase/`.

| Commande | Rôle |
| --- | --- |
| `npm run dev:showcase` | serveur de la vitrine seule sur `http://127.0.0.1:5185` (5184 est réservé à SpotifyCraft) |
| `npm run build:showcase` | vérification TypeScript puis build dans `dist-showcase/` |
| `npm run preview:showcase` | sert le build de la vitrine |

`dist-showcase/` est **portable** : les chemins d'assets sont relatifs (`base: './'`), donc le
dossier peut être déposé à la racine d'un domaine ou dans un sous-dossier (GitHub Pages de projet,
Netlify Drop, Cloudflare Pages…) sans rebuild. Un simple serveur de fichiers suffit :

```bash
npm run build:showcase
python3 -m http.server 8080 --directory dist-showcase
```

Pour que les boutons « Ouvrir TubeCraft » pointent vers l'application déployée, renseignez
`VITE_APP_URL` **au moment du build** :

```bash
VITE_APP_URL=https://mon-tubecraft.example npm run build:showcase
```

Sans cette variable, la vitrine renvoie vers le profil GitHub au lieu d'afficher un lien mort.

Les apps et leurs liens vivent dans `src/data/apps.ts` : la **première entrée est TubeCraft**
(mise en avant). `source` est l'URL du dépôt GitHub, `self: true` désigne l'application de ce
dépôt (son URL vient du contexte : route `/` dans l'app, `VITE_APP_URL` sur le site autonome). Le
dépôt TubeCraft n'étant pas encore public, sa carte renvoie vers le profil GitHub.

La section **« À l’étude »** liste les fonctionnalités proposées (palette de commandes, mode
écoute, etc.). Elle est alimentée par `src/data/proposals.ts` : rien n’y est présenté comme
développé, chaque entrée porte un statut `exploring` ou `proposed`.

La vitrine reste typographique, mais chaque app est accompagnée d’une **démo d’interface animée** :
une maquette HTML/CSS qui boucle comme un extrait vidéo (lecteur TubeCraft, accueil SpotifyCraft),
avec un bouton pause et une mise en pause automatique hors écran. Un clic sur l’écran ouvre une
**galerie plein écran dédiée à l’app** : accueil, recherche, Shorts, mini-lecteur pour TubeCraft ;
lecture, file d’attente, égaliseur et bibliothèque pour SpotifyCraft. Les jaquettes SpotifyCraft
sont les vraies pochettes iTunes, et les vignettes viennent de YouTube. La section « Sous le capot »
montre le trajet navigateur → proxy → InnerTube et un journal de requêtes qui défile ; « À l’étude »
affiche un aperçu animé de la proposition survolée ou sélectionnée, avec un aperçu intégré à la
liste sur mobile. Tout respecte `prefers-reduced-motion`. Un bouton **Papier / Nuit** change de
thème sans quitter la page et mémorise le choix.

La démo TubeCraft de la vitrine est une **séquence en trois scènes** qui boucle toute seule :
recherche, lecture, puis mini-lecteur persistant — avec la piste de scènes sous l'écran et
l'adresse factice qui change. Le bouton **Visite guidée** (barre de navigation, hero ou sommaire
mobile) fait défiler la page étape par étape, met le reste en retrait et déclenche chaque scène au
bon moment. Échap quitte, les flèches naviguent, la barre d'espace met en pause.

## Télécharger

La même page de téléchargement est partagée par l'app (route `/download`, dans le chrome YouTube)
et par la vitrine (section `#telecharger`, avec le sélecteur d'app). Elle couvre **macOS, Windows,
Linux, Android et iPhone** :

- chaque plateforme a ses propres étapes d'installation, réellement applicables dans le navigateur ;
- l'onglet de la plateforme détectée est sélectionné à l'ouverture ;
- sur la route `/download`, le bouton **Installer** utilise `beforeinstallprompt` quand Chrome ou
  Edge le propose (voir `src/lib/pwa.ts`) ; sur iOS, la page renvoie vers le menu Partager de Safari ;
- `public/manifest.webmanifest`, `public/sw.js` et les icônes rendent l'app installable ; le service
  worker ne met en cache que le shell et les assets same-origin, jamais `/yt/api` ni les domaines tiers.

La vitrine présente aussi les binaires natifs de SpotifyCraft (DMG, MSI, AppImage) via sa page de
versions GitHub : aucun faux lien de fichier n'est généré.

## Tests et CI

```bash
npm test
```

Les tests couvrent les parseurs InnerTube (vidéo, lockup, chaîne, commentaires, pagination), le
formatage français, les chapitres/horodatages, l’export/import des données et les sélecteurs du
catalogue. Le workflow
[.github/workflows/ci.yml](.github/workflows/ci.yml) exécute `typecheck`, `test` et `build` sur
chaque push et pull request.

## Limites connues

- Les vidéos dont la chaîne a **désactivé l'intégration** ne peuvent pas être lues dans un iframe.
  TubeCraft utilise uniquement le lecteur officiel, jamais d'URL de flux extraite.
- La lecture automatique peut être bloquée par le navigateur : cliquez sur ▶ dans le lecteur.
- InnerTube est une API non contractuelle : si YouTube change de format, `npm run catalog`, la
  recherche et le parsing peuvent nécessiter une mise à jour.
- Le tri « plus récentes » n'est pas exposé : InnerTube l'accepte mais l'ordre renvoyé reste mixte.
  Seuls « pertinence » et « plus vues » sont proposés.
- Les réponses aux commentaires sont comptées mais pas encore chargées.
- InnerTube et les services communautaires peuvent être bloqués selon votre réseau ou votre pays.
- Projet indépendant, non affilié à YouTube / Google. Le nom, les contenus et les marques YouTube
  appartiennent à leurs propriétaires.

## Licence

TubeCraft est publié sous licence [MIT](LICENSE) — libre à chacun d'utiliser, modifier et
redistribuer.
