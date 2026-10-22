// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REPO_URL } from '@livedocuments/ui';
import { PROMISES } from '@/lib/promises';
import { PromisePrism } from './PromisePrism';
import { StartDrawingCta } from './StartDrawingCta';

// docs/specs/019-marketing/marketing-site.md "Promises" and "Closing CTA".
describe('the promises', () => {
  it('shows every promise, each with its value, and the proof links', () => {
    render(<PromisePrism />);
    for (const p of PROMISES) {
      expect(screen.getByText(p.title)).toBeTruthy();
      expect(screen.getByText(p.value)).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: /Read the source/ }).getAttribute('href')).toBe(
      REPO_URL,
    );
    expect(screen.getByRole('link', { name: /See what we measure/ }).getAttribute('href')).toBe(
      '/telemetry/',
    );
    expect(screen.getByRole('link', { name: /How we handle data/ }).getAttribute('href')).toBe(
      '#privacy',
    );
  });
});

describe('the closing band', () => {
  it('reports every link into the editor as the page’s Closing slot, with no blank launcher', () => {
    render(<StartDrawingCta surface="Feature" />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/new?via=Feature.Closing',
      '/#templates',
    ]);
    expect(screen.queryByRole('list', { name: 'Or start blank' })).toBeNull();
  });
});
