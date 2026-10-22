// The app routes (`/api/community/app/*`, liveworkspace/docs/community.md "The API"): what only an app's
// own Worker may do, for the people it has signed in and the documents it holds. Publishing, Edit
// Listing and removing a post; keeping each post's document state in step; My Shares; and counting
// copies. Each request names its app (X-Community-App) and carries that app's key as a bearer token.
// The app has already checked what only it can: that the caller owns the document, that the document
// may be published (not empty, not a team library's, no share password).

import {
  COMMUNITY_APP_HEADER,
  COMMUNITY_KEY_HEADER,
  COMMUNITY_POSTS_PER_AUTHOR,
  COMMUNITY_SYNC_MAX,
  isCommunityApp,
  isCommunityDocumentState,
  isCommunityKey,
  parseCommunityListQuery,
  validateCommunityPostInput,
  type CommunityApp,
  type CommunityAppPost,
  type CommunityAppPublish,
  type CommunityAppSync,
  type CommunityAuthor,
  type CommunityMinePost,
} from '@liveworkspace/community';
import { MAX_BODY_BYTES } from './config';
import { forgetCopier, mergeCopier, recordCopy } from './engagement';
import { appKey, type Env } from './env';
import { badRequest, conflict, json, noContent, notFound } from './http';
import { networkHash } from './network';
import {
  countPostsByOwner,
  createPost,
  deletePost,
  getPostForDocument,
  listHiddenSince,
  listPosts,
  mineTotals,
  syncDocuments,
  updatePost,
} from './posts';
import { withLikes } from './public-routes';
import { rowState, rowToPost, type PostRow } from './rows';
import { timingSafeEqual } from './timing-safe';

// Ids from an app (documents, owners, copier hashes, share codes): opaque, but bounded.
const ID_MAX = 200;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;

