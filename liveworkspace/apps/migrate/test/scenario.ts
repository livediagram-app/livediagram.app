// The fixture the plan tests share: a small old site with each case the brief names (an owner-map collision, a
// mixed document, a guest's document, tokens, a team whose creator row has no email, share codes that differ only
// by case), and the files the plan reads beside the snapshot.
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DAY,
  GUEST_A,
  GUEST_B,
  NOW,
  clerkCsv,
  oldDatabase,
  put,
  putDocument,
  shape,
} from './fixture.ts';

export const sha = (text: string) => createHash('sha256').update(text).digest('hex');
/** The bytes the fake old bucket holds for an image: its id, so its SHA-256 is known. */
export const imageBytes = (id: string) => Buffer.from(`bytes of ${id}`);

export const CLERK = clerkCsv([
  { id: 'user_ali', email: 'ali@example.com', first: 'Ali', last: 'Khan' },
  { id: 'user_bo', email: 'Bo@Example.com', first: 'Bo', last: 'Li' },
  { id: 'user_cy', email: 'cy@example.com', first: 'Cy' },
]);
// Bo already has an account on the new side, under another id: the owner-map collision.
export const EXISTING = JSON.stringify([
  { results: [{ id: 'user_newbo', email: 'bo@example.com' }] },
]);

const person = (id: string, name: string) => JSON.stringify({ id, name, color: '#ff8800' });

