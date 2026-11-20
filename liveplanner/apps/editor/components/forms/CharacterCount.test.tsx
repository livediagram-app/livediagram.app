// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CharacterCount, characterCountText } from './CharacterCount';

// The limit on a text answer (docs/specs/030-forms/forms.md "Filling in a form").

afterEach(cleanup);

describe('characterCountText', () => {
  it('says nothing until the answer nears its limit', () => {
    expect(characterCountText(0, 200)).toBeNull();
    expect(characterCountText(159, 200)).toBeNull();
    expect(characterCountText(160, 200)).toBe('160 of 200 characters');
    expect(characterCountText(1999, 2000)).toBe('1,999 of 2,000 characters');
  });
  it('says nothing more is kept at the limit', () => {
    expect(characterCountText(2000, 2000)).toBe('2,000 of 2,000 characters: nothing more is kept');
  });
});

describe('CharacterCount', () => {
  it('shows the count and stays quiet for a screen reader short of the limit', () => {
    render(<CharacterCount length={180} max={200} />);
    expect(screen.getByText('180 of 200 characters')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('is read out once the limit is reached', () => {
    render(<CharacterCount length={200} max={200} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Character limit reached: 200 characters. Nothing more is kept.',
    );
  });
  it('draws no line for a short answer', () => {
    const { container } = render(<CharacterCount length={3} max={200} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
