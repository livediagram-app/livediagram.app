// The element payload the editor puts on, and takes off, the OS clipboard
// (docs/specs/008-canvas/canvas-and-palette.md "Clipboard").
//
// Copy used to be in-app only: Cmd+C snapshotted the selection into React
// state and wrote a sentinel STRING to the system clipboard, purely to displace
// a lingering image so the next paste didn't re-drop it. That works inside one
// editor instance, and only there — the buffer is component state, so elements
// could not cross a browser tab, a second window, or a reload, which is exactly
// where "copy this and put it in that document" happens.
//
// So the real elements go on the clipboard now, as text. Text rather than a
// custom MIME type because `navigator.clipboard.writeText` is the one write
// that works from a keydown handler in every browser we support; the richer
// `ClipboardItem` API is gated differently per browser and buys nothing here.
//
// The envelope mirrors the tab export's (`export-tab-text.ts` in `@livediagram/document`): a `kind`
// discriminator so we never try to paste somebody else's JSON, and a numeric
// `schemaVersion` so a future breaking change can be refused with a clear
// message instead of pasting nonsense.

import { isValidElement, migrateIncomingElements, type Element } from '@livediagram/document';
import type { SheetJson } from '@livediagram/sheets';
import { sheetsForClipboard, stashSheetSeeds } from './sheet-seeds';

// 2: freehand points are packed (docs/specs/006-document/stroke-points.md); an older editor
// refuses a version 2 payload rather than pasting strokes it cannot draw.
export const CLIPBOARD_SCHEMA_VERSION = 2;
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
  // The sheets of copied Sheet elements (docs/specs/029-sheets/sheet.md "Copying a Sheet element"). Optional and
  // additive, so the version stays 2.
  sheets?: SheetJson[];
};

// Fields that carry WHO did something rather than WHAT the element is. They are
// stripped on the way out, so a copy handed to another person (or pasted into a
// document with a different participant set) never arrives carrying somebody
// else's name against a comment or their answer against a poll.
//
// Comments go entirely rather than being anonymised: a thread is a conversation
// about the original element, and re-attaching it to a copy in another document
// misrepresents it whether or not the names survive. `responses` (docs/specs/012-collaboration/participant-responses.md) go
// for the same reason — a vote is cast in a session, not a property of a shape.
// An assigned `action` (docs/specs/012-collaboration/assigned-actions.md) is work handed to a person, and carries its own
// id into the Activity index: a pasted copy made a second action under the
// same id rather than a second piece of work anybody had assigned.
//
// Exported for the in-app buffer, which a paste falls back to when the OS
// clipboard write is refused, so both routes carry the same thing.
export function stripIdentity(el: Element): Element {
  const out = { ...el } as Element & {
    commentThread?: unknown;
    responses?: unknown;
    action?: unknown;
    actions?: unknown;
  };
  delete out.commentThread;
  delete out.responses;
  delete out.action;
  delete out.actions;
  return out;
}

/** The clipboard text for a selection. */
export function serialiseElements(elements: Element[]): string {
  const sheetIds = elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet?.sheetId
      ? [el.planSheet.copyOf ?? el.planSheet.sheetId]
      : [],
  );
  const sheets = sheetsForClipboard(sheetIds);
  const envelope: ClipboardEnvelope = {
    schemaVersion: CLIPBOARD_SCHEMA_VERSION,
    kind: CLIPBOARD_KIND,
    copiedAt: Date.now(),
    elements: elements.map(stripIdentity),
    ...(sheets.length ? { sheets } : {}),
  };
  const text = JSON.stringify(envelope);
  // Sheets past the clipboard's size travel without their cells (the copy is then made only within the document).
  return text.length > MAX_CLIPBOARD_BYTES && sheets.length
    ? JSON.stringify({ ...envelope, sheets: undefined })
    : text;
}

// The sheets a pasted payload carried, stashed for the pasted Sheets (lib/sheet-seeds.ts).
export function takeSheetSeeds(text: string | null | undefined): void {
  if (!text || !text.includes('"sheets"') || text.length > MAX_CLIPBOARD_BYTES) return;
  try {
    const env = JSON.parse(text) as Partial<ClipboardEnvelope>;
    if (env.kind === CLIPBOARD_KIND && Array.isArray(env.sheets)) stashSheetSeeds(env.sheets);
  } catch {
    // Not ours, or broken: nothing to stash.
  }
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
  // paste. isValidElement is the same guard the api and the AI ingest path use. A payload from an
  // older editor carries former stored shapes, migrated first (docs/specs/006-document/stroke-points.md).
  const elements = migrateIncomingElements(env.elements.slice(0, MAX_CLIPBOARD_ELEMENTS)).filter(
    isValidElement,
  );
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

/** Whether a paste into an article's writing is the canvas's to make: an image file, or elements
 *  copied from a canvas (the writing takes text, links and formatting itself). */
export function articlePasteIsCanvas(data: DataTransfer | null): boolean {
  if (!data) return false;
  if (data.files && data.files.length > 0) return true;
  for (const item of Array.from(data.items ?? []))
    if (item.kind === 'file' && item.type.startsWith('image/')) return true;
  return parseElementsPayload(data.getData('text/plain')) !== null;
}
