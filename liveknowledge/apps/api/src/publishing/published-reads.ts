// What the public site asks of a knowledgebase (docs/specs/030-knowledgebase/blueprints/publishing.md "Interfaces and
// contracts", P15, P20, P23, P26), answered inside its Durable Object from the published snapshot alone. Each read
// names the columns it takes, all of them public ones: never `published_by`, `held_at`, a row's `links` or a tab id.
// The knowledgebase's name and Style are the only fields read from outside the snapshot.
import { subscriptionClientOf } from '@liveworkspace/subscription';
import {
  ftsExpression,
  searchTerms,
  SEARCH_MAX_RESULTS,
  type SiteSearchResult,
  type SiteTreeEntry,
} from '@liveknowledge/knowledge';
import type { KnowledgeStyle } from '@liveknowledge/document';
import { readDocumentMeta } from '../document-room/document-content';
import { knowledgeDb } from '../knowledge/knowledge-db';
import { servableImageIds } from '../db/image-grants';
import type { DocumentEnv } from '../types';
import { siteServes } from './published-gauge';
import { readSite, refreshPublished } from './published-snapshot';

export type PublishedRead =
  | { kind: 'page'; address: string | null }
  | { kind: 'search'; query: string }
  | { kind: 'sitemap' }
  | { kind: 'media'; imageId: string };

/** The site as every public answer carries it. */
export type PublishedSiteAnswer = {
  address: string;
  name: string;
  style: KnowledgeStyle;
  noindex: boolean;
  tree: SiteTreeEntry[];
};

export type PublishedPageAnswer = {
  address: string;
  title: string;
  icon: string | null;
  html: string;
  description: string;
  savedAt: number;
  writers: string[];
  /** The cover band as drawn (P33); '' for none. */
  cover: string;
};

export type PublishedAnswer =
  | { status: 'none' }
  | { status: 'moved'; address: string | null }
  // A picture a published page places, which the knowledgebase may serve (P35).
  | { status: 'media' }
  | {
      status: 'ok';
      site: PublishedSiteAnswer;
      page?: PublishedPageAnswer;
      results?: SiteSearchResult[];
      savedAt?: Record<string, number>;
    };

type TreeRow = { address: string; title: string; icon: string | null; parent: string | null };
type PageRow = Omit<PublishedPageAnswer, 'writers'> & { writers: string };

const TITLE_WEIGHT = 10;

/** Whether a picture may be fetched from the public site (P35): a page still in the snapshot places it
 *  (`published_media`, written as the page was drawn), and the knowledgebase may still serve it. The request names
 *  only the picture; nothing it carries is trusted. */
async function servesPublishedPicture(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
): Promise<boolean> {
  const placed = await knowledgeDb(env)
    .prepare(
      `SELECT 1 AS placed FROM published_media m JOIN published_pages p ON p.tab = m.tab
        WHERE m.image = ? AND EXISTS (SELECT 1 FROM published_site) LIMIT 1`,
    )
    .bind(imageId)
    .first<{ placed: number }>();
  if (!placed) return false;
  return (await servableImageIds(env, documentId, [imageId])).has(imageId);
}

/** One public read: the snapshot brought up to date first, then answered from it. */
export async function readPublished(
  env: DocumentEnv,
  documentId: string,
  read: PublishedRead,
): Promise<PublishedAnswer> {
  try {
    await refreshPublished(env, documentId);
  } catch (error) {
    // The snapshot as it stands is still what was published: answer from it, and try again on the next read.
    console.warn('[publishing] refresh_failed', { documentId, error: String(error) });
  }
  if (read.kind === 'media')
    return (await servesPublishedPicture(env, documentId, read.imageId))
      ? { status: 'media' }
      : { status: 'none' };
  const site = await readSite(env);
  if (!site) return { status: 'none' };
  // With Pro on, a site answers only while it holds a counted place of its owner's Public Knowledgebases (spec
  // "Tiers"): one whose place was refused is the same not-found as any other miss. One mark read, no call.
  if (!siteServes({ on: subscriptionClientOf(env, 'liveknowledge.app').enabled }, site.counted))
    return { status: 'none' };
  const db = knowledgeDb(env);
  const [meta, treeRes] = await Promise.all([
    readDocumentMeta(env, documentId),
    db
      .prepare(
        `SELECT p.address AS address, p.title AS title, p.icon AS icon, parent.address AS parent
           FROM published_pages p LEFT JOIN published_pages parent ON parent.tab = p.parent
          ORDER BY p.position`,
      )
      .all<TreeRow>(),
  ]);
  const tree = treeRes.results;
  if (!meta || tree.length === 0) return { status: 'none' };
  const answer: PublishedSiteAnswer = {
    address: site.address,
    name: meta.name.trim() || 'Untitled Knowledgebase',
    style: meta.knowledgeStyle,
    noindex: site.noindex,
    tree,
  };
  if (read.kind === 'sitemap') {
    const { results } = await db
      .prepare('SELECT address, saved_at AS savedAt FROM published_pages')
      .all<{ address: string; savedAt: number }>();
    return {
      status: 'ok',
      site: answer,
      savedAt: Object.fromEntries(results.map((r) => [r.address, r.savedAt])),
    };
  }
  if (read.kind === 'search') {
    const match = ftsExpression(searchTerms(read.query), 'all');
    if (!match) return { status: 'ok', site: answer, results: [] };
    const { results } = await db
      .prepare(
        `SELECT p.address AS address, p.title AS title,
                snippet(published_fts, 2, char(2), char(3), '…', 24) AS snippet
           FROM published_fts JOIN published_pages p ON p.tab = published_fts.tab
          WHERE published_fts MATCH ?
          ORDER BY bm25(published_fts, 0.0, ${TITLE_WEIGHT}.0, 1.0), p.position
          LIMIT ?`,
      )
      .bind(match, SEARCH_MAX_RESULTS)
      .all<SiteSearchResult>();
    return { status: 'ok', site: answer, results };
  }
  // A page by its address; the front page by none.
  const front = tree[0]!.address;
  const address = read.address ?? front;
  const page = await db
    .prepare(
      `SELECT address, title, icon, html, description, saved_at AS savedAt, writers, cover
         FROM published_pages WHERE address = ?`,
    )
    .bind(address)
    .first<PageRow>();
  if (page) {
    // The front page is read at the site's own address (P15).
    if (read.kind === 'page' && read.address === front) return { status: 'moved', address: null };
    return {
      status: 'ok',
      site: answer,
      page: { ...page, writers: site.showWriters ? (JSON.parse(page.writers) as string[]) : [] },
    };
  }
  // An address the page had before it was renamed (P5).
  const moved = await db
    .prepare(
      `SELECT p.address AS address FROM published_addresses a JOIN published_pages p ON p.tab = a.tab
        WHERE a.address = ?`,
    )
    .bind(address)
    .first<{ address: string }>();
  if (moved) return { status: 'moved', address: moved.address === front ? null : moved.address };
  return { status: 'none' };
}
