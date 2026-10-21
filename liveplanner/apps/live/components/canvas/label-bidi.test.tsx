// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createShape } from '@liveplanner/document';
import { renderLabel } from './element-labels';

// docs/specs/008-canvas/canvas-and-palette.md "Labels": right-to-left text reads right to left. jsdom does no bidi
// layout, so this holds the rule and the editors' attribute; the browser check is in the PR.
afterEach(cleanup);

const appCss = (name: string) => readFileSync(join(__dirname, '../../app', name), 'utf8');

describe('right-to-left labels', () => {
  it('gives every block of a label its own direction, and the app loads the rule', () => {
    expect(appCss('globals.css')).toContain("@import './label-bidi.css';");
    const rule = appCss('label-bidi.css');
    expect(rule).toMatch(/\[data-element-id\] :is\([^)]*div[^)]*\) \{\s*unicode-bidi: plaintext;/);
    // A rich label's runs are inline spans: isolating each would break a mixed line.
    expect(rule).not.toMatch(/:is\([^)]*\bspan\b/);
  });

  it('opens the label editor with its direction taken from what is typed', () => {
    const el = { ...createShape('square', 0, 0), id: 'a', label: 'مرحبا!' };
    render(
      renderLabel(
        el,
        el.label,
        'md',
        'center',
        'middle',
        8,
        true,
        () => {},
        () => {},
        true,
      ),
    );
    expect(screen.getByRole('textbox').getAttribute('dir')).toBe('auto');
  });
});
