// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiClients } from '../../lib/ai-clients';
import { AiCapabilityGrid } from './AiCapabilityGrid';
import { BuildWithAi, CROSS_APP_PROMPTS_HREF, type BuildWithAiProps } from './BuildWithAi';

// docs/specs/019-marketing/build-with-ai.md, in each product, and liveworkspace/docs/specs/010-site/site.md "Build with
// AI": one page body for every product and for liveworkspace.app.
const MCP_URL = 'https://mcp.liveworkspace.app/mcp';
const Icon = () => <svg />;

// The client picker reads the layout's width as it mounts.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);
afterEach(() => vi.unstubAllGlobals());

function page(extra: Partial<BuildWithAiProps> = {}) {
  const product = { name: 'livediagram', mcpUrl: MCP_URL, ...extra };
  return render(
    <BuildWithAi
      clients={aiClients(product)}
      prompts={[{ title: 'Map a codebase', prompt: 'Draw it.' }]}
      heroLede="Lede"
      ask="a diagram"
      art={<span />}
      capabilities={<AiCapabilityGrid items={[{ icon: Icon, title: 'Draw', body: 'Boxes.' }]} />}
      controlLead="Control"
      helpGuide="/help/guide/"
      {...product}
    />,
  );
}

describe('BuildWithAi', () => {
  it('on a product: its name ticked, /get-started, and a link to the prompts that cross apps', () => {
    const { container } = page();
    expect(screen.getByText(/keep livediagram ticked/)).toBeTruthy();
    expect(screen.getByText('Everything you make in livediagram')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create a free account' }).getAttribute('href')).toBe(
      '/get-started',
    );
    const cross = screen.getByRole('link', { name: 'Prompts That Cross Apps' });
    expect(cross.getAttribute('href')).toBe(CROSS_APP_PROMPTS_HREF);
    expect(CROSS_APP_PROMPTS_HREF).toMatch(/\/ai#prompts$/);
    expect(container.querySelector('ul.lg\\:grid-cols-3')).toBeTruthy();
  });

  it('on liveworkspace.app: every app ticked, its own words, no link to itself', () => {
    page({
      name: 'liveworkspace',
      ticked: 'every app you want',
      cli: false,
      signUpHref: '/sign-up',
      crossApp: false,
      capabilitiesTitle: 'Every app, one connection',
      promptsLead: 'Each starts in one app.',
    });
    expect(screen.getByText(/keep every app you want ticked/)).toBeTruthy();
    expect(screen.getByText('Every app, one connection')).toBeTruthy();
    expect(screen.getByText('Each starts in one app.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create a free account' }).getAttribute('href')).toBe(
      '/sign-up',
    );
    expect(screen.queryByRole('link', { name: 'Prompts That Cross Apps' })).toBeNull();
  });
});

describe('AiCapabilityGrid', () => {
  it('lays eight cards in four columns when asked', () => {
    const { container } = render(
      <AiCapabilityGrid columns={4} items={[{ icon: Icon, title: 'A', body: 'B' }]} />,
    );
    expect(container.querySelector('ul')!.className).toContain('lg:grid-cols-4');
    expect(screen.getByRole('heading', { name: 'A' })).toBeTruthy();
  });
});
