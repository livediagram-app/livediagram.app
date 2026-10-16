// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REPO_URL, START_BLANKS } from '@livediagram/ui';
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
  it('reports every link as the page’s Closing slot and offers the Start Blank list', () => {
    render(<StartDrawingCta surface="Feature" />);
    expect(screen.getByRole('link', { name: /Start drawing/ }).getAttribute('href')).toBe(
      '/new?via=Feature.Closing',
    );
    const blanks = within(screen.getByRole('list', { name: 'Or start blank' }))
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(blanks).toEqual(START_BLANKS.map((b) => `${b.label}${b.desc}`));
    for (const a of within(screen.getByRole('list', { name: 'Or start blank' })).getAllByRole(
      'link',
    )) {
      expect(a.getAttribute('href')).toContain('via=Feature.Closing');
    }
  });
});
