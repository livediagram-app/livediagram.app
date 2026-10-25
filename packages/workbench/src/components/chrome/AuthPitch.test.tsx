// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthPitch, type PitchRow } from './AuthPitch';

const ROWS: readonly PitchRow[] = [
  { tone: 'emerald', icon: <svg />, title: 'Changes show live', line: 'Edits land as you watch.' },
  { tone: 'amber', icon: <svg />, title: 'Revoke access any time', line: 'Under API tokens.' },
];

// The pitch as liveworkspace.app's sign-in pitch draws it (docs/specs/014-identity/auth-and-guest-access.md
// "The look: Night Band" in each product).
describe('AuthPitch', () => {
  it('gives each row one title, in its tone, with its line under it', () => {
    render(<AuthPitch eyebrow="Connect" heading="Your work, wherever you are." rows={ROWS} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const title = screen.getByText('Changes show live');
    expect(title.className).toContain('block');
    expect(title.className).toContain('text-emerald-700');
    // Nothing else shares the title's line: its only sibling is the line under it.
    expect(title.parentElement?.children).toHaveLength(2);
    expect(title.nextElementSibling?.textContent).toBe('Edits land as you watch.');
  });

  it('stacks the rows one per row at every width', () => {
    render(<AuthPitch eyebrow="Connect" heading="Your work, wherever you are." rows={ROWS} />);
    const list = screen.getByRole('list');
    expect(list.className).toContain('flex-col');
    expect(list.className).not.toMatch(/grid/);
  });
});
