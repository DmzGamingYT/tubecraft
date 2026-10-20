#!/bin/bash
# Double-cliquez sur ce fichier pour lancer Séquence.
# macOS peut demander « Ouvrir quand même » la première fois (fichier non signé).
cd "$(dirname "$0")" || exit 1

if [ ! -d node_modules ]; then
  echo "Installation des dépendances (première fois uniquement)…"
  npm install || exit 1
fi

echo "Séquence démarre : votre navigateur va s'ouvrir sur le serveur local."
echo "Pour arrêter : Ctrl+C dans cette fenêtre, ou fermez-la."
npm run dev -- --open
