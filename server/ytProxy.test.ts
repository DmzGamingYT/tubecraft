import { describe, expect, it } from 'vitest';
import {
  parseChannelPage,
  parseComments,
  parseSearchResults,
  parseVideoPage,
} from './ytProxy';

const VIDEO_ID = 'abcdefghijk';

function videoRenderer(overrides: Record<string, unknown> = {}) {
  return {
    videoRenderer: {
      videoId: VIDEO_ID,
      title: { runs: [{ text: 'Une vidéo de test' }] },
      ownerText: {
        runs: [
          {
            text: 'Ma Chaîne',
            navigationEndpoint: { browseEndpoint: { browseId: 'UC1234567890123456789012' } },
          },
        ],
      },
      lengthText: { simpleText: '12:34' },
      viewCountText: { simpleText: '1 234 567 vues' },
      publishedTimeText: { simpleText: 'il y a 2 ans' },
      thumbnail: { thumbnails: [{ url: 'petite.jpg' }, { url: 'grande.jpg' }] },
      ...overrides,
    },
  };
}

function videoLockup(overrides: Record<string, any> = {}) {
  const base = {
    contentId: VIDEO_ID,
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata: {
      lockupMetadataViewModel: {
        title: { content: 'Tutoriel Blender' },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [
              {
                metadataParts: [
                  {
                    text: {
                      content: 'Blender Studio',
                      commandRuns: [
                        {
                          onTap: {
                            innertubeCommand: {
                              browseEndpoint: { browseId: 'UC9999999999999999999999' },
                            },
                          },
                        },
                      ],
                    },
                  },
                  { text: { content: 'Vérifié' } },
                ],
              },
              {
                metadataParts: [
                  { text: { content: '250 k vues' } },
                  { text: { content: 'il y a 3 mois' } },
                ],
              },
            ],
          },
        },
      },
    },
    contentImage: {
      thumbnailViewModel: {
        image: { sources: [{ url: 'mini.jpg' }, { url: 'maxi.jpg' }] },
        overlays: [
          {
            thumbnailBottomOverlayViewModel: {
              badges: [{ thumbnailBadgeViewModel: { text: '26:54' } }],
            },
          },
        ],
      },
    },
  };

  return { lockupViewModel: { ...base, ...overrides } };
}

