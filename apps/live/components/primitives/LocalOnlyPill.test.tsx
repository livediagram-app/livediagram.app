// @vitest-environment jsdom

// The Local only pill (docs/specs/006-document/offline-mode.md#local-only-pill).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY_DESCRIPTION, LocalOnlyPill } from './LocalOnlyPill';

afterEach(cleanup);

describe('LocalOnlyPill', () => {
  it('says Local only in words beside an icon, not by colour alone', () => {
    render(<LocalOnlyPill />);
    const pill = screen.getByRole('link', { name: /Local only/ });
    expect(pill.textContent).toContain('Local only');
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('describes what it means to assistive technology', () => {
    render(<LocalOnlyPill />);
    const pill = screen.getByRole('link', { name: /Local only/ });
    const id = pill.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe(LOCAL_ONLY_DESCRIPTION);
  });

  it('warns that clearing the browser loses the document', () => {
    expect(LOCAL_ONLY_DESCRIPTION).toMatch(/only in this browser/);
    expect(LOCAL_ONLY_DESCRIPTION).toMatch(/site data/);
  });

  it('links the Offline Mode guide in a new tab', () => {
    render(<LocalOnlyPill />);
    const pill = screen.getByRole('link', { name: /Local only/ });
    expect(pill.getAttribute('href')).toBe('/help/privacy-and-security/offline-mode/');
    expect(pill.getAttribute('target')).toBe('_blank');
  });

  it('keeps a click on it from opening the row beneath', () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <LocalOnlyPill />
      </div>,
    );
    fireEvent.click(screen.getByRole('link', { name: /Local only/ }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it('leaves the tab order to a tree that owns it', () => {
    render(<LocalOnlyPill tabbable={false} />);
    expect(screen.getByRole('link', { name: /Local only/ }).getAttribute('tabindex')).toBe('-1');
  });

  it('is a plain label, description included, inside a single control', () => {
    render(
      <button type="button">
        Plan <LocalOnlyPill asLabel />
      </button>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Local only');
    expect(button.textContent).toContain(LOCAL_ONLY_DESCRIPTION);
  });
});
