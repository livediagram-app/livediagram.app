// The form tools (docs/specs/030-forms/forms.md "Agents", docs/specs/015-api/mcp-server.md §4.9e): read_form,
// add_form, change_form and share_form, over the verbs the CLI shares (@livediagram/agent-verbs). A refusal is a tool
// error that says what is there. A write answers with the form's picture, as the other writing tools do.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TabResponse } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import {
  addForm,
  changeForm,
  readForm,
  shareForm,
  type AddFormInput,
  type FormCallResult,
  type FormChange,
} from '@livediagram/agent-verbs';
import { mcpAddForm, mcpChangeForm, mcpReadForm, mcpShareForm } from '@livediagram/agent-verbs/mcp';
import { apiJson, clientFor } from './api';
import type { Env } from './env';
import { imageResult } from './image-result';
import { registerTool } from './tool-annotations';
import {
  appBase,
  deepLink,
  errorResult,
  requireToken,
  textResult,
  type Extra,
} from './tool-helpers';

// The form link anyone fills the form in at.
export const formLinkUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, code: string) =>
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
  return imageResult(value, tab as Tab);
}

export function registerFormTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpReadForm, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const result = await readForm(clientFor(env, token), args.documentId, args.tab);
    return answer(env, token, result, !!args.image);
  });

  registerTool(server, env, mcpAddForm, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const result = await addForm(clientFor(env, token), args as AddFormInput, 'mcp');
    return answer(env, token, result, true);
  });

  registerTool(server, env, mcpChangeForm, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const result = await changeForm(
      clientFor(env, token),
      args.documentId,
      args.tab,
      args.changes as FormChange[],
      'mcp',
    );
    return answer(env, token, result, true);
  });

  registerTool(server, env, mcpShareForm, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const result = await shareForm(clientFor(env, token), args.documentId, args.tab, args.action);
    return answer(env, token, result, false);
  });
}
