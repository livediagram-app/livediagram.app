import { describe, expect, it } from 'vitest';
import {
  automationTabTemplateNames,
  automationTabTemplates,
  TEMPLATES,
  templateKindOf,
} from './index';

// The templates Add a Tab from a Template offers (docs/specs/013-workspace/automations.md "Steps of its own").
describe('automationTabTemplates', () => {
  it('lists every template the library lists, by kind and title, the hidden ones left out', () => {
    const listed = automationTabTemplates();
    expect(listed.length).toBe(TEMPLATES.filter((t) => !t.hidden).length);
    for (const t of listed) {
      expect(templateKindOf(t.id)).toBe(t.id);
      expect(t.name.length).toBeGreaterThan(0);
    }
    expect(new Set(listed.map((t) => t.id)).size).toBe(listed.length);
    // The same list every time it is asked.
    expect(automationTabTemplates()).toBe(listed);
  });

  it('names them by id for a rule’s words', () => {
    const names = automationTabTemplateNames();
    const [first] = automationTabTemplates();
    expect(names.size).toBe(automationTabTemplates().length);
    expect(names.get(first!.id)).toBe(first!.name);
  });
});
