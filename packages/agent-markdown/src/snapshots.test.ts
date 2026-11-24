import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pageToMarkdown } from './convert';

// One Markdown snapshot per site (liveworkspace/docs/specs/010-site/markdown-for-agents.md "Tests"), each from a real
// page of that site's export, trimmed (fixtures/, each file says how). A change to the conversion shows here as the
// Markdown an agent would now read.
const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

describe('the Markdown of a real page', () => {
  it.each([
    ['the liveworkspace site', 'site-compare.html', 'https://www.liveworkspace.app/compare'],
    ['a marketing site', 'marketing-miro.html', 'https://www.livediagram.app/alternatives/miro'],
    [
      'the help centre',
      'help-using-tabs.html',
      'https://www.livediagram.app/help/tabs/using-tabs/',
    ],
  ])('of %s', (_site, file, url) => {
    expect(pageToMarkdown(fixture(file), url)?.markdown).toMatchSnapshot();
  });
});
