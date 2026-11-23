// Writing and refreshing the published snapshot (docs/specs/030-knowledgebase/blueprints/publishing.md P4, P5, P10 to
// P14, P17 and P19), inside the knowledgebase's Durable Object. The public site reads only the `published_*` tables,
// so everything that may go public passes through here, and is built only from the saved writing: never a draft, a
// comment, a margin note, Page Health or an id.
//
// The refresh is lazy: a save marks its page (published-schema.ts triggers), and the next public read rewrites the
// pages marked, in one batch. A page links to another by the other's address, so each row keeps the paths it linked
// to (`links`); a page whose linked page moved, left or came back is drawn again even though its own writing did not
// change.
import {
  addressFrom,
  publishableScope,
  publishedWriting,
  RESERVED_PAGE_ADDRESSES,
  UNTITLED_PAGE,
  uniqueAddress,
  withoutEmptyPages,
  type PublishScope,
  type ScopePage,
} from '@liveknowledge/knowledge';
import {
  DEFAULT_KNOWLEDGE_STYLE,
  ensureMapGeometry,
  parseTabIcon,
  savedArticlesOf,
  type KnowledgeStyle,
  type Tab,
} from '@liveknowledge/document';
import { getTab } from '../db/tabs';
import { readDocumentMeta, readDocumentOutline } from '../document-room/document-content';
import { knowledgeDb } from '../knowledge/knowledge-db';
import { pageFlowOf } from '../knowledge/page-read';
import { getParticipants } from '../person/profiles';
import type { DocumentEnv, TabSummaryDTO } from '../types';
import {
  pageFigures,
  pageObjectsOf,
  publishedMediaPath,
  servablePictures,
  type PageFigures,
} from './published-media';

/** The outline's tabs as the scope reads them: no writing. */
export const scopePagesOf = (outline: { tabs: readonly TabSummaryDTO[] }): ScopePage[] =>
  outline.tabs.map((t) => ({
    id: t.id,
    name: t.name,
    parent: t.parent,
    knowledge: t.knowledge,
    connection: t.connection,
  }));

/** How many bodies a refresh reads at once. */
export const PUBLISH_RENDER_BATCH = 50;

/** The site's settings as stored. */
export type PublishedSiteRow = {
  address: string;
  root: string | null;
  noindex: boolean;
  showWriters: boolean;
  publishedBy: string;
  publishedAt: number;
  stale: boolean;
};

export type PublishSettings = Pick<
  PublishedSiteRow,
  'address' | 'root' | 'noindex' | 'showWriters'
>;

type SiteDbRow = {
  address: string;
  root: string | null;
  noindex: number;
  show_writers: number;
  published_by: string;
  published_at: number;
  stale: number;
};

/** The site's row, or null while nothing is published. */
export async function readSite(env: DocumentEnv): Promise<PublishedSiteRow | null> {
  const row = await knowledgeDb(env)
    .prepare(
      'SELECT address, root, noindex, show_writers, published_by, published_at, stale FROM published_site WHERE id = 1',
    )
    .first<SiteDbRow>();
  if (!row) return null;
  return {
    address: row.address,
    root: row.root,
    noindex: row.noindex === 1,
    showWriters: row.show_writers === 1,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    stale: row.stale === 1,
  };
}

/** The site addresses this knowledgebase holds at the registry, the current one included. */
export async function heldSiteAddresses(env: DocumentEnv): Promise<string[]> {
  const { results } = await knowledgeDb(env)
    .prepare('SELECT address FROM published_site_addresses ORDER BY held_at, address')
    .all<{ address: string }>();
  return results.map((r) => r.address);
}

/** The paths of the site as it stands (its front page, every page, its sitemap and search), for the edge purge. */
export async function publishedPaths(env: DocumentEnv): Promise<string[]> {
  const db = knowledgeDb(env);
  const [addresses, pages, media] = await Promise.all([
    heldSiteAddresses(env),
    db.prepare('SELECT address FROM published_pages').all<{ address: string }>(),
    db.prepare('SELECT DISTINCT image FROM published_media').all<{ image: string }>(),
  ]);
  const out: string[] = [];
  for (const site of addresses) {
    out.push(`/kb/${site}`, `/kb/${site}/sitemap.xml`);
    for (const p of pages.results) out.push(`/kb/${site}/${p.address}`);
    for (const m of media.results) out.push(publishedMediaPath(site, m.image));
  }
  return out;
}

