/**
 * Médias des démos : vraies vignettes YouTube et jaquettes iTunes.
 *
 * Les jaquettes sont celles servies à SpotifyCraft par l'API iTunes, en 300 px
 * pour rester légères. Elles restent distantes : hors ligne, le fond dégradé
 * de secours prend le relais.
 */

export const YT_THUMBS = {
  spring: 'https://i.ytimg.com/vi/WhWc3b3KhnY/hqdefault.jpg',
  sprite: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg',
  charge: 'https://i.ytimg.com/vi/UXqq0ZvbOnk/hqdefault.jpg',
  singularity: 'https://i.ytimg.com/vi/6qKZw8oPoiE/hqdefault.jpg',
} as const;

const art = (path: string) =>
  `https://is1-ssl.mzstatic.com/image/thumb/${path}/300x300bb.jpg`;

export interface SpotifyMix {
  name: string;
  meta: string;
  covers: [string, string, string, string];
}

export const SP_MIXES: SpotifyMix[] = [
  {
    name: 'Mix de démarrage',
    meta: 'Pour découvrir · Daft Punk · 24 titres',
    covers: [
      art('Features115/v4/34/8d/c7/348dc71c-d75e-9baf-671a-994e9e74b018/dj.pimdxdmf.jpg'),
      art('Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg'),
      art('Music221/v4/fd/4a/77/fd4a77db-0ebc-d043-41a2-f32fa1bb0fb4/dj.qrikkdwj.jpg'),
      art('Music125/v4/b7/15/5f/b7155f62-f93a-2fe7-d98d-cc19240b4bd0/5099951165857_1500x1500_300dpi.jpg'),
    ],
  },
  {
    name: 'Mix Pop',
    meta: 'Pour découvrir · 24 titres',
    covers: [
      art('Music126/v4/28/71/00/287100fb-5c31-0195-5343-e6b3625886d0/886443969834.jpg'),
      art('Music114/v4/00/63/f0/0063f095-7db2-0f07-47dc-4c23867532e8/190295988432.jpg'),
      art('Music125/v4/e9/1a/30/e91a3097-b70f-ec9d-843a-78f54880d334/21UMGIM50543.rgb.jpg'),
      art('Music211/v4/de/e1/61/dee16173-c361-9d23-9fbe-9ef3ad1daa46/24UM1IM00411.rgb.jpg'),
    ],
  },
  {
    name: 'Mix Électro & dance',
    meta: 'Pour découvrir · 24 titres',
    covers: [
      art('Music211/v4/ed/9b/e3/ed9be326-dbd3-4904-d848-1950b4ee8925/5052075032894.png'),
      art('Music122/v4/3a/13/97/3a139791-b21b-59a7-5f85-1de8a59ef13b/cover.jpg'),
      art('Music116/v4/d5/ca/ef/d5caef26-fdcf-750b-7f72-15e91e4916cc/16UMGIM68689.rgb.jpg'),
      art('Music125/v4/a1/a7/9d/a1a79d27-d77f-5dd5-02e5-0cc36e1485b2/5060899075751_cover.jpg'),
    ],
  },
];

export const SP_TRACKS = [
  {
    title: 'PARISIENNE',
    artist: 'GIMS & La Mano 1.9',
    duration: '3:04',
    cover: art('Music221/v4/66/ac/47/66ac4753-fd40-2681-cea6-eecfbd39ec2f/cover.jpg'),
  },
  {
    title: 'POP!',
    artist: 'NAYEON',
    duration: '2:58',
    cover: art('Music122/v4/3f/49/ec/3f49ecb2-cb91-dd28-45b9-a31326d7e63b/738676859614_Cover.jpg'),
  },
  {
    title: 'CIEL',
    artist: 'GIMS',
    duration: '3:12',
    cover: art('Music211/v4/7e/4a/df/7e4adfc1-7cf7-7a96-a4cb-2fc338a5b03e/cover.jpg'),
  },
  {
    title: 'Fever',
    artist: 'Dua Lipa & Angèle',
    duration: '2:37',
    cover: art('Music116/v4/96/a2/a4/96a2a4e8-53b8-05d3-d0e2-fb1e41817f1d/190295127718.jpg'),
  },
  {
    title: 'Calm Down',
    artist: 'Rema',
    duration: '3:59',
    cover: art('Music116/v4/b2/b4/7c/b2b47cf9-d8e2-53f6-5c62-c974d665c95b/22UMGIM08994.rgb.jpg'),
  },
  {
    title: 'Casanova',
    artist: 'Soolking & Gazo',
    duration: '2:46',
    cover: art('Music126/v4/10/19/83/10198394-5f8a-228d-3915-680821fb9427/23UMGIM76651.rgb.jpg'),
  },
] as const;
