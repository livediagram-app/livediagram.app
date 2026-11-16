// @vitest-environment jsdom

// The page toolbar's mode button (docs/specs/007-editor/suggestions.md "Suggesting"): on a phone it shows its glyph
// alone, so Suggesting is a solid brand fill there and the two modes never look alike.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SuggestModeButton } from './page-toolbar-suggest';

afterEach(() => cleanup());

const button = (mode: 'editing' | 'suggesting', phone: boolean) => {
  render(<SuggestModeButton mode={mode} expanded={false} phone={phone} onPress={() => {}} />);
  return screen.getByRole('button', {
    name: `Mode: ${mode === 'editing' ? 'Editing' : 'Suggesting'}`,
  });
};

describe('SuggestModeButton', () => {
  it('fills Suggesting solid on a phone, where the words are gone', () => {
    const suggesting = button('suggesting', true);
    expect(suggesting.className).toContain('bg-brand-700');
    expect(suggesting.textContent).toBe('');
    cleanup();
    expect(button('editing', true).className).not.toContain('bg-brand-700');
  });

  it('names the mode in words beside the glyph on a wider screen', () => {
    const suggesting = button('suggesting', false);
    expect(suggesting.textContent).toBe('Suggesting');
    expect(suggesting.className).not.toContain('bg-brand-700');
  });
});