/** Publish, or change what is published: the site's row, the address it now holds, every page drawn again. */
export async function writeSite(
  env: DocumentEnv,
  documentId: string,
  settings: PublishSettings,
  by: string,
  now: number,
): Promise<void> {
  const db = knowledgeDb(env);
  await db.batch([
    db
      .prepare(
        `INSERT INTO published_site (id, address, root, noindex, show_writers, published_by, published_at, stale)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, 1)
         ON CONFLICT (id) DO UPDATE SET address = excluded.address, root = excluded.root,
           noindex = excluded.noindex, show_writers = excluded.show_writers, published_by = excluded.published_by,
           published_at = excluded.published_at, stale = 1`,
      )
      .bind(
        settings.address,
        settings.root,
        settings.noindex ? 1 : 0,
        settings.showWriters ? 1 : 0,
        by,
        now,
      ),
    db
      .prepare('INSERT OR IGNORE INTO published_site_addresses (address, held_at) VALUES (?, ?)')
      .bind(settings.address, now),
    // Every page drawn again: what shows of a page (its writers) may have changed with the settings.
    db
      .prepare(
        'INSERT OR IGNORE INTO published_dirty (tab) SELECT tab_id FROM document_tabs WHERE document_id = ?',
      )
      .bind(documentId),
    db.prepare('DELETE FROM published_empty'),
  ]);
  await refreshPublished(env, documentId);
}

/** Unpublish: every published row goes, in one batch. */
export async function dropSite(env: DocumentEnv): Promise<void> {
  const db = knowledgeDb(env);
  await db.batch(
    [
      'published_site',
      'published_pages',
      'published_addresses',
      'published_site_addresses',
      'published_dirty',
      'published_empty',
      'published_fts',
      'published_media',
    ].map((table) => db.prepare(`DELETE FROM ${table}`)),
  );
}

type PageRow = { tab: string; address: string; links: string };

// The paths a page's writing linked to when it was drawn, by the linked page's tab: null where it was not a link.
type Links = Record<string, string | null>;

const parseLinks = (json: string): Links => {
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Links) : {};
  } catch {
    return {};
  }
};

type Drawn = {
  tab: string;
  html: string;
  text: string;
  description: string;
  title: string;
  icon: string | null;
  links: Links;
  savedAt: number;
  editors: string[];
  cover: string;
  media: ReadonlySet<string>;
};

// A page as the site draws it, from its saved writing, with its figures and cover (published-media.ts).
function draw(
  tab: Tab,
  hrefOf: (tabId: string) => string | null,
  savedAt: number,
  figures: PageFigures,
): Drawn {
  const flow = pageFlowOf(tab);
  const blocks = flow ? (savedArticlesOf(tab)[flow]?.blocks ?? []) : [];
  const links: Links = {};
  const writing = publishedWriting(
    blocks,
    (tabId) => {
      const to = hrefOf(tabId);
      links[tabId] = to;
      return to;
    },
    figures.figure,
  );
  const icon = parseTabIcon((tab as { icon?: unknown }).icon);
  return {
    tab: tab.id,
    html: writing.html,
    text: writing.text,
    description: writing.description,
    title: tab.name.trim() || UNTITLED_PAGE,
    icon: icon && 'emoji' in icon ? icon.emoji : null,
    links,
    savedAt,
    editors: [],
    cover: figures.cover,
    media: figures.media,
  };
}

// `base-2`, `base-3`: an address uniqueAddress made from `base`.
const isNumbered = (address: string, base: string): boolean => {
  if (!address.startsWith(`${base}-`)) return false;
  const n = address.slice(base.length + 1);
  return n.length > 0 && [...n].every((c) => c >= '0' && c <= '9');
};

/** The addresses the scope's pages take: each keeps its own while its title makes the same one; a page new to the
 *  site, or renamed, takes the first free one. Every address another page ever held stays that page's. */
function assignAddresses(
  scope: PublishScope,
  current: ReadonlyMap<string, string>,
  history: readonly { address: string; tab: string }[],
): Map<string, string> {
  const heldBy = new Map(history.map((h) => [h.address, h.tab]));
  const out = new Map<string, string>();
  const taken = new Set<string>(RESERVED_PAGE_ADDRESSES);
  for (const [address] of heldBy) taken.add(address);
  for (const page of scope.pages) {
    const base = addressFrom(page.name || UNTITLED_PAGE);
    const own = current.get(page.id);
    const keeps = own !== undefined && (own === base || isNumbered(own, base));
    if (keeps) {
      out.set(page.id, own);
      continue;
    }
    // An address this page held before (a title changed back) is its own again.
    const mine = heldBy.get(base) === page.id && !RESERVED_PAGE_ADDRESSES.has(base);
    const address = mine ? base : uniqueAddress(base, taken);
    taken.add(address);
    out.set(page.id, address);
  }
  return out;
}

