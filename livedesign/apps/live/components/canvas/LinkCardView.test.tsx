// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createLinkCard, type LinkCardElement } from '@livedesign/design';
import { LinkCardView } from './LinkCardView';

const card = (link: LinkCardElement['link']): LinkCardElement => ({
  ...createLinkCard(0, 0),
  id: 'card',
  link,
});

// docs/specs/007-editor/wireframe-pages.md "Clickable prototypes": a card holding a screen link names it as a
// screen rather than falling through to a blank row.
describe('LinkCardView', () => {
  it('names a screen link and a back link', () => {
    const { unmount } = render(<LinkCardView element={card({ kind: 'page', pageId: 'gone' })} />);
    expect(screen.getByText('Screen')).toBeTruthy();
    expect(screen.getByText('A screen on this tab')).toBeTruthy();
    unmount();
    render(<LinkCardView element={card({ kind: 'back', transition: 'dissolve' })} />);
    expect(screen.getByText('The screen before')).toBeTruthy();
  });
});
