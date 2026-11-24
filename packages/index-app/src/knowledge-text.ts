// An item's indexable text (liveworkspace/docs/specs/004-index/knowledge-sources.md "What each app gives"): the plain
// words a knowledgebase may answer from, read out of the item's whole-item file, never its storage. One walker for
// every canvas app (livediagram, livedocuments, livedesign, livehuddle) and one for a plan's cards (liveplanner),
// each bounded by the door's caps, so the answer never outgrows what a knowledgebase keeps of a source.
//
// Linear in the file: each element, block and card is read once, each string at most once, and the walk stops at the
// caps. No regex over user text backtracks: whitespace is folded with a single character class.

import {
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_CHUNK_TITLE_MAX,
  KNOWLEDGE_CHUNKS_PER_SOURCE,
  KNOWLEDGE_PLACE_ELEMENTS_MAX,
  KNOWLEDGE_SOURCE_MAX_CHARS,
  type KnowledgeChunk,
  type KnowledgePlace,
} from '@liveworkspace/index-client';

// The keys whose string values are words a person wrote on an element: its label, text and notes, a page's title,
// a caption, an image's alt text, a field's name and value.
const TEXT_KEYS = new Set([
  'label',
  'text',
  'note',
  'notes',
  'title',
  'pageTitle',
  'pageSubtitle',
  'caption',
  'description',
  'alt',
  'name',
  'fn',
]);
// Keys that never hold words: styles, ids, geometry, images and links. Their subtrees are not walked.
const SKIP_KEYS = new Set([
  'id',
  'points',
  'style',
  'href',
  'src',
  'imageId',
  'iconId',
  'liveItem',
  'livePoster',
  'connection',
  'sheetSource',
  'automations',
]);
// How deep and how wide one element's walk goes: a deeply nested or huge element gives its first words only.
const WALK_DEPTH_MAX = 8;
const WALK_NODES_MAX = 2_000;
// One string's longest read: a long text is cut, never read whole into a chunk it could not fit.
const STRING_READ_MAX = KNOWLEDGE_CHUNK_MAX_CHARS * 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Whitespace folded to single spaces, ends trimmed. A data URL or a bare address is no words.
export function plainWords(value: string): string {
  const text = value.slice(0, STRING_READ_MAX).replace(/\s+/g, ' ').trim();
  if (text.startsWith('data:') || /^https?:\/\/\S*$/.test(text)) return '';
  return text;
}

// The words of one element (or one article block), in the order its fields hold them. A rich text's runs (`runs`,
// `richText`) are joined without spaces, as they draw.
export function elementWords(element: unknown): string {
  const words: string[] = [];
  let nodes = 0;
  const walk = (value: unknown, depth: number): void => {
    if (depth > WALK_DEPTH_MAX || nodes >= WALK_NODES_MAX) return;
    nodes++;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue;
      if ((key === 'runs' || key === 'richText') && Array.isArray(child)) {
        const joined = child
          .map((run) => (isRecord(run) && typeof run.text === 'string' ? run.text : ''))
          .join('');
        const text = plainWords(joined);
        if (text) words.push(text);
        continue;
      }
      if (typeof child === 'string') {
        if (!TEXT_KEYS.has(key)) continue;
        const text = plainWords(child);
        if (text) words.push(text);
        continue;
      }
      if (typeof child === 'object' && child !== null) walk(child, depth + 1);
    }
  };
  walk(element, 0);
  // A label repeated in its rich text reads once.
  return [...new Set(words)].join(' ');
}

// One run of words and the element it came from (null for an article's writing).
type Piece = { elementId: string | null; text: string };

// Cut at the last space within `max`, so a word is never split.
function cutWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return (space > max / 2 ? text.slice(0, space) : text.slice(0, max)).trimEnd();
}

// Gathers chunks under the door's caps: each at most the chunk cap, the source at most its chunk count and
// characters. `full` turns true once a cap is reached, and the walkers stop.
export class ChunkBudget {
  readonly chunks: KnowledgeChunk[] = [];
  private chars = 0;

  get full(): boolean {
    return (
      this.chunks.length >= KNOWLEDGE_CHUNKS_PER_SOURCE || this.chars >= KNOWLEDGE_SOURCE_MAX_CHARS
    );
  }

