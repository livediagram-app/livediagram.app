// A created document's seeded tabs may give a `template` in place of `elements`
// (docs/specs/015-api/api.md, POST /api/documents): compiled here by the edit-operations engine's `applyReplace`,
// as a `replace` changeset compiles, so the CLI and the MCP create documents the way they replace tabs. A tab the
// engine refuses refuses the whole create, by its id, before anything is written.

import { CREATION_INTENT, type CreationIntent } from '@livedocuments/api-schema';
import { applyReplace, type ReplaceBody } from '@livedocuments/edit-operations';
import { engineLog } from '../changesets/log';
import { engineRefusal } from '../changesets/request';
import { isRecord } from '@livedocuments/document';

type Refusal = { status: number; body: Record<string, unknown> };

type CompiledSeed = { tabs: unknown[]; intent: CreationIntent | null } | { refusal: Refusal };

// The template a seeded tab names in place of elements, as a replace body.
function sourceOf(tab: Record<string, unknown>): ReplaceBody | null {
  if (tab.template === undefined || tab.elements !== undefined) return null;
  return { template: tab.template } as ReplaceBody;
}

export function compileSeededTabs(tabs: readonly unknown[], documentId: string): CompiledSeed {
  const out: unknown[] = [];
  let firstCompiled = false;
  for (const [index, raw] of tabs.entries()) {
    const body = isRecord(raw) && typeof raw.id === 'string' ? sourceOf(raw) : null;
    if (!isRecord(raw) || !body) {
      out.push(raw);
      continue;
    }
    const tabId = raw.id as string;
    const { template: _t, ...rest } = raw;
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
    if (index === 0) firstCompiled = true;
  }
  return { tabs: out, intent: firstCompiled ? CREATION_INTENT : null };
}

// The creation intent a create's seeded tabs give when it names none, as compileSeededTabs derives it without
// compiling: every document's, when its first tab names a template in place of elements. Null otherwise (a first
// tab the engine refuses refuses the create itself).
export function seedIntentOf(tabs: unknown): CreationIntent | null {
  if (!Array.isArray(tabs)) return null;
  const first: unknown = tabs[0];
  return isRecord(first) && typeof first.id === 'string' && sourceOf(first)
    ? CREATION_INTENT
    : null;
}
