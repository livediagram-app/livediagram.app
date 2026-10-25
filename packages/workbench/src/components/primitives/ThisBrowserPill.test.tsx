// @vitest-environment jsdom

// The This Browser pill (each product's docs/specs/006-*/offline-mode.md#this-browser-pill), one for every editor.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THIS_BROWSER_DESCRIPTION, ThisBrowserPill } from './ThisBrowserPill';

afterEach(cleanup);

const HELP = '/help/privacy-and-security/offline-mode/';

describe('ThisBrowserPill', () => {
  it('says This Browser in words beside an icon, not by colour alone', () => {
    render(<ThisBrowserPill helpHref={HELP} />);
    const pill = screen.getByRole('link', { name: /This Browser/ });
    expect(pill.textContent).toContain('This Browser');
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('is teal, no app accent and no status colour', () => {
    render(<ThisBrowserPill helpHref={HELP} />);
    const pill = screen.getByRole('link', { name: /This Browser/ });
    expect(pill.className).toContain('bg-teal-50');
    expect(pill.className).toContain('ring-teal-600');
    expect(pill.className).not.toMatch(/amber|emerald|red-|sky-|violet|rose/);
  });

  it('describes what it means to assistive technology', () => {
    render(<ThisBrowserPill helpHref={HELP} />);
    const pill = screen.getByRole('link', { name: /This Browser/ });
    const id = pill.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe(THIS_BROWSER_DESCRIPTION);
  });

  it('warns that clearing the browser loses the item', () => {
    expect(THIS_BROWSER_DESCRIPTION).toMatch(/only in this browser/);
    expect(THIS_BROWSER_DESCRIPTION).toMatch(/site data/);
  });

  it('links the Offline Mode guide in a new tab, and reports it opening', () => {
    const onOpenHelp = vi.fn();
    render(<ThisBrowserPill helpHref={HELP} onOpenHelp={onOpenHelp} />);
    const pill = screen.getByRole('link', { name: /This Browser/ });
    expect(pill.getAttribute('href')).toBe(HELP);
    expect(pill.getAttribute('target')).toBe('_blank');
    fireEvent.click(pill);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('keeps a click on it from opening the row beneath', () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <ThisBrowserPill helpHref={HELP} />
      </div>,
    );
    fireEvent.click(screen.getByRole('link', { name: /This Browser/ }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it('leaves the tab order to a tree that owns it', () => {
    render(<ThisBrowserPill helpHref={HELP} tabbable={false} />);
    expect(screen.getByRole('link', { name: /This Browser/ }).getAttribute('tabindex')).toBe('-1');
  });

  it('is a plain label, description included, inside a single control', () => {
    render(
      <button type="button">
        Plan <ThisBrowserPill asLabel />
      </button>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('This Browser');
    expect(button.textContent).toContain(THIS_BROWSER_DESCRIPTION);
  });
});