// The app this request speaks for, or null when it doesn't carry that app's key.
async function callerApp(request: Request, env: Env): Promise<CommunityApp | null> {
  const app = request.headers.get(COMMUNITY_APP_HEADER);
  if (!isCommunityApp(app)) return null;
  const expected = appKey(env, app);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

function appPost(row: PostRow, owner: string): CommunityAppPost {
  return { ...rowToPost(row, false), state: rowState(row), own: row.owner === owner };
}

export async function handleApp(
  request: Request,
  env: Env,
  url: URL,
  path: string,
): Promise<Response> {
  const app = await callerApp(request, env);
  if (!app) return json({ error: 'unauthorized' }, { status: 401 });
  const segments = path.split('/').filter(Boolean);
  const method = request.method;

  // /app/documents/<document>: the post a document has.
  if (segments[0] === 'documents' && segments.length === 2 && isId(segments[1])) {
    const document = segments[1];
    if (method === 'GET' || method === 'DELETE') {
      const owner = url.searchParams.get('owner');
      if (!isId(owner)) return badRequest('invalid_owner');
      const found = await getPostForDocument(env, app, document);
      if (method === 'GET') return json({ post: found ? appPost(found, owner) : null });
      // Only its author removes a post, and never one hidden after reports: removing it would clear its
      // reports and let the same document be published again.
      if (!found || found.owner !== owner) return notFound();
      if (rowState(found) === 'hidden') return conflict('post_hidden');
      await deletePost(env, found.id);
      console.log('[community] removed', { app, postId: found.id });
      return noContent();
    }
    if (method === 'PUT') return publish(request, env, app, document);
  }

  if (segments.length === 1 && method === 'POST' && segments[0] === 'sync') {
    const body = await readJson(request);
    const sync = parseSync(body);
    if (!sync) return badRequest('invalid_sync');
    await syncDocuments(env, app, sync);
    return noContent();
  }

  if (segments.length === 1 && method === 'GET' && segments[0] === 'hidden') {
    const since = Number(url.searchParams.get('since') ?? 0);
    if (!Number.isFinite(since) || since < 0) return badRequest('invalid_since');
    return json({ hidden: await listHiddenSince(env, app, since) });
  }

  // My Shares, for an owner the app has signed in: personal, so never cached.
  if (segments.length === 1 && method === 'GET' && segments[0] === 'mine') {
    const owner = url.searchParams.get('owner');
    if (!isId(owner)) return badRequest('invalid_owner');
    const query = parseCommunityListQuery(url.searchParams);
    if (!query.ok) return badRequest('invalid_query');
    const [{ rows, nextOffset }, totals] = await Promise.all([
      listPosts(env, app, query.value, owner),
      mineTotals(env, app, owner),
    ]);
    // The app passes on its page's community key, so the hearts show as that browser left them.
    const key = request.headers.get(COMMUNITY_KEY_HEADER);
    const liked = await withLikes(env, isCommunityKey(key) ? key : null, rows);
    const posts: CommunityMinePost[] = rows.map((row, i) => ({
      ...liked[i]!,
      state: rowState(row),
      documentId: row.document,
    }));
    return json(
      { posts, nextOffset, totals },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (segments.length === 1 && method === 'POST' && segments[0] === 'copies') {
    const body = (await readJson(request)) as Record<string, unknown> | null;
    if (!body || !isId(body.document) || !isId(body.copier) || typeof body.ip !== 'string')
      return badRequest('invalid_copy');
    const post = await getPostForDocument(env, app, body.document);
    if (!post) return notFound();
    await recordCopy(env, post.id, body.copier, await networkHash(post.id, body.ip));
    return noContent();
  }

  if (segments[0] === 'copiers' && segments.length === 2 && method === 'POST') {
    const body = (await readJson(request)) as Record<string, unknown> | null;
    if (segments[1] === 'forget') {
      if (!body || !isId(body.copier)) return badRequest('invalid_copier');
      await forgetCopier(env, app, body.copier);
      return noContent();
    }
    if (segments[1] === 'merge') {
      if (!body || !isId(body.from) || !isId(body.to)) return badRequest('invalid_copier');
      await mergeCopier(env, app, body.from, body.to);
      return noContent();
    }
  }

  return notFound();
}

// PUT /app/documents/<document>: publish, or save an Edit Listing.
async function publish(
  request: Request,
  env: Env,
  app: CommunityApp,
  document: string,
): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown> | null;
  if (!body) return badRequest('invalid_body');
  const parsed = validateCommunityPostInput(body.input);
  if (!parsed.ok) return badRequest(parsed.error);
  const author = parseAuthor(body.author);
  if (
    !isId(body.owner) ||
    !isId(body.shareCode) ||
    !isCommunityDocumentState(body.documentState) ||
    !author
  ) {
    return badRequest('invalid_body');
  }
  const input: CommunityAppPublish = {
    owner: body.owner,
    shareCode: body.shareCode,
    documentState: body.documentState,
    author,
    input: parsed.value,
  };

  const found = await getPostForDocument(env, app, document);
  if (found && found.owner === input.owner) {
    if (body.create === true) return conflict('already_published');
    // Hidden after reports is final: nobody reviews it, so its author can't edit it either.
    if (rowState(found) === 'hidden') return conflict('post_hidden');
    await updatePost(env, found.id, input);
    console.log('[community] updated', { app, postId: found.id });
    const row = await getPostForDocument(env, app, document);
    return json({ post: appPost(row!, input.owner) });
  }

  if ((await countPostsByOwner(env, app, input.owner)) >= COMMUNITY_POSTS_PER_AUTHOR) {
    return conflict('post_limit');
  }
  // A post its document's previous owner made (the document left a team library for another
  // member's) is not this owner's: publishing replaces it.
  if (found) {
    await deletePost(env, found.id);
    console.log('[community] replaced a previous owner post', { app, postId: found.id });
  }
  let postId: string;
  try {
    postId = await createPost(env, app, document, input);
  } catch (err) {
    // Two first publishes of one document at once: the second meets the one-post-per-document rule.
    if (String(err).includes('UNIQUE')) return conflict('already_published');
    throw err;
  }
  console.log('[community] published', { app, postId, category: input.input.category });
  const row = await getPostForDocument(env, app, document);
  return json({ post: appPost(row!, input.owner) }, { status: 201 });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

// How the author is shown: a name, a colour and maybe a picture, all bounded.
const NAME_MAX = 80;
const COLOR = /^#[0-9a-f]{6}$/i;
const PICTURE_MAX = 2048;

function parseAuthor(value: unknown): CommunityAuthor | null {
  const author = value as Partial<CommunityAuthor> | null;
  if (!author || typeof author.name !== 'string' || typeof author.color !== 'string') return null;
  const name = author.name.trim().slice(0, NAME_MAX);
  if (!name || !COLOR.test(author.color)) return null;
  const picture =
    typeof author.picture === 'string' &&
    author.picture.startsWith('https://') &&
    author.picture.length <= PICTURE_MAX
      ? author.picture
      : null;
  return { name, color: author.color, picture };
}

function parseSync(value: unknown): CommunityAppSync | null {
  const body = value as Partial<CommunityAppSync> | null;
  if (!body || !Array.isArray(body.documents) || !Array.isArray(body.gone)) return null;
  if (body.documents.length + body.gone.length > COMMUNITY_SYNC_MAX) return null;
  for (const entry of body.documents as unknown[]) {
    const e = entry as { document?: unknown; state?: unknown } | null;
    if (!e || !isId(e.document) || !isCommunityDocumentState(e.state)) return null;
  }
  if (!(body.gone as unknown[]).every(isId)) return null;
  return { documents: body.documents, gone: body.gone };
}
