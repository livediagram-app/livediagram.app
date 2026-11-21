// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETUP_STRUCTURES } from '@liveknowledge/knowledge';
import { StructurePreview } from './StructurePreview';
import { TemplateGallery } from './TemplateGallery';

// jsdom lays nothing out: the carousel's scroll and size readers and the shelf's motion query get quiet stand-ins.
Element.prototype.scrollTo = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = ((q: string) => ({
  matches: false,
  media: q,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia;
window.scrollTo = () => {};

// docs/specs/019-marketing/marketing-site.md "Structure" 3: the gallery's cards are knowledgebase structures, each a
// picture of the knowledgebase it makes and a link that makes a new knowledgebase from it.
describe('the template gallery', () => {
  it('opens on Company, each card a structure linking to /new?structure=', () => {
    render(<TemplateGallery />);
    const cards = [...document.querySelectorAll<HTMLAnchorElement>('[data-structure-card]')];
    expect(cards.map((c) => c.dataset.structureCard)).toEqual([
      'company-knowledgebase',
      'team-handbook',
      'onboarding',
      'people-operations',
    ]);
    const handbook = cards[1]!;
    expect(handbook.getAttribute('href')).toBe('/new?structure=team-handbook&via=Home.Gallery');
    expect(handbook.textContent).toContain('Team Handbook');
    expect(handbook.textContent).toContain('11 Pages');
    // Its picture: its top pages in the tree, How We Work chosen and opened on two of its subpages.
    const art = handbook.querySelector('[data-structure-art="team-handbook"]')!;
    expect(art.textContent).toContain('WelcomeWho We AreHow We WorkMeetingsCommunication');
    // Its name starts with its own visible title (WCAG 2.5.3); the picture is decoration.
    expect(handbook.querySelector('.sr-only')!.textContent).toBe('Create a ');
    expect(art.getAttribute('aria-hidden')).toBe('true');
  });

  it('leads the folded groups with Blank Knowledgebase, and opens a group in place', () => {
    render(<TemplateGallery />);
    const blank = document.querySelector<HTMLAnchorElement>('[data-start-tile]')!;
    expect(blank.textContent).toContain('Blank Knowledgebase');
    expect(blank.getAttribute('href')).toBe('/new?template=blank-article&via=Home.Gallery');
    fireEvent.click(screen.getByRole('button', { name: /Customers/ }));
    const cards = [...document.querySelectorAll<HTMLElement>('[data-structure-card]')];
    expect(cards.map((c) => c.dataset.structureCard)).toEqual([
      'support-knowledgebase',
      'sales-playbook',
      'customer-success',
      'marketing-playbook',
    ]);
  });

  it('lists the folded groups’ structures as plain links, A to Z', () => {
    render(<TemplateGallery />);
    const index = within(screen.getByText('Every Template A to Z').closest('details')!);
    const links = index.getAllByRole('link');
    expect(links).toHaveLength(SETUP_STRUCTURES.length - 4);
    expect(links.map((a) => a.textContent)).toContain('Sales Playbook');
    expect(index.getByRole('link', { name: 'Design System' }).getAttribute('href')).toBe(
      '/new?structure=design-system&via=Home.Gallery',
    );
  });
});

describe('a structure’s small drawing', () => {
  it('draws its tree: each top page, the first with subpages opened on two, at most six rows', () => {
    const { container } = render(<StructurePreview kind="engineering-handbook" />);
    // Overview; Architecture (chosen) + 2; Services; Data, cut at six rows. Then the emblem's group.
    expect(container.querySelectorAll('svg > g')).toHaveLength(7);
    // Its cover in Engineering's colour.
    expect(container.querySelector('linearGradient')).not.toBeNull();
  });

  it('draws one page, Start Here, for the blank, with no cover', () => {
    const { container } = render(<StructurePreview kind="blank-article" />);
    expect(container.querySelectorAll('svg > g')).toHaveLength(2);
    expect(container.querySelector('linearGradient')).toBeNull();
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});
