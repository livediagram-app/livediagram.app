// The element payload the editor puts on, and takes off, the OS clipboard
// (spec/09 "Clipboard").
//
// Copy used to be in-app only: Cmd+C snapshotted the selection into React
// state and wrote a sentinel STRING to the system clipboard, purely to displace
// a lingering image so the next paste didn't re-drop it. That works inside one
// editor instance, and only there — the buffer is component state, so elements
// could not cross a browser tab, a second window, or a reload, which is exactly
// where "copy this and put it in that diagram" happens.
//
// So the real elements go on the clipboard now, as text. Text rather than a
// custom MIME type because `navigator.clipboard.writeText` is the one write
// that works from a keydown handler in every browser we support; the richer
// `ClipboardItem` API is gated differently per browser and buys nothing here.
//
// The envelope mirrors the tab export's (`export-tab-text.ts`): a `kind`
// discriminator so we never try to paste somebody else's JSON, and a numeric
// `schemaVersion` so a future breaking change can be refused with a clear
// message instead of pasting nonsense.

import { isValidElement, type Element } from '@livediagram/diagram';

export const CLIPBOARD_SCHEMA_VERSION = 1;
export const CLIPBOARD_KIND = 'livediagram.elements';

// A ceiling on what a paste will accept. The tab cap is 10,000 elements
// (MAX_ELEMENTS_PER_TAB), but a clipboard payload is one user's selection, and
// parsing an arbitrarily large string handed to us by the OS clipboard on every
// Cmd+V is worth bounding on its own terms.
export const MAX_CLIPBOARD_ELEMENTS = 2000;
// Roughly 4 MB of JSON. Big enough for a dense selection with embedded data-URI
// images, small enough that a malformed multi-megabyte paste is rejected before
// JSON.parse rather than after.
export const MAX_CLIPBOARD_BYTES = 4_000_000;

export type ClipboardEnvelope = {
  schemaVersion: number;
  kind: typeof CLIPBOARD_KIND;
  copiedAt: number;
  elements: Element[];
};

// Fields that carry WHO did something rather than WHAT the element is. They are
// stripped on the way out, so a copy handed to another person (or pasted into a
// diagram with a different participant set) never arrives carrying somebody
// else's name against a comment or their answer against a poll.
//
// Comments go entirely rather than being anonymised: a thread is a conversation
// about the original element, and re-attaching it to a copy in another diagram
// misrepresents it whether or not the names survive. `responses` (spec/122) go
// for the same reason — a vote is cast in a session, not a property of a shape.
function stripIdentity(el: Element): Element {
  const out = { ...el } as Element & {
    commentThread?: unknown;
    responses?: unknown;
  };
  delete out.commentThread;
  delete out.responses;
  return out;
}

/** The clipboard text for a selection. */
export function serialiseElements(elements: Element[]): string {
  const envelope: ClipboardEnvelope = {
    schemaVersion: CLIPBOARD_SCHEMA_VERSION,
    kind: CLIPBOARD_KIND,
    copiedAt: Date.now(),
    elements: elements.map(stripIdentity),
  };
  return JSON.stringify(envelope);
}

/**
 * The elements in a clipboard string, or null when it isn't ours.
 *
 * Null covers every "this is not a livediagram payload" case — ordinary copied
 * text, another app's JSON, a truncated payload, a newer schema — because the
 * caller's response to all of them is the same: leave the paste alone and fall
 * back to the in-app buffer. Never throws: this runs on every Cmd+V, against a
 * string the editor did not write.
 */
export function parseElementsPayload(text: string | null | undefined): Element[] | null {
  if (!text) return null;
  if (text.length > MAX_CLIPBOARD_BYTES) return null;
  // Cheap discriminator before the parse: the overwhelmingly common paste is
  // ordinary text, and JSON.parse on it is wasted work in a keystroke path.
  if (!text.includes(CLIPBOARD_KIND)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const env = parsed as Partial<ClipboardEnvelope>;
  if (env.kind !== CLIPBOARD_KIND) return null;
  // Refuse a payload from a future version rather than pasting a shape we do
  // not understand. Older versions are accepted: every field the current
  // reader needs is validated below anyway.
  if (typeof env.schemaVersion !== 'number' || env.schemaVersion > CLIPBOARD_SCHEMA_VERSION) {
    return null;
  }
  if (!Array.isArray(env.elements)) return null;

  // Per-element validation, dropping failures rather than refusing the payload:
  // one unreadable element out of forty should cost you that element, not the
  // paste. isValidElement is the same guard the api and the AI ingest path use.
  const elements = env.elements.slice(0, MAX_CLIPBOARD_ELEMENTS).filter(isValidElement);
  if (elements.length === 0) return null;

  // Duplicate ids would make the id-remap ambiguous (and a tab with two
  // elements sharing an id is invalid). Keep the first of each.
  const seen = new Set<string>();
  return elements.filter((el) => {
    if (seen.has(el.id)) return false;
    seen.add(el.id);
    return true;
  });
}
