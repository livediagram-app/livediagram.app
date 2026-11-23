// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbedChrome } from './EmbedChrome';

const ONE = [{ id: 't1', name: 'Overview' }];
const TWO = [...ONE, { id: 't2', name: 'Details' }];

afterEach(cleanup);

// The embed's chrome (docs/specs/013-workspace/embeds.md "What renders"): a share-code embed links out; without a
// code there is no badge, never a dead link (Work Tracker 1386).
describe('EmbedChrome', () => {
  it('links a share-code embed out to its share view', () => {
    render(<EmbedChrome tabs={ONE} activeId="t1" onSelectTab={() => {}} shareCode="CODE2345" />);
    const link = screen.getByRole('link', { name: 'Open in livehuddle' });
    expect(link.getAttribute('href')).toBe('/document/shared?s=CODE2345');
  });

  it('draws no badge without a share code, and the tab switcher only for several tabs', () => {
    const { rerender } = render(
      <EmbedChrome tabs={ONE} activeId="t1" onSelectTab={() => {}} shareCode={null} />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<EmbedChrome tabs={TWO} activeId="t2" onSelectTab={() => {}} shareCode={null} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button').textContent).toContain('Details');
  });

  it('switches tabs from the switcher menu', () => {
    const onSelectTab = vi.fn();
    render(<EmbedChrome tabs={TWO} activeId="t2" onSelectTab={onSelectTab} shareCode={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Details/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Overview/ }));
    expect(onSelectTab).toHaveBeenCalledWith('t1');
  });
});
