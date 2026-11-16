// Choosing a live embed's file (liveworkspace/docs/specs/004-index/live-embeds.md "Making one"): the file a row or a
// pasted share link names, checked as one a live embed can show, with a fresh snapshot (its name and a small picture,
// drawn in the person's appearance). A pasted link is resolved through the index as opening it would be, and its code
// is dropped as soon as the file is known: nothing of it reaches the element.
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { IndexError } from '@liveworkspace/index-client';
import {
  LIVE_NAME_MAX,
  isLiveEmbedApp,
  type LiveItem,
} from '@liveworkspace/element-model/live-item';
import { parseLiveEmbedShareLink } from './live-embed-target';
import { captureLivePoster } from './live-poster';

export type LiveEmbedChoice = { liveItem: LiveItem; liveName: string; livePoster?: string };

/** Why a file cannot be chosen, in words, or null when it can. */
export function liveEmbedBlock(item: Pick<Item, 'id' | 'app'>, hostId: string): string | null {
  if (item.id === hostId) return 'This is the file you are in.';
  if (!isLiveEmbedApp(item.app)) return 'Files from this app cannot be shown live yet.';
  return null;
}

/** The choice for a file: its link and a fresh snapshot. */
export async function choiceOf(
  item: Pick<Item, 'id' | 'app' | 'title'>,
  appearance: 'light' | 'dark',
  capture: typeof captureLivePoster = captureLivePoster,
): Promise<LiveEmbedChoice> {
  if (!isLiveEmbedApp(item.app)) throw new Error('not a live embed app');
  const livePoster = await capture(item.id, appearance);
  return {
    liveItem: { app: item.app, itemId: item.id },
    liveName: item.title.slice(0, LIVE_NAME_MAX),
    ...(livePoster ? { livePoster } : {}),
  };
}

type LiveEmbedFields = {
  embedProvider?: string;
  link?: unknown;
  liveItem?: LiveItem;
  liveName?: string;
  livePoster?: string;
};

/** An Embed element showing the chosen file: its link and snapshot replaced, any pasted web address gone. */
export function withLiveEmbedChoice<E extends LiveEmbedFields>(el: E, choice: LiveEmbedChoice): E {
  const { link: _link, livePoster: _poster, ...rest } = el;
  return {
    ...rest,
    embedProvider: 'live',
    liveItem: choice.liveItem,
    liveName: choice.liveName,
    ...(choice.livePoster ? { livePoster: choice.livePoster } : {}),
  } as E;
}

export type PastedLink = { ok: true; item: Item } | { ok: false; words: string };

/** The file a pasted share link opens, or why it cannot be used. */
export async function resolvePastedLink(
  text: string,
  client: Pick<IndexClient, 'resolveShare'>,
): Promise<PastedLink> {
  const parsed = parseLiveEmbedShareLink(text);
  if (!parsed)
    return {
      ok: false,
      words: 'Paste a share link from livediagram, liveplanner, livedocuments or livedesign.',
    };
  try {
    const { item } = await client.resolveShare(parsed.code);
    return { ok: true, item };
  } catch (error) {
    if (error instanceof IndexError) {
      if (error.code === 'password_required' || error.code === 'password_invalid')
        return {
          ok: false,
          words: 'This link has a password. Open it once in its app, then choose it from Recent.',
        };
      if (error.status === 410) return { ok: false, words: 'That file is no longer there.' };
      if (error.status === 404 || error.status === 403)
        return { ok: false, words: 'That link no longer opens anything.' };
    }
    return { ok: false, words: 'That link could not be checked just now. Try again.' };
  }
}
