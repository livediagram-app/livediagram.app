// Knowledge sources (liveworkspace/docs/specs/004-index/knowledge-sources.md): a knowledgebase answering from items in
// other apps, on each reader's own access. The shapes every side shares: the apps' text door (@liveworkspace/index-app
// knowledge-source-doors.ts, @liveworkspace/app-doors), the index's routes, and the knowledgebase's citations.

import type { App } from './constants';

// The apps whose items a knowledgebase may read.
export const KNOWLEDGE_SOURCE_APPS = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
] as const satisfies readonly App[];
export type KnowledgeSourceApp = (typeof KNOWLEDGE_SOURCE_APPS)[number];

export const isKnowledgeSourceApp = (value: unknown): value is KnowledgeSourceApp =>
  (KNOWLEDGE_SOURCE_APPS as readonly unknown[]).includes(value);

// The door's caps: one chunk's characters, a source's chunks and its characters in all.
export const KNOWLEDGE_CHUNK_MAX_CHARS = 1_200;
export const KNOWLEDGE_CHUNKS_PER_SOURCE = 200;
export const KNOWLEDGE_SOURCE_MAX_CHARS = 60_000;
// A chunk's title (a tab's, a card's or a page's name, cut).
export const KNOWLEDGE_CHUNK_TITLE_MAX = 200;
// The elements one chunk's place names: enough to light a group, never a whole canvas.
export const KNOWLEDGE_PLACE_ELEMENTS_MAX = 12;
// The index's caps: a knowledgebase's sources listed, the knowledgebases one change tells, the words a likely look
// takes, the items it answers.
export const KNOWLEDGE_SOURCES_MAX = 500;
export const KNOWLEDGE_WATCHERS_MAX = 20;
export const KNOWLEDGE_LIKELY_WORDS_MAX = 8;
export const KNOWLEDGE_LIKELY_MAX = 3;
// How deep a team folder source reaches into the folders inside it.
export const KNOWLEDGE_FOLDER_DEPTH_MAX = 8;

// Where in an item a chunk came from, as a citation opens it: a canvas tab and its elements, or a plan's card (which
// opens wherever the plan shows it). Ids only; a place names a tab or a card, or both.
export type KnowledgePlace = { tabId?: string; elementIds?: string[]; cardId?: string };

// One chunk of an item's text: `ref` is stable while the place's content stands (the door's own key for it).
export type KnowledgeChunk = { ref: string; title: string; text: string; place: KnowledgePlace };

// What the door answers: the item's name, its last save, and its chunks in reading order.
export type KnowledgeText = { name: string; version: number; chunks: KnowledgeChunk[] };

// How a knowledgebase came to read an item.
export type KnowledgeSourceOrigin = 'connected' | 'folder';

// A knowledgebase's source as the index lists it.
export type KnowledgeSourceListing = {
  itemId: string;
  app: KnowledgeSourceApp;
  title: string;
  updatedAt: number;
  origin: KnowledgeSourceOrigin;
};

// An item the Unanswered note names: one the asker can open that is not a source.
export type KnowledgeLikelyItem = { itemId: string; app: KnowledgeSourceApp; title: string };

// The change signal's body: which source changed, and whether it is gone (in the Trash).
export type KnowledgeSourceChange = { app: KnowledgeSourceApp; itemId: string; gone?: boolean };

// An item's id as the index keys it; a part's (a tab's, an element's, a card's) as the apps take it: any non-empty
// string within the index's id length.
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);
const PART_MAX = 200;
const isPartId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= PART_MAX;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function isKnowledgePlace(value: unknown): value is KnowledgePlace {
  if (!isRecord(value)) return false;
  if (value.tabId !== undefined && !isPartId(value.tabId)) return false;
  if (value.cardId !== undefined && !isPartId(value.cardId)) return false;
  if (value.tabId === undefined && value.cardId === undefined) return false;
  if (value.elementIds === undefined) return true;
  return (
    Array.isArray(value.elementIds) &&
    value.elementIds.length <= KNOWLEDGE_PLACE_ELEMENTS_MAX &&
    value.elementIds.every(isPartId)
  );
}

function isKnowledgeChunk(value: unknown): value is KnowledgeChunk {
  return (
    isRecord(value) &&
    typeof value.ref === 'string' &&
    value.ref.length <= 200 &&
    typeof value.title === 'string' &&
    value.title.length <= KNOWLEDGE_CHUNK_TITLE_MAX &&
    typeof value.text === 'string' &&
    value.text.length <= KNOWLEDGE_CHUNK_MAX_CHARS &&
    isKnowledgePlace(value.place)
  );
}

// The door's answer, checked whole: a door that answers past the caps is a failure, not a bigger index.
export function isKnowledgeText(value: unknown): value is KnowledgeText {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  if (typeof value.version !== 'number' || !Number.isFinite(value.version)) return false;
  const { chunks } = value;
  if (!Array.isArray(chunks) || chunks.length > KNOWLEDGE_CHUNKS_PER_SOURCE) return false;
  let chars = 0;
  for (const chunk of chunks) {
    if (!isKnowledgeChunk(chunk)) return false;
    chars += chunk.text.length;
  }
  return chars <= KNOWLEDGE_SOURCE_MAX_CHARS;
}

// The change signal's body, or null for anything else.
export function readKnowledgeSourceChange(value: unknown): KnowledgeSourceChange | null {
  if (!isRecord(value) || !isKnowledgeSourceApp(value.app) || !isId(value.itemId)) return null;
  return {
    app: value.app,
    itemId: value.itemId,
    ...(value.gone === true ? { gone: true } : {}),
  };
}

// ---------- Where a citation lands ----------------------------------------------------------------------------------

// The fragment a citation adds to an item's address: the editors' element deep link (`t`, `el`, `item`) with the
// question and the knowledgebase it came from, so the target app can show its Cited by Ask bar. Only the first
// element is the deep link's own `el`; the rest ride in `els` for the apps that light a group.
export const ASK_CITATION_QUESTION_MAX = 300;

export type AskCitation = { question: string; from: string };

export function knowledgePlaceHash(place: KnowledgePlace, citation?: AskCitation): string {
  const hash = new URLSearchParams();
  if (place.tabId) hash.set('t', place.tabId);
  // An element is the deep link's only beside its tab.
  const [first, ...more] = place.tabId ? (place.elementIds ?? []) : [];
  if (first) hash.set('el', first);
  // Each encoded on its own, so an element id holding a comma still reads back whole.
  if (more.length) hash.set('els', more.map(encodeURIComponent).join(','));
  if (place.cardId) hash.set('item', place.cardId);
  if (citation) {
    hash.set('ask', citation.question.slice(0, ASK_CITATION_QUESTION_MAX));
    hash.set('from', citation.from);
  }
  return `#${hash.toString()}`;
}

const decoded = (part: string): string | null => {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
};

// The citation a landing address carries, or null when it names none. Read defensively: it is a URL anyone can type.
export function askCitationOf(hash: string): (AskCitation & { elementIds: string[] }) | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const question = params.get('ask')?.trim().slice(0, ASK_CITATION_QUESTION_MAX);
  const from = params.get('from');
  if (!question || !isId(from)) return null;
  const more = (params.get('els')?.split(',') ?? [])
    .slice(0, KNOWLEDGE_PLACE_ELEMENTS_MAX)
    .map(decoded);
  const elementIds = [params.get('el'), ...more]
    .filter(isPartId)
    .slice(0, KNOWLEDGE_PLACE_ELEMENTS_MAX);
  return { question, from, elementIds };
}