describe('parseSearchResults', () => {
  it('normalise un videoRenderer classique', () => {
    const [result] = parseSearchResults({ contents: videoRenderer() });

    expect(result).toMatchObject({
      kind: 'video',
      videoId: VIDEO_ID,
      title: 'Une vidéo de test',
      channelId: 'UC1234567890123456789012',
      channelName: 'Ma Chaîne',
      duration: 754,
      views: '1 234 567 vues',
      publishedAt: 'il y a 2 ans',
      thumbnail: 'grande.jpg',
      isShort: false,
    });
  });

  it('lit la durée des nouveaux lockups et la chaîne par commandRuns', () => {
    const [result] = parseSearchResults({ contents: [videoLockup()] });

    expect(result).toMatchObject({
      videoId: VIDEO_ID,
      title: 'Tutoriel Blender',
      channelId: 'UC9999999999999999999999',
      channelName: 'Blender Studio',
      duration: 1614,
      views: '250 k vues',
      publishedAt: 'il y a 3 mois',
      thumbnail: 'maxi.jpg',
      isShort: false,
    });
  });

  it('ignore les playlists et les identifiants invalides', () => {
    expect(
      parseSearchResults({
        contents: [
          videoLockup({ contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' }),
          videoLockup({ contentId: 'trop-court' }),
        ],
      })
    ).toEqual([]);
  });

  it('extrait les chaînes et déduplique les vidéos', () => {
    const results = parseSearchResults({
      contents: [
        videoRenderer(),
        videoRenderer(),
        {
          channelRenderer: {
            channelId: 'UC1234567890123456789012',
            title: { simpleText: 'Ma Chaîne' },
            thumbnail: { thumbnails: [{ url: 'avatar.jpg' }] },
            subscriberCountText: { simpleText: '@machaine' },
            videoCountText: { simpleText: '42 vidéos' },
          },
        },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ kind: 'channel', channelName: 'Ma Chaîne', handle: '@machaine' });
  });
});

describe('parseVideoPage', () => {
  const next = {
    contents: {
      twoColumnWatchNextResults: {
        results: {
          results: {
            contents: [
              {
                videoPrimaryInfoRenderer: {
                  title: { runs: [{ text: 'Rick Astley - Never Gonna Give You Up' }] },
                  viewCount: {
                    videoViewCountRenderer: {
                      viewCount: { simpleText: '1 827 523 566 vues' },
                    },
                  },
                  dateText: { simpleText: '24 oct. 2009' },
                },
              },
              {
                videoSecondaryInfoRenderer: {
                  attributedDescription: { content: 'Description réelle de la vidéo.' },
                  owner: {
                    videoOwnerRenderer: {
                      title: { runs: [{ text: 'Rick Astley' }] },
                      subscriberCountText: { simpleText: "4,55 M d'abonnés" },
                      thumbnail: { thumbnails: [{ url: 'avatar.jpg' }] },
                      navigationEndpoint: {
                        browseEndpoint: { browseId: 'UCuAXFkgsw1L7xaCfnd5JJOw' },
                      },
                    },
                  },
                  segmentedLikeDislikeButtonViewModel: {
                    likeButtonViewModel: {
                      likeButtonViewModel: {
                        toggleButtonViewModel: {
                          toggleButtonViewModel: {
                            defaultButtonViewModel: {
                              buttonViewModel: { title: '19 M' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        secondaryResults: {
          secondaryResults: {
            results: [
              videoLockup({ contentId: 'zzzzzzzzzzz' }),
              videoLockup(),
            ],
          },
        },
      },
    },
  };

  const player = {
    videoDetails: {
      title: 'Titre player',
      viewCount: '1827523566',
      lengthSeconds: '213',
      author: 'Rick Astley',
      channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      keywords: ['rick astley', 'nggyu'],
    },
    microformat: {
      playerMicroformatRenderer: {
        category: 'Music',
        publishDate: '2009-10-24',
      },
    },
  };

  it('fusionne next + player en données prêtes pour l’UI', () => {
    const page = parseVideoPage(next, player, 'dQw4w9WgXcQ');

    expect(page.video).toMatchObject({
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      views: '1 827 523 566 vues',
      viewsCount: 1_827_523_566,
      publishedAt: '24 oct. 2009',
      category: 'Music',
      duration: 213,
      likesText: '19 M',
      likes: 19_000_000,
      description: 'Description réelle de la vidéo.',
    });
    expect(page.video.tags).toEqual(['rick astley', 'nggyu']);
    expect(page.channel).toMatchObject({
      id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      name: 'Rick Astley',
      avatar: 'avatar.jpg',
    });
    expect(page.related).toHaveLength(2);
  });

  it('tolère un lecteur indisponible', () => {
    const page = parseVideoPage(next, null, 'dQw4w9WgXcQ');
    expect(page.video.duration).toBeNull();
    expect(page.video.tags).toEqual([]);
  });
});

describe('parseChannelPage', () => {
  it('lit l’en-tête, la bannière et les vidéos', () => {
    const browse = {
      header: {
        pageHeaderRenderer: {
          content: {
            pageHeaderViewModel: {
              title: { dynamicTextViewModel: { text: { content: 'Rick Astley' } } },
              image: {
                decoratedAvatarViewModel: {
                  avatar: { avatarViewModel: { image: { sources: [{ url: 'avatar.jpg' }] } } },
                },
              },
              banner: { imageBannerViewModel: { image: { sources: [{ url: 'banner.jpg' }] } } },
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    { metadataParts: [{ text: { content: '@RickAstleyYT' } }] },
                    {
                      metadataParts: [
                        { text: { content: "4,55 M d'abonnés" } },
                        { text: { content: '437 vidéos' } },
                      ],
                    },
                  ],
                },
              },
              description: {
                descriptionPreviewViewModel: { description: { content: 'Bienvenue !' } },
              },
            },
          },
        },
      },
      contents: [
        { richItemRenderer: { content: videoRenderer() } },
        {
          continuationItemRenderer: {
            continuationEndpoint: { continuationCommand: { token: 'BROWSE_TOKEN' } },
          },
        },
      ],
    };

    const page = parseChannelPage(browse, 'UCuAXFkgsw1L7xaCfnd5JJOw');

    expect(page.channel).toMatchObject({
      name: 'Rick Astley',
      handle: '@RickAstleyYT',
      avatar: 'avatar.jpg',
      banner: 'banner.jpg',
      videoCount: '437 vidéos',
      description: 'Bienvenue !',
    });
    expect(page.videos).toHaveLength(1);
    expect(page.continuation).toBe('BROWSE_TOKEN');
  });
});

describe('parseComments', () => {
  it('extrait les commentaires et la page suivante', () => {
    const data = {
      engagementPanels: [
        {
          engagementPanelSectionListRenderer: {
            header: {
              engagementPanelTitleHeaderRenderer: {
                contextualInfo: { runs: [{ text: '2,4 M' }] },
              },
            },
          },
        },
      ],
      frameworkUpdates: {
        entityBatchUpdate: {
          mutations: [
            {
              payload: {
                commentEntityPayload: {
                  properties: {
                    commentId: 'c1',
                    content: { content: 'Super vidéo !' },
                    publishedTime: 'il y a 1 jour',
                  },
                  author: {
                    displayName: 'Alice',
                    avatarThumbnailUrl: 'avatar.jpg',
                    channelId: 'UC1111111111111111111111',
                  },
                  toolbar: { likeCountNotliked: '12', replyCount: '3' },
                },
              },
            },
          ],
        },
      },
      contents: {
        continuationItemRenderer: {
          continuationEndpoint: { continuationCommand: { token: 'COMMENTS_TOKEN' } },
        },
      },
    };

    const page = parseComments(data);

    expect(page.count).toBe('2,4 M');
    expect(page.continuation).toBe('COMMENTS_TOKEN');
    expect(page.comments).toEqual([
      {
        id: 'c1',
        author: 'Alice',
        avatar: 'avatar.jpg',
        channelId: 'UC1111111111111111111111',
        text: 'Super vidéo !',
        publishedAt: 'il y a 1 jour',
        likes: '12',
        replies: '3',
      },
    ]);
  });

  it('choisit le jeton de page suivante, pas celui des réponses', () => {
    const data = {
      onResponseReceivedEndpoints: [
        {
          reloadContinuationItemsCommand: {
            continuationItems: [
              {
                commentThreadRenderer: {
                  replies: {
                    commentRepliesRenderer: {
                      contents: [
                        {
                          continuationItemRenderer: {
                            continuationEndpoint: {
                              continuationCommand: { token: 'REPLY_TOKEN' },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
              {
                continuationItemRenderer: {
                  continuationEndpoint: { continuationCommand: { token: 'NEXT_PAGE' } },
                },
              },
            ],
          },
        },
      ],
    };

    expect(parseComments(data).continuation).toBe('NEXT_PAGE');
  });
});
