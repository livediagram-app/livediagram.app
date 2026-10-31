// `/api/documents/<id>/community`: the owner's side of an app's Community (liveworkspace/docs/specs/007-community/
// community.md "The Share dialog's Community tab", "App routes"). GET reads the document's post, PUT publishes it or
// saves an Edit Listing, DELETE removes it from the Community. The post itself is kept by the service; this checks
// whether the document may be published, makes the community link that opens it (an index share link, view, never
// expiring) and keeps it with the document (./post). Every app's api answers it the same way: the app first finds the
// document and checks the caller owns it, then hands over here with what only it knows.

import { COMMUNITY_UNKNOWN_AUTHOR, type CommunityAuthor } from '../authors';
import { validateCommunityPostInput, type CommunityOwnPost } from '../post';
import type { CommunityAppPost } from '../service';
import type { CommunityAppClient, CommunityAppEnv } from './client';
import {
  deleteCommunityPost,
  readCommunityPost,
  saveCommunityPost,
  updateCommunityPost,
  type CommunityDocumentMeta,
  type CommunityIndex,
  type CommunityPostDb,
} from './post';

// The app's response makers (@liveworkspace/api-kit createResponses), so answers carry its CORS headers.
export type CommunityResponses = {
  json: (body: unknown, init?: ResponseInit) => Response;
  notFound: () => Response;
  noContent: () => Response;
  conflict: (reason: string) => Response;
  signInRequired: () => Response;
};

export type CommunityOwnerRequest = {
  request: Request;
  documentId: string;
  env: CommunityAppEnv;
  service: CommunityAppClient;
  // The document's own SQLite, where its post is kept.
  db: CommunityPostDb;
  // The document, which the app has checked the caller owns.
  doc: CommunityDocumentMeta;
  // The caller's verified signed-in account (never a guest id or an API token), or null.
  accountUserId: string | null;
  // The index as the caller; null when there is none.
  index: CommunityIndex | null;
  // How the owner is shown on a post that is not anonymous (communityAuthorOf).
  author: (ownerId: string) => Promise<CommunityAuthor>;
  // Something to show: the first tab's first page has at least one element. Counted, not rendered.
  hasSomethingToShow: () => Promise<boolean>;
  responses: CommunityResponses;
  now?: () => number;
};

function ownPost(post: CommunityAppPost): CommunityOwnPost {
  const { own: _own, ...rest } = post;
  return rest;
}

// How the owner is shown on a post that is not anonymous: their participant name and colour, as the app knows them
// (no picture: accounts have none).
export async function communityAuthorOf(
  participant: { name: string; color: string } | null,
): Promise<CommunityAuthor> {
  if (!participant) return COMMUNITY_UNKNOWN_AUTHOR;
  return {
    name: participant.name,
    color: /^#[0-9a-f]{6}$/i.test(participant.color)
      ? participant.color
      : COMMUNITY_UNKNOWN_AUTHOR.color,
    picture: null,
  };
}

