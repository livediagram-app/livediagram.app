// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ScreenTabs, screenPanelId, screenTabId, screenTabKey, type ScreenTab } from './ScreenTabs';

// docs/specs/026-plan/automations.md "The Automations screen": the tabs are one Tab stop, the arrows, Home and End
// open the next tab, the open tab names the panel, and the Runs today meter stands beside the tab list, not in it.

afterEach(cleanup);

function Screen({ phone = false }: { phone?: boolean }) {
  const [tab, setTab] = useState<ScreenTab>('rules');
  return (
    <>
      <ScreenTabs
        idPrefix="s"
        current={tab}
        rules={2}
        phone={phone}
        meter={<div role="meter" aria-label="Runs today" aria-valuenow={1} />}
        onTab={setTab}
      />
      <div role="tabpanel" id={screenPanelId('s')} aria-labelledby={screenTabId('s', tab)} />
    </>
  );
}

const tabs = () => screen.getAllByRole('tab');

describe('Automations screen tabs', () => {
  it('holds only tabs in the tab list, the meter beside it', () => {
    render(<Screen />);
    const list = screen.getByRole('tablist', { name: 'Automations' });
    expect(Array.from(list.children).every((c) => c.getAttribute('role') === 'tab')).toBe(true);
    expect(list.contains(screen.getByRole('meter', { name: 'Runs today' }))).toBe(false);
  });

  it('is one Tab stop, the open tab, which names the panel it controls', () => {
    render(<Screen />);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    const open = screen.getByRole('tab', { name: 'Rules · 2' });
    expect(open.getAttribute('aria-controls')).toBe(screenPanelId('s'));
    expect(screen.getByRole('tabpanel', { name: 'Rules · 2' })).toBeTruthy();
  });

  it('opens the next tab with the arrows, wrapping, and moves focus with it', () => {
    render(<Screen />);
    tabs()[0]!.focus();
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' });
    const runs = screen.getByRole('tab', { name: 'Audit Trail' });
    expect(runs.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(runs);
    expect(screen.getByRole('tabpanel', { name: 'Audit Trail' })).toBeTruthy();
    fireEvent.keyDown(runs, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Templates' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rules · 2' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Templates' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rules · 2' }));
  });

  it('leaves other keys alone', () => {
    expect(screenTabKey('ArrowDown', 'rules')).toBeNull();
    expect(screenTabKey('Enter', 'runs')).toBeNull();
  });

  it('keeps the meter out of the bar on a phone, where the dialog draws it', () => {
    render(<Screen phone />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(tabs()).toHaveLength(3);
  });
});
