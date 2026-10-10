// A created document's seeded tabs may give `graph`, `mermaid` or `template` in place of `elements`
// (docs/specs/015-api/api.md, POST /api/documents): compiled here by the edit-operations engine's `applyReplace`,
// as a `replace` changeset compiles, so the CLI and the MCP create documents the way they replace tabs. A tab the
// engine refuses refuses the whole create, by its id, before anything is written.

import { creationIntentOf, type CreationIntent } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import { applyReplace, type ReplaceBody } from '@livediagram/edit-operations';
import { buildTemplateTabs, isTemplateKind, templateFamilyOf } from '@livediagram/templates';
import { engineLog } from '../changesets/log';
import { engineRefusal } from '../changesets/request';
import { isRecord } from '@livediagram/document';

const SOURCES = ['graph', 'mermaid', 'template'] as const;

type Refusal = { status: number; body: Record<string, unknown> };

// `templateElements`: the elements of every tab a template made, whose Plan boards bring their card types
// (docs/specs/026-plan/plan-templates.md "Card types a template uses").
export type CompiledSeed =
  | { tabs: unknown[]; intent: CreationIntent | null; templateElements: Tab['elements'] }
  | { refusal: Refusal };

// The source a seeded tab names, when it names exactly one and no elements.
function sourceOf(tab: Record<string, unknown>): ReplaceBody | null {
  const given = SOURCES.filter((key) => tab[key] !== undefined);
  if (given.length !== 1 || tab.elements !== undefined) return null;
  const key = given[0]!;
  return { [key]: tab[key] } as ReplaceBody;
}

export function compileSeededTabs(tabs: readonly unknown[], documentId: string): CompiledSeed {
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
    const { graph: _g, mermaid: _m, template, ...rest } = raw;
    const compiled = applyReplace(null, body, {
      tabId,
      name: typeof raw.name === 'string' ? raw.name : 'Tab',
      ...(typeof raw.theme === 'string' ? { themeId: raw.theme } : {}),
      log: engineLog({ documentId, tabId }),
    });
    if ('errors' in compiled) {
      console.info('[documents] seeded tab refused', {
        documentId,
        tabId,
        code: compiled.errors[0]?.code,
      });
      const refusal = engineRefusal(compiled.errors);
      return { refusal: { status: refusal.status, body: { ...refusal.body, tabId } } };
    }
    console.info('[documents] seeded tab compiled', {
      documentId,
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