/** Bring the snapshot up to the knowledgebase as it stands. Reads nothing more when nothing is marked. */
export async function refreshPublished(env: DocumentEnv, documentId: string): Promise<void> {
  const site = await readSite(env);
  if (!site) return;
  const db = knowledgeDb(env);
  const dirty = new Set(
    (await db.prepare('SELECT tab FROM published_dirty').all<{ tab: string }>()).results.map(
      (r) => r.tab,
    ),
  );
  if (!site.stale && dirty.size === 0) return;

  const [outline, meta] = await Promise.all([
    readDocumentOutline(env, documentId),
    readDocumentMeta(env, documentId),
  ]);
  const look: DrawLook = {
    site: site.address,
    style: meta?.knowledgeStyle ?? DEFAULT_KNOWLEDGE_STYLE,
  };
  const tabs = scopePagesOf(outline);
  const scope = publishableScope(tabs, site.root) ?? { pages: [], leftOut: [] };
  const [rowsRes, historyRes, emptyRes] = await db.batch([
    db.prepare('SELECT tab, address, links FROM published_pages'),
    db.prepare('SELECT address, tab FROM published_addresses'),
    db.prepare('SELECT tab FROM published_empty'),
  ]);
  const rows = new Map((rowsRes!.results as PageRow[]).map((r) => [r.tab, r]));
  const history = historyRes!.results as { address: string; tab: string }[];
  const knownEmpty = new Set(
    (emptyRes!.results as { tab: string }[]).map((r) => r.tab).filter((t) => !dirty.has(t)),
  );
  const addresses = assignAddresses(
    scope,
    new Map([...rows.values()].map((r) => [r.tab, r.address])),
    history,
  );
  const front = scope.pages.find((p) => !knownEmpty.has(p.id))?.id;
  const pathIn = (empty: ReadonlySet<string>, first: string | undefined) => (tabId: string) => {
    const address = addresses.get(tabId);
    if (address === undefined || empty.has(tabId)) return null;
    return tabId === first ? `/kb/${site.address}` : `/kb/${site.address}/${address}`;
  };

  // Draw what is marked or new, in batches of bodies.
  const drawn = new Map<string, Drawn>();
  const firstPass = pathIn(knownEmpty, front);
  const due = scope.pages
    .map((p) => p.id)
    .filter((id) => dirty.has(id) || (!rows.has(id) && !knownEmpty.has(id)));
  await drawPages(env, documentId, due, firstPass, look, drawn);

  // The pages found empty leave the site, and their subpages move up.
  const empty = new Set(knownEmpty);
  for (const d of drawn.values()) {
    if (d.text) empty.delete(d.tab);
    else empty.add(d.tab);
  }
  const final = withoutEmptyPages(scope, empty);
  const finalFront = final.pages[0]?.id;
  const finalPath = pathIn(empty, finalFront);
  // A page whose links now point elsewhere (a linked page moved, left, came back, or became the front page) is drawn
  // again.
  const relink = final.pages
    .map((p) => p.id)
    .filter((id) => {
      const links = drawn.get(id)?.links ?? parseLinks(rows.get(id)?.links ?? '{}');
      return Object.entries(links).some(([tab, to]) => finalPath(tab) !== to);
    });
  await drawPages(env, documentId, relink, finalPath, look, drawn);

  if (site.showWriters) await nameWriters(env, [...drawn.values()]);

  const keep = new Set(final.pages.map((p) => p.id));
  const statements: D1PreparedStatement[] = [];
  for (const tab of rows.keys())
    if (!keep.has(tab))
      statements.push(
        db.prepare('DELETE FROM published_pages WHERE tab = ?').bind(tab),
        db.prepare('DELETE FROM published_fts WHERE tab = ?').bind(tab),
        db.prepare('DELETE FROM published_media WHERE tab = ?').bind(tab),
      );
  final.pages.forEach((page, position) => {
    const address = addresses.get(page.id)!;
    statements.push(
      db
        .prepare('INSERT OR IGNORE INTO published_addresses (address, tab) VALUES (?, ?)')
        .bind(address, page.id),
    );
    const d = drawn.get(page.id);
    if (!d) {
      statements.push(
        db
          .prepare('UPDATE published_pages SET address = ?, parent = ?, position = ? WHERE tab = ?')
          .bind(address, page.parent, position, page.id),
      );
      return;
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO published_pages (tab, address, parent, position, title, icon, description, html, text, writers,
                                        saved_at, links, cover)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
           ON CONFLICT (tab) DO UPDATE SET address = excluded.address, parent = excluded.parent,
             position = excluded.position, title = excluded.title, icon = excluded.icon,
             description = excluded.description, html = excluded.html, text = excluded.text,
             writers = excluded.writers, saved_at = excluded.saved_at, links = excluded.links,
             cover = excluded.cover`,
        )
        .bind(
          page.id,
          address,
          page.parent,
          position,
          d.title,
          d.icon,
          d.description,
          d.html,
          d.text,
          JSON.stringify(d.editors),
          d.savedAt,
          JSON.stringify(d.links),
          d.cover,
        ),
      db.prepare('DELETE FROM published_fts WHERE tab = ?').bind(page.id),
      db
        .prepare('INSERT INTO published_fts (tab, title, text) VALUES (?, ?, ?)')
        .bind(page.id, d.title, d.text),
      // The pictures this drawing places, and no others (P32).
      db.prepare('DELETE FROM published_media WHERE tab = ?').bind(page.id),
      ...[...d.media].map((image) =>
        db
          .prepare('INSERT OR IGNORE INTO published_media (image, tab) VALUES (?, ?)')
          .bind(image, page.id),
      ),
    );
  });
  statements.push(db.prepare('DELETE FROM published_empty'));
  for (const tab of empty)
    statements.push(db.prepare('INSERT OR IGNORE INTO published_empty (tab) VALUES (?)').bind(tab));
  for (const tab of dirty)
    statements.push(db.prepare('DELETE FROM published_dirty WHERE tab = ?').bind(tab));
  statements.push(db.prepare('UPDATE published_site SET stale = 0'));
  await db.batch(statements);
  console.info('[publishing] refresh', {
    documentId,
    rendered: drawn.size,
    removed: [...rows.keys()].filter((t) => !keep.has(t)).length,
  });
}

// The site's address and the knowledgebase's style, which a page's figures and cover are drawn in.
type DrawLook = { site: string; style: KnowledgeStyle };

// Read and draw `ids`, PUBLISH_RENDER_BATCH bodies at a time, into `drawn`. A page gone since the outline is skipped.
// Each batch asks once which of its pictures the knowledgebase may serve (P32).
async function drawPages(
  env: DocumentEnv,
  documentId: string,
  ids: readonly string[],
  hrefOf: (tabId: string) => string | null,
  look: DrawLook,
  drawn: Map<string, Drawn>,
): Promise<void> {
  for (let i = 0; i < ids.length; i += PUBLISH_RENDER_BATCH) {
    const batch = ids.slice(i, i + PUBLISH_RENDER_BATCH);
    const [tabs, saved] = await Promise.all([
      Promise.all(batch.map((id) => getTab(env, documentId, id))),
      savedTimes(env, batch),
    ]);
    const pages = tabs.flatMap((tab) =>
      tab ? [{ ...pageObjectsOf(tab), updatedAt: tab.updatedAt }] : [],
    );
    const [servable] = await Promise.all([
      servablePictures(env, documentId, pages),
      // A map's land, loaded only when a figure holds one.
      ...pages.flatMap((p) => [...p.zones.values()].map((zone) => ensureMapGeometry(zone.members))),
    ]);
    for (const objects of pages) {
      const { tab } = objects;
      drawn.set(
        tab.id,
        draw(
          tab,
          hrefOf,
          saved.get(tab.id) ?? objects.updatedAt,
          pageFigures(objects, look, servable),
        ),
      );
    }
  }
}

// When each page's saved writing last changed (a person's or an agent's save, page_authors), not a draft's autosave.
async function savedTimes(env: DocumentEnv, tabs: readonly string[]): Promise<Map<string, number>> {
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT tab, updated_at AS at FROM page_authors WHERE tab IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(tabs))
    .all<{ tab: string; at: number }>();
  return new Map(results.map((r) => [r.tab, r.at]));
}

// The names of the people who wrote each drawn page (P14): people only, the first first; never an agent, an id or an
// email. A name that cannot be read is left out.
async function nameWriters(env: DocumentEnv, pages: Drawn[]): Promise<void> {
  if (pages.length === 0) return;
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT tab, by FROM page_editors WHERE kind = 'human' AND tab IN (SELECT value FROM json_each(?))
        ORDER BY first_at, who`,
    )
    .bind(JSON.stringify(pages.map((p) => p.tab)))
    .all<{ tab: string; by: string }>();
  const rows = results;
  const people = await getParticipants(env, [...new Set(rows.map((r) => r.by))]);
  const byTab = new Map(pages.map((p) => [p.tab, p]));
  for (const row of rows) {
    const name = people.get(row.by)?.name?.trim();
    const page = byTab.get(row.tab)!;
    if (name && !page.editors.includes(name)) page.editors.push(name);
  }
}
