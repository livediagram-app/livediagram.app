// The form tools (docs/specs/030-forms/forms.md "Agents", docs/specs/015-api/mcp-server.md §4.9e): read_form,
// add_form, change_form, share_form and try_form, over the verbs the CLI shares (@livediagram/agent-verbs). A refusal is a tool
// error that says what is there. A write answers with the form's picture, as the other writing tools do.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TabResponse } from '@livediagram/api-schema';
import {
  addForm,
  changeForm,
  readForm,
  shareForm,
  tryForm,
  type FormCallResult,
} from '@livediagram/agent-verbs';
import {
  mcpAddForm,
  mcpChangeForm,
  mcpReadForm,
  mcpShareForm,
  mcpTryForm,
} from '@livediagram/agent-verbs/mcp';
import { apiJson, clientFor } from './api';
import type { Env } from './env';
import { imageResult } from './image-result';
import { registerTool } from './tool-annotations';
import { appBase, deepLink, errorResult, requireToken, textResult } from './tool-helpers';

// The form link anyone fills the form in at.
const formLinkUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, code: string) =>
  `${appBase(env)}/form/${code}`;

async function answer(env: Env, token: string, result: FormCallResult, image: boolean) {
  if (!result.ok) return errorResult(result.message);
  const { reading, documentId, lines, made } = result;
  const { code, ...rest } = reading;
  const value = {
    documentId,
    ...rest,
    link: code ? formLinkUrl(env, code) : null,
    ...(lines.length ? { lines } : {}),
    ...(made.length ? { made } : {}),
    url: deepLink(env, documentId),
  };
  if (!image) return textResult(value);
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(reading.tabId)}`,
  );
  return imageResult(value, tab);
}

export function registerFormTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpReadForm, async (args, extra) => {
    const token = requireToken(extra);
    const result = await readForm(clientFor(env, token), args.documentId, args.tab);
    return answer(env, token, result, !!args.image);
  });

  registerTool(server, env, mcpAddForm, async (args, extra) => {
    const token = requireToken(extra);
    const result = await addForm(clientFor(env, token), args, 'mcp');
    return answer(env, token, result, true);
  });

  registerTool(server, env, mcpChangeForm, async (args, extra) => {
    const token = requireToken(extra);
    const result = await changeForm(
      clientFor(env, token),
      args.documentId,
      args.tab,
      args.changes,
      'mcp',
    );
    return answer(env, token, result, true);
  });

  registerTool(server, env, mcpShareForm, async (args, extra) => {
    const token = requireToken(extra);
    const result = await shareForm(clientFor(env, token), args.documentId, args.tab, args.action);
    return answer(env, token, result, false);
  });

  registerTool(server, env, mcpTryForm, async (args, extra) => {
    const token = requireToken(extra);
    const result = await tryForm(clientFor(env, token), args.documentId, args.tab, args.answers);
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...value } = result;
    return textResult({ ...value, url: deepLink(env, result.documentId) });
  });
}
