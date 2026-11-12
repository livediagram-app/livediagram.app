// add_tab and update_document (docs/specs/015-api/mcp-server.md §4): a tab added to a document, from a template or
// the calling model's elements, and a tab's elements changed by replace, ops or edits, each one changeset the api
// applies and relays. registerTools (tools.ts) calls registerTabTools in their place, so the tools list in the same order.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ChangesetRequest, TabResponse } from '@livedocuments/api-schema';
import { contentOrigin } from '@livedocuments/document';
import {
  resolveTemplate,
  validTemplateKinds,
  closestTemplatesHint,
} from '@livedocuments/templates';
import { apiJson } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { deepLink, errorResult, loadTab, requireToken } from './tool-helpers';
import { lintLineOf, lintReportsOf, lintTextOf } from './lint-summary';
import { idsOf, resolveArrowEnds } from './arrow-ends';
import { elementsIssue } from './element-values';
import { packFreehandPoints } from './freehand-points';
import { imageResult } from './image-result';
import { addOperationsFor, addToTemplateTab, getTab } from './template-elements';
import { imageIdIssue } from './image-tools';
import {
  baseFor,
  changesetErrorText,
  editsBase,
  isChangesetRefusal,
  mcpOpsToEditOperations,
  mcpResultText,
  replaceBodyFrom,
  submitChangeset,
} from './changeset-client';
import { registerTool } from './tool-annotations';
import { mcpAddTab, mcpUpdateDocument } from '@livedocuments/agent-verbs/mcp';

export function registerTabTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpAddTab, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    const tabId = crypto.randomUUID();
    // Template tab (docs/specs/015-api/mcp-server.md §4.5): resolved up front so an unknown kind
    // fails before any network round trip.
    if (args.template && !resolveTemplate(args.template)) {
      return errorResult(
        `Unknown template "${args.template}". ${closestTemplatesHint(args.template)}Valid kinds: ${validTemplateKinds()}.`,
      );
    }
    if (!args.template && !args.elements) {
      return errorResult(
        'Invalid input. Provide "elements", or a "template" kind from list_templates. Check the ' +
          'livedocuments://schema/elements resource.',
      );
    }
    const drawn = args.elements ? packFreehandPoints(args.elements) : null;
    if (drawn && 'error' in drawn) return errorResult(drawn.error);
    const given = drawn?.elements;
    const valueIssue = given ? elementsIssue(given) : null;
    if (valueIssue) return errorResult(valueIssue);
    const ended = given ? resolveArrowEnds(given, idsOf(given)) : null;
    if (ended && 'error' in ended) return errorResult(ended.error);
    // Default the new tab's theme to the document's existing one so it matches the other tabs
    // rather than landing as a clashing brand-white tab; the model can still pass a theme.
    let themeId = args.theme;
    if (!themeId) {
      try {
        themeId = (await loadTab(env, token, args.documentId))?.tab.theme;
      } catch {
        /* the api keeps its default */
      }
    }
    // One changeset that creates the tab, so anyone with the document open sees it arrive
    // (docs/specs/015-api/mcp-server.md §4.3a).
    let answer;
    try {
      answer = await submitChangeset(env, token, args.documentId, tabId, {
        replace: replaceBodyFrom({
          ...(args.template ? { template: args.template } : {}),
          ...(ended ? { elements: ended.elements } : {}),
          ...(args.layout ? { layout: args.layout } : {}),
          ...(themeId ? { theme: themeId } : {}),
          ...(args.finish ? { finish: args.finish } : {}),
          name: args.name,
        }),
      });
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    // Elements given beside a template are added to the tab it built, as update_document's add ops would.
    if (args.template && args.elements?.length) {
      const built = await getTab(env, token, args.documentId, tabId);
      const added = addOperationsFor(args.elements, built);
      if ('error' in added)
        return errorResult(`The tab was made, but its elements: ${added.error}`);
      try {
        answer = await addToTemplateTab(
          env,
          token,
          args.documentId,
          tabId,
          built,
          added.operations,
        );
      } catch (err) {
        if (isChangesetRefusal(err))
          return errorResult(
            `The tab was made, but its elements were refused: ${changesetErrorText(err)}`,
          );
        throw err;
      }
    }
    // The result PNG: the tab as stored, read once more (CS36).
    const { tab } = await apiJson<TabResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    return imageResult(
      {
        documentId: args.documentId,
        tabId,
        name: tab.name,
        url: deepLink(env, args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: tab.rev,
        text: mcpResultText(answer.text),
        lint: lintLineOf(answer.lint),
      },
      tab,
      { env, token },
      [lintTextOf(answer.lint)],
    );
  });

  registerTool(server, env, mcpUpdateDocument, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    const loaded = await loadTab(env, token, args.documentId, args.tabId);
    if (!loaded) return errorResult('That document has no tabs.');
    const { tab } = loaded;
    const tabId = tab.id;
    // Both modes are one changeset (docs/specs/015-api/mcp-server.md §4.4): applied, laid out and
    // relayed by the api, kept through anyone's next save. ops mode is based on what the model
    // read, so nothing a person saved in between is overwritten.
    let body: ChangesetRequest;
    if (args.mode === 'replace') {
      if (!args.elements) {
        return errorResult('replace mode requires "elements".');
      } else {
        const drawn = args.elements ? packFreehandPoints(args.elements) : null;
        if (drawn && 'error' in drawn) return errorResult(drawn.error);
        const given = drawn?.elements;
        const valueIssue = given ? elementsIssue(given) : null;
        if (valueIssue) return errorResult(valueIssue);
        // The new elements are the whole tab, so an arrow end may name only them.
        const ended = given ? resolveArrowEnds(given, idsOf(given)) : null;
        if (ended && 'error' in ended) return errorResult(ended.error);
        body = {
          replace: replaceBodyFrom({
            ...(ended ? { elements: ended.elements } : {}),
            ...(args.layout ? { layout: args.layout } : {}),
          }),
        };
      }
    } else if (args.edits !== undefined) {
      if (args.ops) return errorResult('ops mode takes "ops" or "edits", not both.');
      // Edit operations as text, parsed and applied by the api (docs/specs/015-api/mcp-server.md §4.4 "Edits").
      body = { operations: args.edits, base: editsBase(tab, args.rev) };
    } else {
      if (!args.ops) return errorResult('ops mode requires "ops" or "edits".');
      const operations = mcpOpsToEditOperations(args.ops, tab);
      if (typeof operations === 'string') return errorResult(operations);
      body = { operations, base: baseFor(args.ops, tab, args.rev) };
    }
    let answer;
    try {
      answer = await submitChangeset(env, token, args.documentId, tabId, body);
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    const { tab: next } = await apiJson<TabResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    // An edit that changed nothing records no changeset and so carries no lint: the tab's own lint is read instead, so
    // the answer still says what is wrong with it rather than "lint unavailable".
    const lint =
      answer.lint ??
      (answer.changeset ? null : (await lintReportsOf(env, token, args.documentId, [tabId]))[0]!);
    return imageResult(
      {
        id: args.documentId,
        documentId: args.documentId,
        tabId,
        url: deepLink(env, args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: next.rev,
        text: mcpResultText(answer.text, contentOrigin(tab.elements)),
        lint: lintLineOf(lint),
      },
      next,
      { env, token },
      [lintTextOf(lint)],
    );
  });
}
