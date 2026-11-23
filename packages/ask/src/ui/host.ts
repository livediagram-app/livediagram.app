// What an editor hands Ask AI (liveworkspace/docs/specs/019-ask/ask.md "In each app"): which item is open, who is
// asking, the item's words as passages, and how to go to a source. Types only, so the Tools row (ask-tools-item.tsx)
// takes them without loading the tool.
import type { AppName } from '@liveworkspace/sites';
import type { AskPassage } from '../passages';
import type { AskSource } from '../wire';

export type AskHost = {
  app: AppName;
  /** The open item: a conversation is kept per item while the page is open. */
  itemId: string;
  /** The signed-in account asking; null for a guest, who is asked to sign in. */
  accountId: string | null;
  /** The item's words now, read when a question is asked (never on load): every tab the editor can read. */
  passages: () => readonly AskPassage[] | Promise<readonly AskPassage[]>;
  /** Goes to a source: its tab, and its element selected where it has one. */
  open: (source: AskSource) => void;
  /** Questions offered before the first is asked, in the app's own words. */
  suggestions?: readonly string[];
};
