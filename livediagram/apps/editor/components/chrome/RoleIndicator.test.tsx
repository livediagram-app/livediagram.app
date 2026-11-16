// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setRoomSuggestOnly, setSelfSuggesting } from '@liveworkspace/suggestions/room-signal';
import { RolePill, SUGGESTING_HINT, roleOwnerLabel } from './RoleIndicator';

// The role pill (docs/specs/007-editor/editor-app.md#role-pill).

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

  // Work Tracker 1035: every member of a team holds the owner's chrome on its canvases.
  it('names the team on a team canvas, for self and others alike', () => {
    expect(roleOwnerLabel('Ada', true, { name: 'Design' })).toBe('Owned by Design');
    expect(roleOwnerLabel('Ada', false, { name: 'Design' })).toBe('Owned by Design');
    expect(roleOwnerLabel(null, false, { name: null })).toBe('Owned by a team');
    expect(roleOwnerLabel('Ada', true, null)).toBe('Owned by you');
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
      'Switch to participating (as a Participant sees it)',
    );
    fireEvent.click(pill);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('names the team on a team canvas, keeping the toggle where the role allows it', () => {
    const onToggle = vi.fn();
    render(<RolePill role="edit" ownerName="Ada" isSelf team={{ name: 'Design' }} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editing. Owned by Design' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    cleanup();
    render(<RolePill role="view" ownerName="Ada" isSelf={false} team={{ name: null }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Viewing').closest('[tabindex]')!.textContent).toContain(
      'Owned by a team',
    );
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

// liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggest Only" and "Suggesting".
describe('RolePill while suggesting', () => {
  afterEach(() => {
    act(() => {
      setRoomSuggestOnly(false);
      setSelfSuggesting(false);
    });
  });

  const participantTone = () => {
    const { unmount } = render(<RolePill role="participate" ownerName={null} isSelf={false} />);
    const tone = document.querySelector('[data-role-pill]')!.className;
    unmount();
    return tone;
  };

  it('reads Suggesting in the Participant tone on Suggest Only, though its gestures run as an Editor', () => {
    const tone = participantTone();
    act(() => setRoomSuggestOnly(true));
    render(<RolePill role="edit" ownerName="Ada" isSelf={false} />);
    const pill = document.querySelector('[data-role-pill]')!;
    expect(pill.textContent).toContain('Suggesting');
    expect(pill.textContent).not.toContain('Editing');
    expect(pill.hasAttribute('data-suggesting')).toBe(true);
    expect(pill.className).toBe(tone);
    expect(pill.textContent).toContain(SUGGESTING_HINT);
  });

  it('reads Suggesting for an Editor in Suggesting mode, still a toggle, and Editing again after', () => {
    act(() => setSelfSuggesting(true));
    render(<RolePill role="edit" ownerName="Ada" isSelf onToggle={vi.fn()} />);
    const pill = screen.getByRole('button', { name: 'Suggesting. Owned by you' });
    expect(pill.hasAttribute('data-suggesting')).toBe(true);
    act(() => setSelfSuggesting(false));
    expect(screen.getByRole('button', { name: 'Editing. Owned by you' })).toBeTruthy();
  });
});