// The methods the route answers; anything else is not this route.
export function isCommunityOwnerMethod(method: string): boolean {
  return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

export async function answerCommunityOwner(req: CommunityOwnerRequest): Promise<Response> {
  const { request, documentId: id, env, service, db, doc, index, responses: r } = req;
  const now = req.now ?? Date.now;
  const method = request.method;
  if (!index) return r.json({ error: 'index_unavailable' }, { status: 503 });

  const reject = (response: Response, code: string): Response => {
    console.warn(`[community] rejected ${code}`);
    return response;
  };
  // The service's refusals the editor knows by code pass through as they are.
  const passThrough = async (res: Response): Promise<Response> => {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    const code = body?.error ?? 'community_unavailable';
    console.warn(`[community] rejected ${code}`);
    return r.json({ error: code }, { status: res.status >= 500 ? 502 : res.status });
  };
  // The community link's index share link, removed. Best effort: a link left behind opens nothing as a post (the
  // document no longer keeps it), and its owner can remove it in the Share dialog.
  const revokeLink = async (code: string): Promise<void> => {
    try {
      await index.revokeShareLink(code);
    } catch (err) {
      console.warn('[community] link not removed', { error: String(err) });
    }
  };

  // A post made by a previous owner (the document left a team library for another member's) is not this owner's: it
  // reads as none, and publishing replaces it.
  const found = await service.getPost(env, id, doc.ownerId);
  const existing = found?.own ? found : null;

  if (method === 'GET') return r.json({ post: existing ? ownPost(existing) : null });

  // A post hidden by reports is final: nobody reviews it, so its author can neither edit it nor remove it. The
  // service refuses both; this says so first.
  const hidden = existing?.state === 'hidden';

  if (method === 'DELETE') {
    if (!existing) return r.notFound();
    if (hidden) return reject(r.conflict('post_hidden'), 'post_hidden');
    const res = await service.removePost(env, id, doc.ownerId);
    if (!res.ok && res.status !== 404) return passThrough(res);
    await revokeLink(existing.shareCode);
    await deleteCommunityPost(db);
    console.log('[community] removed', { postId: existing.id });
    return r.noContent();
  }

  // PUT: publish, or save an Edit Listing.
  // Every public post is tied to an account, so publishing needs a verified signed-in session (never a guest id or an
  // API token), and a team library document is not one person's to give away.
  const owner = req.accountUserId;
  if (!owner || owner !== doc.ownerId) return reject(r.signInRequired(), 'sign_in_required');
  if (doc.teamId) return reject(r.conflict('team_document'), 'team_document');
  const parsed = validateCommunityPostInput(
    await request.json().catch(() => null),
    service.app,
  );
  if (!parsed.ok) return reject(r.json({ error: parsed.error }, { status: 400 }), parsed.error);
  // A share password and a post exclude each other.
  const sharing = await index.listShareLinks(id);
  if (sharing.passwordSet) return reject(r.conflict('share_password_set'), 'share_password_set');
  if (hidden) return reject(r.conflict('post_hidden'), 'post_hidden');
  const author = await req.author(owner);

  if (existing) {
    const res = await service.publishPost(env, id, {
      owner,
      shareCode: existing.shareCode,
      documentState: 'public',
      author,
      input: parsed.value,
    });
    if (!res.ok) return passThrough(res);
    const { post } = (await res.json()) as { post: CommunityAppPost };
    // A post the document has no row for (published before its document kept its own) is kept now.
    if (await readCommunityPost(db)) await updateCommunityPost(db, post);
    else
      await saveCommunityPost(
        db,
        {
          shareCode: post.shareCode,
          authorId: owner,
          postId: post.id,
          title: post.title,
          anonymous: post.anonymous,
        },
        now(),
      );
    console.log('[community] updated', { postId: post.id });
    return r.json({ post: ownPost(post) });
  }

  // Something to show. Counted, not rendered: a deploy without the snapshot store can still publish. The per-author
  // cap is the service's: it counts the posts.
  if (!(await req.hasSomethingToShow())) return reject(r.conflict('empty_document'), 'empty_document');
  // One post per document: a post already kept here (a previous owner's) gives way to this one.
  const previous = await readCommunityPost(db);
  // The community link is made at the index first (its code is the post's), and removed again when the service
  // refuses the post, so a refusal leaves nothing behind. A public link: should the document later take a share
  // password, it closes (404) rather than ask visitors for one.
  const { link } = await index.createShareLink(id, { level: 'view', expiry: 'never', public: true });
  const shareCode = link.code;
  const res = await service.publishPost(env, id, {
    owner,
    shareCode,
    documentState: 'public',
    author,
    input: parsed.value,
    create: true,
  });
  if (!res.ok) {
    await revokeLink(shareCode);
    return passThrough(res);
  }
  const { post } = (await res.json()) as { post: CommunityAppPost };
  // Runs inside the document's Durable Object, one request at a time per write: two first publishes cannot both get
  // here with no post kept.
  await saveCommunityPost(
    db,
    { shareCode, authorId: owner, postId: post.id, title: post.title, anonymous: post.anonymous },
    now(),
  );
  if (previous && previous.shareCode !== shareCode) await revokeLink(previous.shareCode);
  console.log('[community] published', { postId: post.id, category: parsed.value.category });
  return r.json({ post: ownPost(post) }, { status: 201 });
}
