/**
 * Propositions de fonctionnalités pour TubeCraft, affichées dans la section
 * « À l’étude » de la vitrine.
 *
 * Rien ici n’est encore développé : ce sont des idées ouvertes, classées par
 * thème. Pour en ajouter une, dupliquez une entrée ; l’ordre du tableau est
 * l’ordre d’affichage.
 */

export type ProposalStatus = 'exploring' | 'proposed';

export interface FeatureProposal {
  id: string;
  title: string;
  /** deux phrases maximum, concrètes */
  summary: string;
  /** thème affiché en petites capitales */
  tag: string;
  status: ProposalStatus;
}

export const proposalStatusLabel: Record<ProposalStatus, string> = {
  exploring: 'À l’étude',
  proposed: 'Proposé',
};

export const proposals: FeatureProposal[] = [
  {
    id: 'command-palette',
    title: 'Palette de commandes ⌘K',
    summary:
      'Lancer une vidéo, changer de thème, ouvrir une chaîne ou un réglage sans quitter le clavier. Une seule entrée, et tout TubeCraft devient accessible.',
    tag: 'Confort',
    status: 'exploring',
  },
  {
    id: 'audio-mode',
    title: 'Mode écoute',
    summary:
      'Couper l’image et ne garder que le son : moins de batterie et de données pour les podcasts, les conférences et les longues interviews.',
    tag: 'Lecture',
    status: 'exploring',
  },
  {
    id: 'encrypted-portability',
    title: 'Reprise chiffrée multi-appareils',
    summary:
      'Exporter progression, playlists et abonnements dans un fichier chiffré, puis l’importer sur un autre navigateur. Toujours sans serveur ni compte.',
    tag: 'Données',
    status: 'proposed',
  },
  {
    id: 'local-watch-party',
    title: 'Watch party entre onglets',
    summary:
      'Synchroniser lecture et pause entre plusieurs onglets ou fenêtres du même navigateur — pratique sur deux écrans, sans aucun serveur.',
    tag: 'Social',
    status: 'proposed',
  },
  {
    id: 'import-subscriptions',
    title: 'Importer ses abonnements YouTube',
    summary:
      'Coller un export d’abonnements et retrouver ses chaînes dans TubeCraft en un clic, plutôt que de les réajouter une par une.',
    tag: 'Migration',
    status: 'proposed',
  },
  {
    id: 'local-yearly-recap',
    title: 'Bilan annuel local',
    summary:
      'Heures regardées, chaînes et catégories favorites : un récapitulatif calculé dans le navigateur, prêt à partager en image.',
    tag: 'Données',
    status: 'proposed',
  },
];
