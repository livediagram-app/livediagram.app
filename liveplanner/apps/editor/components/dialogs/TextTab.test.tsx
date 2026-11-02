// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONTS, PLANNER_EXCLUDED_FONT_IDS, PLANNER_FONTS } from '@liveplanner/project';
import { TextTab } from './TextTab';

// docs/specs/004-interface-design/fonts.md "Not offered in liveplanner": the Typeface cards offer liveplanner's faces.
afterEach(cleanup);

const renderTab = (font: string | null) =>
  render(
    <TextTab
      font={font}
      onSetFont={vi.fn()}
      defaultTextSize={undefined}
      onSetDefaultTextSize={vi.fn()}
      finish="flexible"
      canvasBackground={undefined}
      themeId="default"
    />,
  );

const typefaces = () =>
  screen
    .getAllByRole('group', { name: /^Typefaces page / })
    .flatMap((page) =>
      [...page.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
    );

describe('TextTab typefaces', () => {
  it('offers the editor default and every face liveplanner offers, in order', () => {
    renderTab(null);
    expect(typefaces()).toEqual(['Editor default', ...PLANNER_FONTS.map((f) => f.label)]);
  });

  it('leaves out the faces liveplanner does not offer', () => {
    renderTab(null);
    for (const id of PLANNER_EXCLUDED_FONT_IDS) {
      const label = FONTS.find((f) => f.id === id)!.label;
      expect(typefaces()).not.toContain(label);
    }
  });

  // A tab set before the face was left out keeps its name in the preview, with no card pressed.
  it('names a tab font no longer offered, pressing no card', () => {
    renderTab('permanent-marker');
    expect(screen.getByRole('img', { name: /lettered in Permanent Marker/ })).toBeTruthy();
    expect(
      screen
        .getAllByRole('group', { name: /^Typefaces page / })
        .flatMap((page) => [...page.querySelectorAll('button[aria-pressed="true"]')]),
    ).toHaveLength(0);
  });
});
