// The pieces the knowledgebase emails share (knowledge-templates.ts, watch-digest-email.ts): a name or its
// fallback, the knowledgebase's and a page's links, and the plain-text body with its way to turn the emails off.
// Kept apart from the templates so knowledge-templates.test.ts pins only templates.
import { xmlEscape } from '@liveworkspace/icons';
import type { Env } from '../types';
import { EMAIL_BRAND, profilePath } from './brand-layout';
import { appBaseUrl } from './client';
import type { EmailKnowledgebase } from './knowledge-templates';

export const named = (name: string, fallback: string) => name.trim() || fallback;
export const kbUrl = (env: Env, kb: EmailKnowledgebase) =>
  `${appBaseUrl(env)}/document/${encodeURIComponent(kb.id)}`;
export const pageUrl = (env: Env, kb: EmailKnowledgebase, tab: string) =>
  `${kbUrl(env, kb)}#t=${encodeURIComponent(tab)}`;
export const link = (href: string, text: string) =>
  `<a href="${xmlEscape(href)}" style="color:${EMAIL_BRAND};font-weight:600">${xmlEscape(text)}</a>`;

export const text = (env: Env, parts: readonly string[], reason: string) =>
  [...parts, '', reason, `Turn these emails off: ${profilePath(env)}`].join('\n');
