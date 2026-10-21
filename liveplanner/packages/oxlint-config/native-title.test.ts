import { beforeAll, describe, expect, it } from 'vitest';
import { findingsOf, lintFixtures, type Finding } from './lint-fixtures';

// Native `title` is not a hint (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md): the
// shared config rejects it everywhere except the elements where it is an accessible name rather
// than a hover.
const RULE = 'liveplanner(no-native-title)';

const FIXTURES = {
  'button.tsx': 'export const A = () => <button title="Zoom in" />;',
  'span.tsx': 'export const A = () => <span title="Full name">Full…</span>;',
  'iframe.tsx': 'export const A = () => <iframe title="Video" src="x" />;',
  'abbr.tsx': 'export const A = () => <abbr title="Domain event">DE</abbr>;',
  'panel.tsx': 'export const A = () => <Panel title="Layers" />;',
  'hover-card.tsx': 'export const A = () => <HoverCard title="Zoom" />;',
};

let findings: Finding[];
beforeAll(() => {
  findings = lintFixtures(FIXTURES);
});

const titleErrors = (file: keyof typeof FIXTURES) => findingsOf(findings, file, RULE);

describe('native title rule', () => {
  it('rejects title on an interactive element', () => {
    const errors = titleErrors('button.tsx');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Tooltip.*HoverCard/);
  });

  it('rejects title on plain text', () => {
    expect(titleErrors('span.tsx')).toHaveLength(1);
  });

  it('allows the accessible-name exceptions', () => {
    expect(titleErrors('iframe.tsx')).toEqual([]);
    expect(titleErrors('abbr.tsx')).toEqual([]);
  });

  it('leaves component props named title alone', () => {
    expect(titleErrors('panel.tsx')).toEqual([]);
    expect(titleErrors('hover-card.tsx')).toEqual([]);
  });
});
