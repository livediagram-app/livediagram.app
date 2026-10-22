// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewToggle } from './ViewToggle';

// List and Details are for larger screens (docs/specs/006-project/project-snapshots.md):
// the toggle takes no room on a phone, through the `phone:` variant so it never flashes in.
describe('ViewToggle', () => {
  it('is hidden on a phone and shown from there up', () => {
    render(<ViewToggle mode="card" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'View mode' });
    expect(group.className.split(' ')).toContain('phone:hidden');
    expect(group.className.split(' ')).toContain('flex');
  });
});
