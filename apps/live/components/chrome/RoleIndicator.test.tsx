// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RolePill, RoleStatusIcon, roleOwnerLabel } from './RoleIndicator';

// The role pill (docs/specs/007-editor/live-app.md#role-pill) and its Minimal chrome icon
// (docs/specs/007-editor/power-user-mode.md).

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('roleOwnerLabel', () => {
  it('discloses the owner, or you', () => {
    expect(roleOwnerLabel('Ada', false)).toBe('Owned by Ada');
    expect(roleOwnerLabel('Ada', true)).toBe('Owned by you');
    expect(roleOwnerLabel(null, false)).toBe('');
  });
});

describe('RolePill', () => {
  // docs/specs/013-workspace/share-roles.md: a Participant's pill is static and says so.
  it('reads Participating, with no toggle, for a Participant', () => {
    render(<RolePill role="participate" ownerName="Ada" isSelf={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('[data-role-pill="participate"]')?.textContent).toContain(
      'Participating',
    );
  });

  it('is a toggle for someone who may edit, named by its role then its owner', () => {
    const onToggle = vi.fn();
    render(<RolePill role="edit" ownerName="Ada" isSelf onToggle={onToggle} />);
    const pill = screen.getByRole('button', { name: 'Editing. Owned by you' });
    expect(pill.textContent).toContain('Editing');
    expect(pill.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(pill.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Switch to viewing (read-only)',
    );
    fireEvent.click(pill);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers the way back while previewing', () => {
    render(<RolePill role="view" ownerName="Ada" isSelf onToggle={() => {}} />);
    const pill = screen.getByRole('button', { name: 'Viewing. Owned by you' });
    expect(document.getElementById(pill.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Switch to editing',
    );
  });

  it('is static, still focusable, for a view-link visitor', () => {
    render(<RolePill role="view" ownerName="Ada" isSelf={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    const pill = screen.getByText('Viewing').closest('[tabindex]') as HTMLElement;
    expect(pill.tabIndex).toBe(0);
    expect(pill.textContent).toContain('Owned by Ada');
  });

  it('drops the owner phrase when the owner is unknown', () => {
    render(<RolePill role="edit" ownerName={null} isSelf={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Editing' })).toBeTruthy();
  });
});

describe('RoleStatusIcon', () => {
  it('names the role and toggles', () => {
    const onToggle = vi.fn();
    render(<RoleStatusIcon role="edit" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editing' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says read-only while viewing, and is not a button without a toggle', () => {
    render(<RoleStatusIcon role="view" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img', { name: 'Viewing (read-only)' })).toBeTruthy();
  });
});
