import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// liveworkspace.app hosted every app's comparisons from 70b1e4f47 until they went back to the apps
// (packages/comparisons/README.md). Every address it had redirects permanently: the hub to /compare,
// which points at each app's, and each comparison to the same slug on the app that speaks for it.
const MOVED: Record<string, string[]> = {
  'https://livediagram.app': [
    'microsoft-whiteboard',
    'miro',
    'xmind',
    'excalidraw',
    'drawio',
    'figjam',
    'lucidchart',
  ],
  'https://liveplanner.app': [
    'trello',
    'asana',
    'monday',
    'notion',
    'jira',
    'clickup',
    'airtable',
    'smartsheet',
  ],
  'https://livedocuments.app': ['google-slides'],
  'https://livedesign.app': ['figma'],
};

const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));
const ruleFor = (from: string) => rules.find(([source]) => source === from);

describe('the comparison redirects', () => {
  it('send the hub, with and without a trailing slash, to /compare', () => {
    for (const from of ['/alternatives', '/alternatives/']) {
      expect(ruleFor(from)).toEqual([from, '/compare', '301']);
    }
  });

  it.each(Object.entries(MOVED).flatMap(([site, slugs]) => slugs.map((slug) => [slug, site])))(
    'send %s to the same comparison on %s',
    (slug, site) => {
      for (const from of [`/alternatives/${slug}`, `/alternatives/${slug}/`]) {
        expect(ruleFor(from)).toEqual([from, `${site}/alternatives/${slug}`, '301']);
      }
    },
  );

  it('land any other old comparison address on /compare, after every named one', () => {
    const catchAll = rules.findIndex(([source]) => source === '/alternatives/*');
    expect(rules[catchAll]).toEqual(['/alternatives/*', '/compare', '301']);
    const named = rules.filter(
      ([source]) => source!.startsWith('/alternatives/') && source !== '/alternatives/*',
    );
    expect(named.every((rule) => rules.indexOf(rule) < catchAll)).toBe(true);
  });
});
