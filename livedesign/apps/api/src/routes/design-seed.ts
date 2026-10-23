// A created design's seeded tabs may give a `template` in place of `elements`
// (docs/specs/015-api/api.md, POST /api/designs): compiled here by the edit-operations engine's `applyReplace`,
// as a `replace` changeset compiles, so the CLI and the MCP create designs the way they replace tabs. A tab the
// engine refuses refuses the whole create, by its id, before anything is written.

import { creationIntentOf, type CreationIntent } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { applyReplace, type ReplaceBody } from '@livedesign/edit-operations';
import { engineLog } from '../changesets/log';
import { engineRefusal } from '../changesets/request';
import { isRecord } from '@livedesign/design';

type Refusal = { status: number; body: Record<string, unknown> };

type CompiledSeed = { tabs: unknown[]; intent: CreationIntent | null } | { refusal: Refusal };

// The template a seeded tab names in place of elements, as a replace body.
function sourceOf(tab: Record<string, unknown>): ReplaceBody | null {
  if (tab.template === undefined || tab.elements !== undefined) return null;
  return { template: tab.template } as ReplaceBody;
}

export function compileSeededTabs(tabs: readonly unknown[], designId: string): CompiledSeed {
  const out: unknown[] = [];
  let first: Tab | null = null;
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
      log: engineLog({ designId, tabId }),
    });
    if ('errors' in compiled) {
      console.info('[designs] seeded tab refused', {
        designId,
        tabId,
        code: compiled.errors[0]?.code,
      });
      const refusal = engineRefusal(compiled.errors);
      return { refusal: { status: refusal.status, body: { ...refusal.body, tabId } } };
    }
    console.info('[designs] seeded tab compiled', {
      designId,
      tabId,
      source: Object.keys(body)[0],
    });
    out.push({ ...rest, ...compiled.tab });
    if (index === 0) first = compiled.tab;
  }
  return { tabs: out, intent: first ? creationIntentOf(first) : null };
}
