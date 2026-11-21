// The room's doors for Automations that no person's identity opens (blueprint item-engine.md "Routes", "An app's
// bindings"): an Incoming Webhook call, proved by its rule's secret, and a rule email's unsubscribe, proved by its
// token. The Worker checks the address, the method, the body's type and size and the caller's network before either
// reaches here (worker-doors.ts). An item never started holds no rule and no token, and is not started to say so.
import {
  HOOK_UNAUTHORIZED,
  provesSecret,
  type HookAnswer,
  type HookCall,
} from '../automation-incoming';
import type { ItemEngine } from '../item/engine';
import { answerItemHook, itemOptOut } from '../item/hook';

// The room as the doors need it, its item already bound.
export interface ItemDoorRoom {
  // Whether the item's schema is stored: an id nothing has written has none.
  started(): boolean;
  // The schema made ready for this wake.
  ensure(): void;
  engine: ItemEngine;
  arm(): void;
}

/** One Incoming Webhook call to one rule. */
export async function incomingItemHook(
  room: ItemDoorRoom,
  ruleId: string,
  call: HookCall,
): Promise<HookAnswer> {
  if (!room.started()) {
    // The same work as a wrong secret, so an address that names no item answers no faster.
    await provesSecret(call, null);
    return HOOK_UNAUTHORIZED;
  }
  room.ensure();
  const answer = await answerItemHook(room.engine, ruleId, call, Date.now());
  room.arm();
  return answer;
}

/** A rule email's unsubscribe: false for a token the item never made. */
export function itemEmailOptOut(room: ItemDoorRoom, token: string): boolean {
  if (!room.started()) return false;
  room.ensure();
  return itemOptOut(room.engine, token, Date.now());
}
