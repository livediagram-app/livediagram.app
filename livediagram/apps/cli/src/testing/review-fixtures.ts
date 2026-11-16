// The `link review` suites' mirror files (docs/specs/027-repositories/blueprints/link-review.md "Testing"): boxes,
// arrows and tabs, written as a sync writes them.

import type { Element, Tab } from '@livediagram/document';
import { mirrorFileText } from '../link/mirror-file';
import type { PullFile } from '../sync/pull-file';

export const box = (id: string, label: string, x: number, extra: object = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  label,
  x,
  y: 0,
  width: 160,
  height: 60,
  ...extra,
});

export const arrow = (id: string, from: string, to: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'pinned', elementId: to, anchor: 'w' },
});

export const tab = (id: string, name: string, elements: Element[], extra: object = {}): Tab => ({
  id,
  name,
  elements,
  ...extra,
});

export function pullFileOf(
  id: string,
  name: string,
  tabs: Tab[],
  host = 'https://www.livediagram.app',
): PullFile {
  return {
    kind: 'livediagram.document',
    schemaVersion: 1,
    exportedAt: 0,
    document: { id, name, presentation: null, tabs },
    livediagramSync: {
      host,
      tabs: Object.fromEntries(tabs.map((t) => [t.id, { rev: 1, hash: 'h', settingsHash: 's' }])),
    },
  };
}

export const mirrorText = (...args: Parameters<typeof pullFileOf>) => {
  const { exportedAt: _drop, ...file } = pullFileOf(...args);
  return mirrorFileText(file);
};
