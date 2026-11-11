// A created document's seeded tabs may give a `template` in place of `elements`
// (docs/specs/015-api/api.md, POST /api/documents): compiled here by the edit-operations engine's `applyReplace`,
// as a `replace` changeset compiles, so an API script creates documents the way it replaces tabs. A tab the
// engine refuses refuses the whole create, by its id, before anything is written.

import { creationIntentOf, type CreationIntent } from '@livehuddle/api-schema';
import { SHAPE_KINDS, type Tab } from '@livehuddle/document';
import { applyReplace, SHAPES_RETIRED, type ReplaceBody } from '@livehuddle/edit-operations';
import { isTemplateKind, templateKindOf, templateFamilyOf } from '@livehuddle/templates';
import { engineLog } from '../changesets/log';
import { engineRefusal } from '../changesets/request';
import { isRecord } from '@livehuddle/document';

// No `mermaid`: imports from other tools are gone, and no `graph`: the graph input went with the layout containers
// (docs/specs/002-project-scope/not-in-livehuddle.md, "The element engine", part 3). A tab that still gives one is
// refused by its id rather than stored without elements.
const SOURCES = ['template'] as const;

type Refusal = { status: number; body: Record<string, unknown> };

type CompiledSeed = { tabs: unknown[]; intent: CreationIntent | null } | { refusal: Refusal };

// The source a seeded tab names, when it names exactly one and no elements.
function sourceOf(tab: Record<string, unknown>): ReplaceBody | null {
  const given = SOURCES.filter((key) => tab[key] !== undefined);
  if (given.length !== 1 || tab.elements !== undefined) return null;
  const key = given[0]!;
  return { [key]: tab[key] } as ReplaceBody;
}

// The first shape in a seeded tab's elements of a kind livehuddle does not have, if any.
function retiredShapeIn(tab: Record<string, unknown>): string | null {
  if (!Array.isArray(tab.elements)) return null;
  for (const el of tab.elements)
    if (isRecord(el) && el.type === 'shape' && !SHAPE_KINDS.has(String(el.shape)))
      return String(el.shape);
  return null;
}

// `agent`: the create came from an API token. Its seeded elements are new, so a shape of a kind livehuddle does not
// have is refused (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5, D31). The editor's
// own creates (a copy, an Offline Mode re-commit) carry stored tabs, which keep any retired element as stored.
export function compileSeededTabs(
  tabs: readonly unknown[],
  documentId: string,
  { agent = false }: { agent?: boolean } = {},
): CompiledSeed {
  const out: unknown[] = [];
  let first: { tab: Tab; template: string | null } | null = null;
  for (const [index, raw] of tabs.entries()) {
    if (isRecord(raw) && raw.graph !== undefined) {
      console.info('[documents] seeded tab refused', { documentId, tabId: raw.id, code: 'graph' });
      return {
        refusal: {
          status: 400,
          body: {
            error: 'invalid_body',
            message:
              'a seeded tab\'s "graph" is no longer supported in livehuddle: give elements or a template',
            ...(typeof raw.id === 'string' ? { tabId: raw.id } : {}),
          },
        },
      };
    }
    const retired = agent && isRecord(raw) ? retiredShapeIn(raw) : null;
    if (retired !== null) {
      const tabId = (raw as Record<string, unknown>).id;
      console.info('[documents] seeded tab refused', { documentId, tabId, code: 'shape' });
      return {
        refusal: {
          status: 400,
          body: {
            error: 'invalid_body',
            message: `shape=${JSON.stringify(retired)}: ${SHAPES_RETIRED}`,
            ...(typeof tabId === 'string' ? { tabId } : {}),
          },
        },
      };
    }
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
    if (index === 0)
      first = { tab: compiled.tab, template: typeof template === 'string' ? template : null };
  }
  const family =
    first?.template && isTemplateKind(first.template) ? templateFamilyOf(first.template) : null;
  return {
    tabs: out,
    intent: first ? creationIntentOf(first.tab, family) : null,
  };
}

// The intent the index files an API client's create by when the create names none: the template family of its first
// seeded tab, the part of an intent the index's default folders key on (index-client placementDefaultKeysFor).
// Read from the body as sent, before anything is compiled. Null when the first tab names no known template.
export function seedIntentOf(tabs: unknown): string | null {
  if (!Array.isArray(tabs) || !isRecord(tabs[0])) return null;
  const template = tabs[0].template;
  return typeof template === 'string' && isTemplateKind(template)
    ? templateFamilyOf(template)
    : null;
}
