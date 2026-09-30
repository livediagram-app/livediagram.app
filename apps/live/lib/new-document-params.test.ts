import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@livediagram/templates';
import { wantsWelcome, wizardBrowseCollection, wizardBypassKind } from './new-document-params';

describe('wizardBypassKind (docs/specs/007-editor/new-document-route.md)', () => {
  it('reads ?blank as the blank template, whatever its value', () => {
    expect(wizardBypassKind('?blank=1')).toBe('blank');
    expect(wizardBypassKind('?blank')).toBe('blank');
    expect(wizardBypassKind('?folder=f1&blank=true')).toBe('blank');
  });

  it('reads ?template=<kind> for a catalogue kind', () => {
    expect(wizardBypassKind('?template=kanban')).toBe('kanban');
    expect(wizardBypassKind('?team=t1&template=er-diagram')).toBe('er-diagram');
  });

  it('falls back to the wizard for an unknown kind or no bypass', () => {
    expect(wizardBypassKind('?template=not-a-template')).toBeNull();
    expect(wizardBypassKind('?template=')).toBeNull();
    expect(wizardBypassKind('?folder=f1')).toBeNull();
    expect(wizardBypassKind('')).toBeNull();
  });

  it('lets blank win when both are present', () => {
    expect(wizardBypassKind('?template=kanban&blank=1')).toBe('blank');
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(wizardBypassKind(templateCreateHref('swot').slice('/new'.length))).toBe('swot');
  });
});

describe('wizardBrowseCollection', () => {
  it('opens the wizard on a known collection', () => {
    expect(wizardBrowseCollection('?browse=brainstorm')).toBe('brainstorm');
    expect(wizardBrowseCollection('?folder=f1&browse=brainstorm&via=Home.HeroBrainstorm')).toBe(
      'brainstorm',
    );
  });

  it('ignores an unknown or missing collection', () => {
    expect(wizardBrowseCollection('?browse=everything')).toBeNull();
    expect(wizardBrowseCollection('')).toBeNull();
  });
});

describe('wantsWelcome (docs/specs/007-editor/new-document-route.md)', () => {
  it('rides the blank bypass', () => {
    expect(wantsWelcome('?blank=1&welcome=1')).toBe(true);
    expect(wantsWelcome('?welcome=1&blank=1&via=Home.HeroCanvas')).toBe(true);
  });

  it('does nothing without the blank bypass', () => {
    expect(wantsWelcome('?welcome=1')).toBe(false);
    expect(wantsWelcome('?template=kanban&welcome=1')).toBe(false);
    expect(wantsWelcome('?blank=1')).toBe(false);
  });
});
