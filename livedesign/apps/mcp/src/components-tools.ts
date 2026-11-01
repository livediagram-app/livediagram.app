// The components tool (docs/specs/015-api/mcp-server.md §4.9e): change_components, over the calls the CLI's
// `component` verbs share (@livedesign/agent-verbs). One change a call: make a main of elements (stored, then one
// instance put in their place as a changeset), patch a main, or detach an instance (the `detach` edit operation).
// A refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ChangesetResponse } from '@livedesign/api-schema';
import {
  componentSummary,
  patchComponent,
  prepareMakeComponent,
  safeRef,
  storedButNotPlaced,
} from '@livedesign/agent-verbs';
import { mcpChangeComponents } from '@livedesign/agent-verbs/mcp';
import { computeRefs, resolveRef, type ComponentPatch, type Element } from '@livedesign/design';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { clientFor } from './api';
import {
  changesetErrorText,
  editsBase,
  isChangesetRefusal,
  mcpResultText,
  submitChangeset,
} from './changeset-client';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, loadTab, requireToken, textResult } from './tool-helpers';

type Answer = {
  component: ReturnType<typeof componentSummary> | null;
  lines: string[];
  rev: number | null;
};

const linesOf = (response: ChangesetResponse) =>
  mcpResultText(response.text).split('\n').filter(Boolean);

// The always-safe ref of the element a word names on the tab, so the api resolves the same element; a word naming
// nothing goes as given, for the api to refuse with candidates.
function refOn(elements: readonly Element[], word: string): string {
  const found = resolveRef(word, computeRefs(elements.map((e) => e.id)));
  return found.kind === 'found' ? safeRef(found.id) : word;
}

export function registerComponentsTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpChangeComponents, async (args, extra) => {
    const token = requireToken(extra);
    const given = [args.make, args.patch, args.detach].filter((x) => x !== undefined).length;
    if (given !== 1) return errorResult('Give exactly one of "make", "patch" and "detach".');
    const { designId } = args;
    const answer = (a: Answer) => textResult({ designId, ...a, url: deepLink(env, designId) });

    if (args.patch) {
      const { componentId, ...rest } = args.patch;
      const done = await patchComponent(
        clientFor(env, token),
        designId,
        componentId,
        rest as ComponentPatch,
      );
      if (!done.ok) return errorResult(done.message);
      console.info('[mcp] change_components patch', { elements: done.component.elements.length });
      return answer({ component: componentSummary(done.component), lines: [], rev: null });
    }

    const step = (args.make ?? args.detach)!;
    const loaded = await loadTab(env, token, designId, step.tabId);
    if (!loaded) return errorResult('That design has no tabs.');
    const { tab } = loaded;

    if (args.detach) {
      let response: ChangesetResponse;
      try {
        response = await submitChangeset(env, token, designId, tab.id, {
          operations: [{ op: 'detach', target: refOn(tab.elements, args.detach.instance) }],
          base: editsBase(tab),
        });
      } catch (err) {
        if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
        throw err;
      }
      console.info('[mcp] change_components detach');
      return answer({
        component: null,
        lines: linesOf(response),
        rev: response.changeset?.rev ?? tab.rev,
      });
    }

    const make = args.make!;
    const prepared = await prepareMakeComponent(clientFor(env, token), designId, tab, {
      refs: make.elementIds,
      ...(make.name ? { name: make.name } : {}),
      now: Date.now(),
    });
    // The refusal's message only: its hint names a CLI command.
    if (!prepared.ok) return errorResult(prepared.message);
    let response: ChangesetResponse;
    try {
      response = await submitChangeset(env, token, designId, tab.id, {
        operations: prepared.plan.operations,
        base: prepared.plan.base,
      });
    } catch (err) {
      if (isChangesetRefusal(err))
        return errorResult(`${changesetErrorText(err)}\n${storedButNotPlaced(prepared.component)}`);
      throw err;
    }
    console.info('[mcp] change_components make', {
      elements: prepared.component.elements.length,
    });
    return answer({
      component: componentSummary(prepared.component),
      lines: linesOf(response),
      rev: response.changeset?.rev ?? tab.rev,
    });
  });
}
