import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTION_IDS } from './landing-content';

// The retired feature category pages (docs/specs/019-marketing/marketing-site.md "Feature category
// pages") redirect permanently from public/_redirects. Every one must land on a page that exists,
// and a live category must never be redirected away from itself.
const RETIRED = [
  'simple',
  'content',
  'express',
  'assist',
  'customise',
  'refine',
  'tabs',
  'motion',
  'present',
  'reliability',
  'connect',
  'foundations',
];

const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));

describe('retired feature pages', () => {
  it('redirects every retired category, with and without a trailing slash, permanently', () => {
    for (const id of RETIRED) {
      for (const from of [`/features/${id}`, `/features/${id}/`]) {
        const rule = rules.find(([source]) => source === from);
        expect(rule, from).toBeDefined();
        expect(rule![2]).toBe('301');
      }
    }
  });

  it('sends each one to a live page', () => {
    const live = new Set(['/', ...LANDING_SECTION_IDS.map((id) => `/features/${id}`)]);
    for (const [, to] of rules) expect(live.has(to!), to).toBe(true);
  });

  it('never redirects a live category', () => {
    const sources = new Set(rules.map(([source]) => source!.replace(/\/$/, '')));
    for (const id of LANDING_SECTION_IDS) expect(sources.has(`/features/${id}`)).toBe(false);
  });
});
