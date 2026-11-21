// The templates a rule's Add a Tab from a Template step may name (docs/specs/013-workspace/automations.md "Steps of
// its own"): the library as the API lists it (template-catalogue.ts), so the picker and the room offer the same
// ones. A template's id is its kind; a retired kind still reads as its replacement
// (templateKindOf).
import { templateCatalogue } from './template-catalogue';

export type AutomationTabTemplate = { id: string; name: string };

let listed: readonly AutomationTabTemplate[] | null = null;

/** Every template Add a Tab from a Template offers, in the library's order. */
export function automationTabTemplates(): readonly AutomationTabTemplate[] {
  listed ??= templateCatalogue().templates.map((t) => ({ id: t.kind, name: t.title }));
  return listed;
}

/** Their names by id, as a rule's words name a template (`ItemNames.templates`). */
export function automationTabTemplateNames(): ReadonlyMap<string, string> {
  return new Map(automationTabTemplates().map((t) => [t.id, t.name]));
}
