// Send to Plan's entries (liveworkspace/docs/specs/004-index/send-to-plan.md; each app's 013-workspace/send-to-plan.md):
// an element menu, a selection's menu, a text toolbar, a thread's header or a tab menu asks for the picker with the
// places it sends, and the editor's one SendToPlanHost opens it. A module-level relay: the menus and the host sit far
// apart in the tree, and one editor runs per page.
import {
  PLAN_SEND_CARDS_MAX,
  PLAN_SEND_LABEL_MAX,
  PLAN_SEND_TEXT_MAX,
  textPart,
  type App,
  type PlanSendKind,
  type PlanSendPlace,
} from '@liveworkspace/index-client';
import { sendSourceId } from './send-store';

/** What is being sent, for the picker's words: a sticky, a shape, some words, a thread, an action, a tab's stickies. */
export type SendNoun =
  'sticky' | 'shape' | 'element' | 'elements' | 'words' | 'thread' | 'action' | 'stickies';

export type SendRequest = {
  places: PlanSendPlace[];
  noun: SendNoun;
  // How many there were before PLAN_SEND_CARDS_MAX cut them (a tab's Send All).
  cut?: number;
};

const listeners = new Set<(request: SendRequest) => void>();

/** Opens the picker for these places (one card each, or one with a checklist). Nothing happens with none. */
export function openSendToPlan(request: SendRequest): void {
  const places = request.places.filter((p) => p.text.trim() !== '');
  if (places.length === 0) return;
  const kept = places.slice(0, PLAN_SEND_CARDS_MAX);
  const ask: SendRequest = {
    ...request,
    places: kept,
    ...(places.length > kept.length ? { cut: places.length } : {}),
  };
  for (const l of [...listeners]) l(ask);
}

/** The host's subscription; answers the unsubscribe. */
export function onSendToPlan(listener: (request: SendRequest) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether this session may send at all: an account in person, the item in the cloud, not an embed or Community. */
export function canSendToPlan(session: {
  signedIn: boolean;
  offline?: boolean;
  embed?: boolean;
  community?: boolean;
}): boolean {
  return session.signedIn && !session.offline && !session.embed && !session.community;
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** One place, its words as the person sees them; picked words carry their own key (`part`). */
export function sendPlace(input: {
  app: App;
  itemId: string;
  kind: PlanSendKind;
  tabId?: string | null;
  elementId?: string | null;
  label?: string;
  text: string;
}): PlanSendPlace {
  const text = clip(input.text.trim(), PLAN_SEND_TEXT_MAX);
  return {
    app: input.app,
    itemId: input.itemId,
    kind: input.kind,
    tabId: input.tabId ?? null,
    elementId: input.elementId ?? null,
    part: input.kind === 'text' ? textPart(text) : null,
    label: clip((input.label ?? '').trim(), PLAN_SEND_LABEL_MAX),
    text,
  };
}

// The app and tab the editor shows, so a menu names only the element (SendToPlanHost keeps it current).
let here: { app: App; tabId: string | null } | null = null;

/** The host's word on where the editor is; null when it closes. */
export function setSendHere(next: { app: App; tabId: string | null } | null): void {
  here = next;
}

/** Whether a menu should offer Send to Plan now: the host is up and this session may send. */
export function canSendHere(): boolean {
  return here !== null && sendSourceId() !== null;
}

/**
 * Opens the picker for elements (or a thread, an action, picked words) of the open item on the tab shown. Each entry
 * is its element and its words; nothing happens when this session cannot send or none has words.
 */
export function sendFromHere(
  kind: PlanSendKind,
  noun: SendNoun,
  of: readonly { elementId: string | null; text: string; label?: string }[],
  // Another tab than the one shown (a tab menu's Send All).
  onTab?: string,
): void {
  const itemId = sendSourceId();
  if (!here || !itemId) return;
  const { app } = here;
  const tabId = onTab ?? here.tabId;
  openSendToPlan({
    noun,
    places: of.map((o) =>
      sendPlace({
        app,
        itemId,
        kind,
        tabId,
        elementId: o.elementId,
        text: o.text,
        ...(o.label ? { label: o.label } : {}),
      }),
    ),
  });
}
