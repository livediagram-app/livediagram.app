// The group a host puts first in the search panel (docs/specs/030-knowledgebase/search-and-ask.md "Search": This
// Knowledgebase is always the first group). The host owns what is in it and how a row reads; the panel owns the
// field, the highlight the arrow keys move and Enter. It answers on its own: the panel's other groups never wait for
// it, and it never waits for them.
import type { ReactNode } from 'react';

export type SearchLeadItem = {
  id: string;
  /** The row, drawn inside the panel's option button: text only, never a control. */
  content: ReactNode;
  onSelect: () => void;
};

export type SearchLeadGroup = {
  label: string;
  items: readonly SearchLeadItem[];
  /** One line in the items' place: nothing matches, the search is on its way, or why it failed. */
  note?: string | undefined;
  /** A failure, said to a screen reader at once. */
  alert?: boolean | undefined;
  busy?: boolean | undefined;
  /** What narrows the group (the page tree's label filter): said after its heading, with a button that clears it. */
  filter?: { text: string; onClear: () => void } | undefined;
};
