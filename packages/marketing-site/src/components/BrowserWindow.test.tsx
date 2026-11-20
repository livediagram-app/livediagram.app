// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrowserWindow, workAddress } from './BrowserWindow';

describe('workAddress', () => {
  it('writes the site, the route and a ten-character id made from the name', () => {
    const address = workAddress('livediagram.app', 'document', 'Sign-up flow');
    expect(address).toMatch(/^livediagram\.app\/document\/[a-km-zA-HJ-NP-Z2-9]{10}$/);
  });

  it('gives a name the same id every time, and different names different ids', () => {
    expect(workAddress('a.app', 'd', 'Launch')).toBe(workAddress('a.app', 'd', 'Launch'));
    expect(workAddress('a.app', 'd', 'Launch')).not.toBe(workAddress('a.app', 'd', 'Launch plan'));
  });
});

describe('BrowserWindow', () => {
  it('shows the host strong and the path faint, around the screen it is given', () => {
    const { container, getByText } = render(
      <BrowserWindow address="liveplanner.app/project/abc">
        <p>The board</p>
      </BrowserWindow>,
    );
    expect(getByText('liveplanner.app').className).toContain('font-medium');
    expect(getByText('/project/abc').className).toContain('text-slate-400');
    expect(getByText('The board')).toBeTruthy();
    // The browser's toolbar is chrome, hidden from assistive tech; the screen is the caller's to mark.
    expect(container.querySelector('[aria-hidden]')?.textContent).toContain('liveplanner.app');
    expect(getByText('The board').closest('[aria-hidden]')).toBeNull();
  });

  it('shows a bare host with no path', () => {
    const { getByText } = render(
      <BrowserWindow address="livedesign.app" className="extra">
        <span />
      </BrowserWindow>,
    );
    expect(getByText('livedesign.app')).toBeTruthy();
  });
});
