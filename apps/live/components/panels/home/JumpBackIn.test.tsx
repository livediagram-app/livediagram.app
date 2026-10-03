// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Jump back in (docs/specs/013-workspace/explorer-home.md): a strip of thumbnails with names below,
// opening each document; a local document carries the Local only pill; the trailing edge fades
// only while more lies to the right.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string; offline?: boolean }) => (
    <span data-testid={`thumb-${p.documentId}`} data-offline={String(Boolean(p.offline))} />
  ),
}));

import { JumpBackIn } from './JumpBackIn';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';

const item = (documentId: string, over: Partial<JumpBackInItem> = {}): JumpBackInItem => ({
  documentId,
  name: `Doc ${documentId}`,
  href: `/document/${documentId}`,
  savedAt: 1,
  empty: false,
  shareCode: null,
  frecencyKey: 1,
  localOnly: false,
  ...over,
});

beforeEach(() => track.mockReset());

describe('JumpBackIn', () => {
  it('lists each document as a link with its name below its thumbnail', () => {
    render(<JumpBackIn ownerId="me" items={[item('a'), item('b')]} loading={false} />);
    const list = screen.getByRole('list', { name: 'Jump back in' });
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => [l.getAttribute('href'), l.textContent])).toEqual([
      ['/document/a', 'Doc a'],
      ['/document/b', 'Doc b'],
    ]);
    fireEvent.click(links[0]!);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn');
  });

  it('marks a document stored only in this browser', () => {
    render(<JumpBackIn ownerId="me" items={[item('l', { localOnly: true })]} loading={false} />);
    const link = screen.getByRole('link', { name: 'Doc l, Local only' });
    expect(within(link).getByText('Local only')).toBeTruthy();
    expect(screen.getByTestId('thumb-l').dataset.offline).toBe('true');
  });

  it('fades the trailing edge only while more lies to the right', () => {
    render(<JumpBackIn ownerId="me" items={[item('a'), item('b')]} loading={false} />);
    const strip = screen.getByRole('list', { name: 'Jump back in' });
    const fade = strip.nextElementSibling as HTMLElement;
    Object.defineProperties(strip, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 600, configurable: true },
      scrollLeft: { value: 0, configurable: true, writable: true },
    });
    fireEvent.scroll(strip);
    expect(fade.className).toContain('opacity-100');
    strip.scrollLeft = 300;
    fireEvent.scroll(strip);
    expect(fade.className).toContain('opacity-0');
  });

  it('says what will gather here when there is nothing yet', () => {
    render(<JumpBackIn ownerId="me" items={[]} loading={false} />);
    expect(screen.getByText('The documents you open most will gather here.')).toBeTruthy();
  });
});
