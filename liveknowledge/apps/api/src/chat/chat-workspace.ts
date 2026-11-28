// One connected Slack workspace or Teams tenant (docs/specs/030-knowledgebase/blueprints/chat-apps.md "The
// ChatWorkspace"), named `slack:<team>` or `teams:<tenant>`; a Teams connect code's own instance, `code:<code>`; and a
// knowledgebase's list of what it is connected to, `kb:<id>`. The worker answers Slack and Teams at once and queues
// the slow part (asking, previews) here, where the alarm runs it, a few at a time. Everything is in chat-workspace-
// store.ts; the work is chat-jobs.ts.
import { DurableObject } from 'cloudflare:workers';
import type { ChatPlatform } from '@liveworkspace/chat';
import type { Env } from '../types';
import { previewAsPerson } from './chat-answer';
import { chatJobDeps, runChatJobs, type ChatJobDeps } from './chat-jobs';
import * as store from './chat-workspace-store';

export class ChatWorkspace extends DurableObject<Env> {
  readonly sql: store.ChatSql;
  /** What the alarm's work runs on; the tests hand in their own. */
  deps: ChatJobDeps = chatJobDeps;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    store.migrateChatWorkspace(this.sql);
  }

  private async wake(at: number) {
    const set = await this.ctx.storage.getAlarm();
    if (set === null || set > at) await this.ctx.storage.setAlarm(at);
  }

  install() {
    return store.readInstall(this.sql);
  }
  connectInstall(install: store.ChatInstall) {
    return store.writeInstall(this.sql, install);
  }
  noteServiceUrl(serviceUrl: string) {
    store.noteServiceUrl(this.sql, serviceUrl);
  }
  forget() {
    store.forgetAll(this.sql);
  }
  async seen(key: string, now = Date.now()) {
    const seen = store.seenBefore(this.sql, key, now);
    await this.wake(now + store.CHAT_ANSWER_KEEP_MS);
    return seen;
  }
  linkOf(user: string) {
    return store.linkOf(this.sql, user);
  }
  async startLink(user: string, userName: string | null, now = Date.now()) {
    const nonce = await store.startLink(this.sql, user, userName, now);
    await this.wake(now + store.CHAT_LINK_TTL_MS);
    return nonce;
  }
  pendingLink(user: string, nonce: string, now = Date.now()) {
    return store.pendingLink(this.sql, user, nonce, now);
  }
  completeLink(user: string, nonce: string, person: string, now = Date.now()) {
    return store.completeLink(this.sql, user, nonce, person, now);
  }
  unlink(user: string) {
    return store.unlink(this.sql, user);
  }
  async queue(kind: string, body: unknown, now = Date.now()) {
    const queued = store.queueJob(this.sql, kind, JSON.stringify(body), now);
    if (queued === 'queued') await this.wake(now);
    return queued;
  }
  async keepAnswer(id: string, user: string, body: unknown, now = Date.now()) {
    store.keepAnswer(this.sql, id, user, JSON.stringify(body), now);
    await this.wake(now + store.CHAT_ANSWER_KEEP_MS);
  }
  /** The kept answer's JSON, once. */
  takeAnswer(id: string, user: string, now = Date.now()): string | null {
    return store.takeAnswer(this.sql, id, user, now);
  }
  putCode(knowledgebase: string, person: string, expires: number) {
    store.putCode(this.sql, knowledgebase, person, expires);
  }
  takeCode(now = Date.now()) {
    return store.takeCode(this.sql, now);
  }
  connections() {
    return store.readConnections(this.sql);
  }
  writeConnection(connection: store.ChatConnection) {
    return store.writeConnection(this.sql, connection);
  }
  dropConnection(platform: ChatPlatform, workspace?: string) {
    return store.dropConnection(this.sql, platform, workspace);
  }

  /** A page's preview as a linked person, for Teams, which waits for it in the invoke. */
  previewLink(look: { knowledgebase: string; tab: string; person: string }) {
    return previewAsPerson(this.env, this.deps.person, look);
  }

  /** The work owed, a few a turn, then the sweep; armed again while anything is left. */
  override async alarm(): Promise<void> {
    const now = Date.now();
    await runChatJobs(this.env, this.sql, this.deps);
    store.sweep(this.sql, now);
    if (store.jobsWaiting(this.sql) > 0) await this.ctx.storage.setAlarm(Date.now());
    else if (store.holdsExpiring(this.sql))
      await this.ctx.storage.setAlarm(now + store.CHAT_ANSWER_KEEP_MS);
  }
}

/** The instance a name names. */
export function chatWorkspace(env: Env, name: string) {
  const namespace = env.CHAT_WORKSPACE!;
  return namespace.get(namespace.idFromName(name));
}
