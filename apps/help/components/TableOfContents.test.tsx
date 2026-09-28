// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TableOfContents } from './TableOfContents';

// The contents list is read from the article's committed headings, including an article that commits
// after the list mounts (a client-side navigation), and each heading gets the anchor its link uses.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const article = (headings: string[]) => {
  const prose = document.createElement('div');
  prose.className = 'prose-help';
  prose.innerHTML = headings.map((h) => `<h2>${h}</h2>`).join('');
  return prose;
};

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount() {
  const host = document.createElement('aside');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<TableOfContents />));
  return { host, root };
}

describe('TableOfContents', () => {
  it('lists the headings of an article already on the page, with anchors', async () => {
    document.body.appendChild(article(['First part', 'Second part']));
    const { host } = await mount();
    const links = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#first-part', '#second-part']);
    expect(document.querySelector('h2')!.id).toBe('first-part');
  });

  it('picks up an article that commits after it mounts', async () => {
    const { host } = await mount();
    expect(host.textContent).toBe('');
    await act(async () => {
      document.body.appendChild(article(['Alpha', 'Beta']));
    });
    expect(host.textContent).toContain('Alpha');
    expect(host.textContent).toContain('Beta');
  });

  it('shows nothing for a single heading', async () => {
    document.body.appendChild(article(['Only one']));
    const { host } = await mount();
    expect(host.innerHTML).toBe('');
  });
});
