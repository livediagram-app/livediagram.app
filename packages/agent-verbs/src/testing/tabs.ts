// Plain tabs for the write and diff suites.

import type { Element, Tab } from '@livediagram/document';

export const box = (id: string, label: string, x = 0): Element =>
  ({ id, type: 'shape', shape: 'square', x, y: 0, width: 120, height: 60, label }) as Element;

export const plainTab = (elements: Element[], id = 'tab-one-0000', name = 'Overview'): Tab =>
  ({ id, name, elements }) as Tab;

// A tab read as the api answers it: the JSON body and its weak ETag.
export const tabAnswer = (tab: Tab, rev: number) => () =>
  new Response(JSON.stringify({ tab }), { headers: { ETag: `W/"${rev}"` } });
