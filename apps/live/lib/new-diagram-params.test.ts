import { describe, expect, it } from 'vitest';
import { templateCreateHref, wizardBypassKind } from './new-diagram-params';

describe('wizardBypassKind (spec/14)', () => {
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

  it('builds the link the template gallery uses', () => {
    expect(templateCreateHref('swot')).toBe('/new?template=swot');
  });
});
