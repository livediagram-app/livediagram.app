// A created project's seeded tabs may give a `template` in place of `elements`
// (docs/specs/015-api/api.md, POST /api/projects): compiled here by the edit-operations engine's `applyReplace`,
// as a `replace` changeset compiles, so the CLI and the MCP create projects the way they replace tabs. A tab the
// engine refuses refuses the whole create, by its id, before anything is written.

import { creationIntentOf, type CreationIntent } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import { applyReplace, type ReplaceBody } from '@liveplanner/edit-operations';
import {
  buildTemplateTabs,
  isTemplateKind,
  templateKindOf,
  templateFamilyOf,
  templateTabName,
} from '@liveplanner/templates';
import { engineLog } from '../changesets/log';
import { engineRefusal } from '../changesets/request';
import { isRecord } from '@liveplanner/project';

const SOURCES = ['template'] as const;

type Refusal = { status: number; body: Record<string, unknown> };

// `templateElements`: the elements of every tab a template made, whose Plan boards bring their card types
// (docs/specs/026-plan/plan-templates.md "Card types a template uses").
type CompiledSeed =
  | { tabs: unknown[]; intent: CreationIntent | null; templateElements: Tab['elements'] }
  | { refusal: Refusal };

// The source a seeded tab names, when it names exactly one and no elements.
function sourceOf(tab: Record<string, unknown>): ReplaceBody | null {
  const given = SOURCES.filter((key) => tab[key] !== undefined);
  if (given.length !== 1 || tab.elements !== undefined) return null;
  const key = given[0]!;
  return { [key]: tab[key] } as ReplaceBody;
}

// The first tab's name, by the templates' own rule (templateTabName); any other tab takes the name given.
export function seededTabName(given: string, template: unknown): string {
  return typeof template === 'string' && isTemplateKind(template)
    ? templateTabName(given, template)
    : given;
}

export function compileSeededTabs(tabs: readonly unknown[], projectId: string): CompiledSeed {
  const out: unknown[] = [];
  let first: { tab: Tab; template: string | null } | null = null;
  const templateElements: Tab['elements'] = [];
  for (const [index, raw] of tabs.entries()) {
    const body = isRecord(raw) && typeof raw.id === 'string' ? sourceOf(raw) : null;
    if (!isRecord(raw) || !body) {
      out.push(raw);
      continue;
    }
    const tabId = raw.id as string;
    const { template: given, ...rest } = raw;
    // A retired template's kind makes its replacement (templateKindOf).
    const template = templateKindOf(given) ?? given;
    const compiled = applyReplace(null, body, {
      tabId,
      name: seededTabName(typeof raw.name === 'string' ? raw.name : 'Tab', template),
      ...(typeof raw.theme === 'string' ? { themeId: raw.theme } : {}),
      log: engineLog({ projectId, tabId }),
    });
    if ('errors' in compiled) {
      console.info('[projects] seeded tab refused', {
        projectId,
        tabId,
        code: compiled.errors[0]?.code,
      });
      const refusal = engineRefusal(compiled.errors);
      return { refusal: { status: refusal.status, body: { ...refusal.body, tabId } } };
    }
    console.info('[projects] seeded tab compiled', {
      projectId,
      tabId,
      source: Object.keys(body)[0],
    });
    out.push({ ...rest, ...compiled.tab });
    // A template of several tabs (docs/specs/026-plan/plan-templates.md "How a template with tabs is
    // made"): the replace filled this tab with its first; the rest follow it, each with a fresh id.
    if (typeof template === 'string' && isTemplateKind(template)) {
      templateElements.push(...compiled.tab.elements);
      const [, ...followers] = buildTemplateTabs(
        { id: tabId, name: compiled.tab.name },
        template,
        () => crypto.randomUUID(),
        typeof raw.theme === 'string' ? raw.theme : undefined,
      );
      out.push(...followers);
      for (const f of followers) templateElements.push(...f.elements);
    }
    if (index === 0)
      first = { tab: compiled.tab, template: typeof template === 'string' ? template : null };
  }
  const family =
    first?.template && isTemplateKind(first.template) ? templateFamilyOf(first.template) : null;
  return {
    tabs: out,
    intent: first ? creationIntentOf(first.tab, family) : null,
    templateElements,
  };
}
