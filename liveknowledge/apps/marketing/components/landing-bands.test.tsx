// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REPO_URL } from '@liveknowledge/ui';
import { LANDING_FAQ } from '@/lib/faq-content';
import { PROMISES } from '@/lib/promises';
import { AgentTranscript } from './ai/AgentTranscript';
import { BuildWithAiBand } from './BuildWithAiBand';
import { LandingFaq } from './LandingFaq';
import { PromisePrism } from './PromisePrism';
import { StartDrawingCta } from './StartDrawingCta';

// docs/specs/019-marketing/marketing-site.md "Structure" and "Closing CTA".
describe('the promises', () => {
  it('shows every promise, each with its value, and the proof links', () => {
    render(<PromisePrism />);
    for (const p of PROMISES) {
      expect(screen.getByText(p.title)).toBeTruthy();
      expect(screen.getByText(p.value)).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: /Read the Source/ }).getAttribute('href')).toBe(
      REPO_URL,
    );
    expect(screen.getByRole('link', { name: /See What We Measure/ }).getAttribute('href')).toBe(
      '/telemetry/',
    );
    expect(screen.getByRole('link', { name: /How We Handle Data/ }).getAttribute('href')).toBe(
      '#privacy',
    );
  });
});

describe('the closing band', () => {
  it('reports its link into the editor as the page’s Closing slot, then the templates', () => {
    render(<StartDrawingCta surface="Home" />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/new?via=Home.Closing',
      '/#templates',
    ]);
  });
});

describe('the Build With AI band', () => {
  const html = renderToStaticMarkup(<BuildWithAiBand />);

  it('leads to /ai and names the tools an agent calls', () => {
    expect(html).toContain('href="/ai"');
    for (const tool of ['get_context', 'search_pages', 'suggest_edit'])
      expect(html).toContain(tool);
  });

  it('draws the transcript as text with a caption, never a picture of one', () => {
    const transcript = renderToStaticMarkup(<AgentTranscript />);
    expect(transcript).toContain('<figcaption');
    expect(transcript).toContain('verified');
    expect(transcript).toContain('waiting for a person to accept');
    expect(transcript).not.toContain('<img');
  });
});

describe('the landing FAQ', () => {
  it('shows every landing question as a native details, its answer in the HTML', () => {
    const html = renderToStaticMarkup(<LandingFaq />);
    expect(html.match(/<details/g)).toHaveLength(LANDING_FAQ.length);
    for (const item of LANDING_FAQ) expect(html).toContain(item.q);
    expect(html).toContain('href="/faq"');
  });
});
