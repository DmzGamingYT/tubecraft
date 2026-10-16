# TubeCraft

Un clone open-source de YouTube : interface, lecteur, recherche, Shorts, likes, abonnements,
historique et commentaires. Même esprit que les alternatives open-source d'ArtCraft
(Photoshop, Word…) mais appliqué à YouTube.

L'application n'utilise **aucune clé API Google** : elle parle à InnerTube (l'API privée que
youtube.com utilise lui-même) via un proxy local, et lit les vidéos avec le lecteur officiel
YouTube (iframe). Les métadonnées, les résultats de recherche et les commentaires affichés sont
donc de **vraies données YouTube**.

## Démarrage

```bash
npm install
npm run dev        # http://127.0.0.1:5183
```

Sur macOS, vous pouvez aussi **double-cliquer sur `Démarrer TubeCraft.command`** : le script installe les
dépendances si besoin puis lance le serveur et ouvre le navigateur.

Autres commandes :

```bash
npm run typecheck  # vérification TypeScript
npm run build      # build de production dans dist/
npm run preview    # sert dist/ (le proxy InnerTube reste actif)
npm run catalog    # régénère le catalogue de vidéos depuis YouTube (serveur dev requis)
```

## Fonctionnalités

| Domaine | Détail |
| --- | --- |
| Accueil | Grille de vidéos, chips de catégories, étagère Shorts |
| Lecture | Lecteur YouTube intégré, likes/dislikes, partage, description dépliable, tags |
| Recherche | Recherche **en direct** sur YouTube (proxy InnerTube), repli hors ligne sur le catalogue |
| Commentaires | **Vrais commentaires YouTube** (auteur, likes, réponses) + vos commentaires locaux |
| Shorts | Flux vertical plein écran, défilement magnétique, clavier ↑/↓, rail like/commentaires/partage |
| Chaînes | Page de chaîne, abonnement, onglets Vidéos / Shorts |
| Bibliothèque | Abonnements, historique de visionnage, vidéos likées — persistés dans le navigateur |
| Compte | Connexion **Google / Gmail** (bouton officiel « Se connecter avec Google »), photo de profil, abonnements de base offerts à la première connexion, **recommandations personnalisées** d'après l'historique — tout est conservé dans le navigateur, rien n'arrive sur un serveur |
| Thème | Sombre (par défaut) et clair, responsive mobile/desktop |

## Connexion avec Google (Gmail)

La connexion est gérée par **Google Identity Services** (le même mécanisme que YouTube) :

- Sans configuration, l'app propose une **connexion locale de démonstration** (compte exemple) — pratique pour tester.
- Pour utiliser un **vrai compte Gmail** :

  1. Créez un identifiant OAuth sur [console.cloud.google.com](https://console.cloud.google.com) → *API et services → Identifiants → Créer des identifiants → ID client OAuth* (type **Application Web**).
  2. Dans *Origines JavaScript autorisées*, ajoutez `http://localhost:5173` (et l'URL de votre déploiement pour la prod).
  3. Copiez `.env.example` vers `.env` et renseignez :
     ```
     VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
     ```
  4. Relancez `npm run dev` : le bouton officiel « Se connecter avec Google » apparaît, le popup Google gère l'authentification et TubeCraft ne reçoit que nom, e-mail et photo.

Le fichier `.env` est ignoré par git (`.gitignore`) ; chaque utilisateur du projet peut mettre son propre identifiant. Aucune donnée de compte n'est envoyée à un serveur : tout reste dans le `localStorage` du navigateur.

## Architecture

```
vite.config.ts          config Vite + plugin proxy
server/ytProxy.ts       proxy InnerTube (dev + preview) : /yt/api/search, /player, /comments, /raw
scripts/build-catalog.mjs  génère src/data/catalog.ts depuis YouTube (données réelles vérifiées)
src/api/search.ts       recherche live + repli catalogue local
src/data/               catalogue généré, index et sélecteurs, registre des vidéos « live »
src/store.ts            état persistant (thème, likes, abonnements, historique, commentaires)
src/components/         barre haute, barre latérale, cartes vidéo, commentaires, actions…
src/pages/              Accueil, Lecture, Recherche, Shorts, Bibliothèque, Chaîne
```

### Pourquoi un proxy ?

InnerTube n'autorise pas les requêtes cross-origin depuis un navigateur. Le plugin Vite expose
donc des routes locales `/yt/api/*` qui interrogent YouTube côté serveur (aucune clé, aucun secret
stocké). En production réelle, remplacez ce plugin par un petit service serveur exposant les mêmes
routes — le front n'a pas à changer.

## Limites connues

- Les vidéos dont la chaîne a **désactivé l'intégration** ne peuvent pas être lues dans un iframe
  (YouTube affiche son propre message d'erreur). TubeCraft utilise uniquement le lecteur officiel,
  jamais d'URL de flux extraite.
- La lecture automatique peut être bloquée par le navigateur : cliquez sur ▶ dans le lecteur.
- InnerTube est une API non contractuelle : si YouTube change de format, `npm run catalog` et la
  recherche peuvent nécessiter une mise à jour du parseur (`server/ytProxy.ts`).
- Le catalogue embarqué est un instantané réel (titres, vues, chaînes, descriptions). Rafraîchissez-le
  avec `npm run catalog`.
- Projet indépendant, non affilié à YouTube / Google. Le nom, les contenus et les marques YouTube
  appartiennent à leurs propriétaires.

## Licence

TubeCraft est publié sous licence [MIT](LICENSE) — libre à chacun d'utiliser, modifier et redistribuer.