  add(ref: string, title: string, text: string, place: KnowledgePlace): void {
    if (this.full) return;
    const room = Math.min(KNOWLEDGE_CHUNK_MAX_CHARS, KNOWLEDGE_SOURCE_MAX_CHARS - this.chars);
    const kept = cutWords(text, room);
    if (!kept) return;
    this.chunks.push({ ref, title: cutWords(title, KNOWLEDGE_CHUNK_TITLE_MAX), text: kept, place });
    this.chars += kept.length;
  }
}

// One tab's pieces packed into chunks: pieces join until the next would pass the chunk cap, each chunk naming the
// tab and the first elements its words came from.
function packTab(budget: ChunkBudget, tabId: string, tabName: string, pieces: Piece[]): void {
  let text = '';
  let elementIds: string[] = [];
  let part = 0;
  const flush = () => {
    if (!text) return;
    const place: KnowledgePlace = elementIds.length ? { tabId, elementIds } : { tabId };
    budget.add(`${tabId}:${part++}`, tabName, text, place);
    text = '';
    elementIds = [];
  };
  for (const piece of pieces) {
    if (budget.full) return;
    const words = cutWords(piece.text, KNOWLEDGE_CHUNK_MAX_CHARS);
    if (text && text.length + 1 + words.length > KNOWLEDGE_CHUNK_MAX_CHARS) flush();
    text = text ? `${text}\n${words}` : words;
    if (piece.elementId && elementIds.length < KNOWLEDGE_PLACE_ELEMENTS_MAX)
      elementIds.push(piece.elementId);
  }
  flush();
}

// The article writing a tab keeps (livedocuments' and liveknowledge's `articles`: a flow's blocks), the draft left
// out, as pieces with no element.
function articlePieces(tab: Record<string, unknown>): Piece[] {
  const articles = tab.articles;
  if (!isRecord(articles)) return [];
  const pieces: Piece[] = [];
  for (const [flow, body] of Object.entries(articles)) {
    if (flow === 'draft' || !isRecord(body) || !Array.isArray(body.blocks)) continue;
    for (const block of body.blocks) {
      const text = elementWords(block);
      if (text) pieces.push({ elementId: null, text });
    }
  }
  return pieces;
}

// A tab's elements as pieces, in the order the tab stores them (back to front, which is how its outline reads).
function elementPieces(tab: Record<string, unknown>): Piece[] {
  if (!Array.isArray(tab.elements)) return [];
  const pieces: Piece[] = [];
  // No more words than a whole source may keep: a huge canvas stops being read once they are gathered.
  let chars = 0;
  for (const element of tab.elements) {
    if (chars >= KNOWLEDGE_SOURCE_MAX_CHARS) break;
    if (!isRecord(element)) continue;
    const text = elementWords(element);
    if (!text) continue;
    pieces.push({ elementId: typeof element.id === 'string' ? element.id : null, text });
    chars += text.length;
  }
  return pieces;
}

// The item's part of a file: the object under the envelope's kind (`document`, `project`, `design`, ...) that holds
// its name and tabs.
export function fileBody(file: unknown): { name: string; body: Record<string, unknown> } | null {
  if (!isRecord(file)) return null;
  for (const value of Object.values(file)) {
    if (isRecord(value) && Array.isArray(value.tabs)) {
      return { name: typeof value.name === 'string' ? value.name : '', body: value };
    }
  }
  return null;
}

// Every tab's words into the budget: its name first, then its elements, then its article writing. A connected tab
// (it stands for another item) holds nothing of this one.
export function addCanvasTabs(budget: ChunkBudget, tabs: readonly unknown[]): void {
  for (const tab of tabs) {
    if (budget.full) return;
    if (!isRecord(tab) || typeof tab.id !== 'string' || tab.connection) continue;
    const name = typeof tab.name === 'string' ? plainWords(tab.name) : '';
    const pieces: Piece[] = [
      ...(name ? [{ elementId: null, text: name }] : []),
      ...elementPieces(tab),
      ...articlePieces(tab),
    ];
    // A tab with nothing but its name is still found by its name.
    packTab(budget, tab.id, name, pieces);
  }
}

// A canvas item's chunks from its whole-item file (livediagram, livedocuments, livedesign, livehuddle).
export function canvasKnowledgeChunks(file: unknown): { name: string; chunks: KnowledgeChunk[] } {
  const read = fileBody(file);
  if (!read) return { name: '', chunks: [] };
  const budget = new ChunkBudget();
  addCanvasTabs(budget, read.body.tabs as unknown[]);
  return { name: read.name, chunks: budget.chunks };
}
