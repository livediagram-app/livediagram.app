'use client';

// Send to Plan's row in an element's menu (each app's docs/specs/013-workspace/send-to-plan.md "Where it is"): beside
// Add Comment and Add Note, for an element with words, while this session may send. "On" once a card was made from it,
// its line then saying where the card stands. The menus build their rows on open, so reading the store here is current.
import { BrandMark } from '@liveworkspace/brand';
import type { ResourceOption } from '../palette/element-resources';
import { currentSends, sendsOf } from './send-store';
import { canSendHere, sendFromHere, type SendNoun } from './send-to-plan-entry';
import { chipWords } from './SentChip';

/** Send to Plan's glyph, at a menu row's size: liveplanner's logo (owner, 2026-11-23), as Send to Diagram wears
 *  livediagram's. */
export function SendToPlanMenuIcon({ size = 16 }: { size?: number }) {
  return <BrandMark app="liveplanner" className="shrink-0" style={{ width: size, height: size }} />;
}

type Sendable = { id: string; type: string; label?: unknown };
type Placed = Sendable & { x?: number; y?: number };

/** An element's words to send: its label, trimmed. */
export const elementWords = (el: Sendable): string =>
  typeof el.label === 'string' ? el.label.trim() : '';

/** What the picker calls an element of this type. */
export const elementNoun = (type: string): SendNoun =>
  type === 'sticky' ? 'sticky' : type === 'shape' ? 'shape' : 'element';

/** The element's Send to Plan option in its Resources, or null when it has no words or this session cannot send. */
export function elementSendItem(target: Sendable, label?: string): ResourceOption | null {
  const text = elementWords(target);
  if (!text || !canSendHere()) return null;
  const sent = sendsOf(currentSends(), target.id, ['element'])[0];
  return {
    key: 'send-to-plan',
    name: 'Send to Plan',
    detail: sent ? `Sent: ${chipWords(sent)}` : 'A card for it in liveplanner',
    state: sent ? `Sent: ${chipWords(sent)}` : 'Not sent yet',
    label: 'Send to Plan…',
    icon: <SendToPlanMenuIcon />,
    on: !!sent,
    run: () =>
      sendFromHere('element', elementNoun(target.type), [
        { elementId: target.id, text, ...(label ? { label } : {}) },
      ]),
  };
}

/** A selection's Send to Plan: each element with words, one card each or a checklist. */
export function sendElements(targets: readonly Sendable[]): void {
  const withWords = targets.filter((t) => elementWords(t) !== '');
  const one = withWords.length === 1 ? withWords[0] : undefined;
  sendFromHere(
    'element',
    one
      ? elementNoun(one.type)
      : withWords.every((t) => t.type === 'sticky')
        ? 'stickies'
        : 'elements',
    withWords.map((t) => ({ elementId: t.id, text: elementWords(t) })),
  );
}

/** Whether a selection holds anything to send. */
export const canSendElements = (targets: readonly Sendable[]): boolean =>
  canSendHere() && targets.some((t) => elementWords(t) !== '');

/**
 * A tab menu's Send All (livehuddle's docs/specs/013-workspace/send-to-plan.md): every sticky on the tab with words, in
 * reading order (top to bottom, then left to right), or null when there is none or this session cannot send.
 */
export function sendAllStickies(tabId: string, elements: readonly Placed[]): (() => void) | null {
  const stickies = elements
    .filter((e) => e.type === 'sticky' && elementWords(e) !== '')
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  if (stickies.length === 0 || !canSendHere()) return null;
  return () =>
    sendFromHere(
      'element',
      stickies.length === 1 ? 'sticky' : 'stickies',
      stickies.map((t) => ({ elementId: t.id, text: elementWords(t) })),
      tabId,
    );
}