export function scenario(): DatabaseSync {
  const db = oldDatabase();
  put(db, 'owner_aliases', { owner_id: 'user_cy', alias_id: GUEST_B, created_at: NOW - 50 * DAY });
  put(db, 'participants', {
    id: GUEST_A,
    name: 'Quiet Fox',
    color: '#123456',
    created_at: NOW - 40 * DAY,
  });
  put(db, 'participants', {
    id: 'stranger-0000',
    name: 'Passer-by',
    color: '#000000',
    created_at: NOW - 40 * DAY,
  });

  // A team whose creator row has no email (the old column allowed it), a member, an invitation, an expired one.
  put(db, 'teams', {
    id: 'team1',
    name: 'Design',
    organisation: 'Acme',
    created_at: NOW - 20 * DAY,
    updated_at: NOW - 20 * DAY,
  });
  put(db, 'teams', {
    id: 'team2',
    name: 'Ops',
    created_at: NOW - 20 * DAY,
    updated_at: NOW - 20 * DAY,
  });
  put(db, 'team_members', {
    id: 'm1',
    team_id: 'team1',
    user_id: 'user_ali',
    email: null,
    role: 'admin',
    created_at: NOW - 20 * DAY,
    updated_at: NOW - 20 * DAY,
    status: null,
  });
  put(db, 'team_members', {
    id: 'm2',
    team_id: 'team1',
    user_id: 'user_bo',
    email: 'bo@example.com',
    role: 'member',
    created_at: NOW - 19 * DAY,
    updated_at: NOW - 19 * DAY,
    status: 'joined',
  });
  put(db, 'team_members', {
    id: 'm3',
    team_id: 'team1',
    user_id: null,
    email: 'New@X.com',
    role: 'member',
    created_at: NOW - 3 * DAY,
    updated_at: NOW - 3 * DAY,
    status: 'invited',
  });
  put(db, 'team_members', {
    id: 'm4',
    team_id: 'team1',
    user_id: null,
    email: 'old@x.com',
    role: 'member',
    created_at: NOW - 15 * DAY,
    updated_at: NOW - 8 * DAY,
    status: 'expired',
  });

  // Tokens: live, revoked, expired, and one whose owner has no account anywhere.
  put(db, 'api_tokens', {
    id: 'tk-live',
    owner_id: 'user_ali',
    token_hash: 'lvd_hash_live',
    name: 'CLI',
    created_at: NOW - 10 * DAY,
    expires_at: NOW + 30 * DAY,
    read_only: 1,
  });
  put(db, 'api_tokens', {
    id: 'tk-unnamed',
    owner_id: 'user_bo',
    token_hash: 'lvd_hash_bo',
    name: null,
    created_at: NOW - 10 * DAY,
    expires_at: NOW + 30 * DAY,
  });
  put(db, 'api_tokens', {
    id: 'tk-revoked',
    owner_id: 'user_ali',
    token_hash: 'lvd_hash_rev',
    name: 'Old',
    created_at: NOW - 10 * DAY,
    expires_at: NOW + 30 * DAY,
    revoked: 1,
  });
  put(db, 'api_tokens', {
    id: 'tk-expired',
    owner_id: 'user_ali',
    token_hash: 'lvd_hash_exp',
    name: 'Gone',
    created_at: NOW - 100 * DAY,
    expires_at: NOW - DAY,
  });
  put(db, 'api_tokens', {
    id: 'tk-ghost',
    owner_id: 'user_zz',
    token_hash: 'lvd_hash_zz',
    name: 'Ghost',
    created_at: NOW - 10 * DAY,
    expires_at: NOW + 30 * DAY,
  });

  put(db, 'user_preferences', {
    owner_id: 'user_ali',
    prefs: JSON.stringify({
      notifyDiagramJoin: false,
      notifyFormResponses: false,
      planModeEnabled: true,
      snapToGrid: false,
    }),
    updated_at: NOW - 3 * DAY,
  });
  put(db, 'email_lifecycle', {
    owner_id: 'user_ali',
    email: 'ali@example.com',
    created_at: NOW - 200 * DAY,
    welcome_sent_at: NOW - 199 * DAY,
    week1_sent_at: NOW - 193 * DAY,
    milestone_sent_at: NOW - 100 * DAY,
  });
  put(db, 'auth_accounts', { owner_id: 'user_ali', first_seen_at: NOW - 200 * DAY });

  put(db, 'folders', {
    id: 'f1',
    owner_id: 'user_ali',
    parent_id: null,
    name: 'Work',
    created_at: NOW - 60 * DAY,
    updated_at: NOW - 60 * DAY,
  });
  put(db, 'folders', {
    id: 'f2',
    owner_id: 'user_ali',
    parent_id: 'f1',
    name: 'Q4',
    created_at: NOW - 59 * DAY,
    updated_at: NOW - 59 * DAY,
  });
  put(db, 'placement_defaults', {
    owner_id: 'user_ali',
    default_key: 'personal',
    folder_id: 'f2',
    updated_at: NOW - 59 * DAY,
  });

  // Images: Ali's, the guest's, and two that collide once the aliased guest is Cy.
  const image = (id: string, owner: string, bytesOf = id) =>
    put(db, 'images', {
      id,
      owner_id: owner,
      content_type: 'image/png',
      byte_size: imageBytes(bytesOf).length,
      width: 10,
      height: 10,
      sha256: sha(imageBytes(bytesOf).toString()),
      original_name: `${id}.png`,
      created_at: NOW - 30 * DAY,
    });
  image('img-1', 'user_ali');
  image('img-2', GUEST_A);
  image('img-3', GUEST_B, 'same');
  image('img-4', 'user_cy', 'same');

  // A diagram, with a plain-text share password, a lower-case share code, a favourite, an open and a share.
  putDocument(
    db,
    {
      id: 'doc-diagram',
      owner_id: 'user_ali',
      name: 'Roadmap',
      folder_id: 'f2',
      share_password: 'hunter2',
      source: 'mcp',
      opens_in: 'diagram',
    },
    [
      {
        id: 't1',
        name: 'Overview',
        body: {
          elements: [
            shape('s1', 0, 0),
            { id: 'pic', type: 'image', x: 200, y: 0, width: 50, height: 50, imageId: 'img-1' },
          ],
        },
      },
    ],
  );
  put(db, 'favourites', {
    owner_id: 'user_bo',
    document_id: 'doc-diagram',
    created_at: NOW - 4 * DAY,
  });
  put(db, 'document_opens', {
    owner_id: 'user_bo',
    document_id: 'doc-diagram',
    last_opened_at: NOW - 2 * DAY,
    last_open_day: '2026-09-29',
  });
  put(db, 'document_opens', {
    owner_id: 'user_ali',
    document_id: 'doc-diagram',
    last_opened_at: NOW - 200 * DAY,
    last_open_day: '2026-03-15',
  });
  put(db, 'share_links', {
    code: 'abcdefgh234567',
    document_id: 'doc-diagram',
    role: 'view',
    created_at: NOW - 10 * DAY,
  });
  put(db, 'shared_with', {
    owner_id: 'user_bo',
    document_id: 'doc-diagram',
    role: 'view',
    last_seen: NOW - 2 * DAY,
    share_code: 'abcdefgh234567',
  });

  // A mixed document in a team: a diagram, a slide whose tab window looks at the diagram, and a board with a card.
  putDocument(
    db,
    {
      id: 'doc-mixed',
      owner_id: 'user_ali',
      name: 'Launch',
      team_id: 'team1',
      items_rev: 1,
      items_next_key: 2,
    },
    [
      { id: 'td', name: 'Flow', body: { elements: [shape('a', 0, 0), shape('b', 200, 0)] } },
      {
        id: 'ts',
        name: 'Deck',
        body: {
          opensIn: 'pages',
          pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide-16-9' }],
          elements: [
            {
              ...shape('w1', 10, 20),
              shape: 'tab-window',
              windowTabId: 'td',
              width: 640,
              height: 360,
            },
          ],
        },
      },
      {
        id: 'tb',
        name: 'Board',
        body: {
          kind: 'board',
          opensIn: 'plan',
          elements: [{ ...shape('b1', 0, 0), shape: 'plan-board', planBoard: { columns: [] } }],
        },
      },
    ],
  );
  put(db, 'items', {
    document_id: 'doc-mixed',
    id: 'card1',
    type: 'task',
    item_key: 1,
    rank: 'a0',
    fields: JSON.stringify({ title: 'Ship it' }),
    rev: 1,
    created_at: NOW - 9 * DAY,
    updated_at: NOW - 9 * DAY,
    created_by: person('x', 'Ali'),
    updated_by: person('x', 'Ali'),
  });
  // The same code as doc-diagram's but for case: reported, not carried.
  put(db, 'share_links', {
    code: 'ABCDEFGH234567',
    document_id: 'doc-mixed',
    role: 'edit',
    level: 'participate',
    created_at: NOW - 5 * DAY,
  });
  put(db, 'share_links', {
    code: 'MIXEDTAB234567',
    document_id: 'doc-mixed',
    role: 'view',
    tab_id: 'tb',
    created_at: NOW - 5 * DAY,
    expiry: 'week',
    expires_at: NOW + 2 * DAY,
  });
  put(db, 'shared_with', {
    owner_id: 'user_cy',
    document_id: 'doc-mixed',
    role: 'edit',
    level: 'edit',
    last_seen: NOW - DAY,
    share_code: null,
  });

  // A guest's document, posted to Community.
  putDocument(db, { id: 'doc-guest', owner_id: GUEST_A, name: 'Fox notes' }, [
    {
      id: 'tg',
      body: {
        elements: [
          shape('g', 0, 0),
          { id: 'gp', type: 'image', x: 0, y: 100, width: 50, height: 50, imageId: 'img-2' },
        ],
      },
    },
  ]);
  put(db, 'share_links', {
    code: 'COMMUNITY23456',
    document_id: 'doc-guest',
    role: 'view',
    purpose: 'community',
    created_at: NOW - 7 * DAY,
  });
  put(db, 'community_posts', {
    id: 'post1',
    document_id: 'doc-guest',
    share_code: 'COMMUNITY23456',
    author_id: GUEST_A,
    title: 'Fox notes',
    description: 'Notes',
    category: 'other',
    tags: '["notes"]',
    search_text: 'fox notes notes',
    like_count: 1,
    copy_count: 1,
    published_at: NOW - 7 * DAY,
    updated_at: NOW - 7 * DAY,
    anonymous: 1,
  });
  put(db, 'community_post_tags', { post_id: 'post1', tag: 'notes' });
  put(db, 'community_likes', {
    post_id: 'post1',
    liker_key: 'liker-1',
    created_at: NOW - 6 * DAY,
    network_hash: null,
  });
  put(db, 'community_copies', {
    post_id: 'post1',
    copier_id: 'user_ali',
    created_at: NOW - 6 * DAY,
    network_hash: 'net-1',
  });
  put(db, 'community_reports', {
    post_id: 'post1',
    reporter_key: 'rep-1',
    network_hash: 'net-2',
    reason: 'spam',
    created_at: NOW - 6 * DAY,
  });

  // An aliased guest's document (Cy's now), and a slides-only document livedocuments keeps the id of.
  putDocument(db, { id: 'doc-alias', owner_id: GUEST_B, name: 'Was a guest' }, [
    {
      id: 'tx',
      body: {
        elements: [
          { id: 'i3', type: 'image', x: 0, y: 0, width: 10, height: 10, imageId: 'img-3' },
        ],
      },
    },
  ]);
  putDocument(db, { id: 'doc-slides', owner_id: 'user_ali', name: 'Pitch' }, [
    {
      id: 'tp',
      body: {
        opensIn: 'pages',
        pages: [{ id: 'p9', orientation: 'landscape', kind: 'slide', size: 'slide-16-9' }],
        elements: [],
      },
    },
  ]);

  // History: kept, an account event, one with no new kind, and one about a team's document.
  const event = (
    id: string,
    row: Record<string, string | number | null>,
    scopes: [string, string][],
  ) => {
    put(db, 'timeline_events', {
      id,
      dedupe_key: '',
      title: 'Event',
      description: null,
      snapshot: '{}',
      created_at: NOW - 9 * DAY,
      occurred_at: NOW - 9 * DAY,
      ...row,
    });
    for (const [type, scopeId] of scopes)
      put(db, 'timeline_event_scopes', {
        event_id: id,
        scope_type: type,
        scope_id: scopeId,
        added_at: NOW - 9 * DAY,
      });
  };
  event(
    'e1',
    {
      actor_id: 'user_ali',
      source_type: 'document',
      source_id: 'doc-diagram',
      event_type: 'document_created',
      snapshot: '{"actorName":"Ali"}',
    },
    [
      ['user', 'user_ali'],
      ['user', 'user_bo'],
    ],
  );
  event(
    'e2',
    { actor_id: 'user_bo', source_type: 'team', source_id: 'team1', event_type: 'team_joined' },
    [['team', 'team1']],
  );
  event(
    'e3',
    {
      actor_id: 'user_ali',
      source_type: 'document',
      source_id: 'doc-diagram',
      event_type: 'theme_created',
    },
    [['user', 'user_ali']],
  );
  event(
    'e4',
    {
      actor_id: GUEST_A,
      source_type: 'document',
      source_id: 'doc-mixed',
      event_type: 'document_edited',
      occurred_at: NOW - 8 * DAY,
    },
    [['document', 'doc-mixed']],
  );
  return db;
}
