// What an app's room hands the item engine (liveworkspace/docs/specs/018-automations/automations.md "Built once";
// blueprint item-engine.md "The kit"): its kinds, how to read the item, and how to do what the shared steps and its
// own steps do. Everything a run touches outside the item's own Automations tables goes through here.
import type { App, CrossAppChain } from '@liveworkspace/index-client';
import type { TelemetryWireEvent } from '@liveworkspace/telemetry';
import type {
  ItemEvent,
  ItemFillContext,
  ItemKinds,
  ItemNames,
  ItemOutline,
  ItemPart,
  ItemRule,
  ItemWord,
} from '../../item';
import type { AutomationGone, AutomationPerson } from '../../types';
import type { AutomationsAi } from '../automation-ai';
import type { AutomationSendsClient } from '../automation-sends';
import type { AutomationStore } from '../automation-store';
import type { CrossAppClient } from '../cross-app';
import type { Sql } from '../sql';

// How a step went, as its line on the Audit Trail says it. `gone`: what a failure names that the item lacks.
export type StepOutcome =
  { ok: true; text: string } | { ok: false; text: string; gone?: AutomationGone };

// The steps in other apps (cross-app.ts): how the room reaches the index, and which app the item is.
export interface ItemCrossApp {
  client: CrossAppClient | null;
  app: App;
}

// What a run's message is about, as the index takes it: a tab's title and link.
export type ItemSendSubject = { title: string; url: string };

// One email a rule sends.
export type ItemMessage = { subject: string; body: string; rule: string };

// A typed-in address's unsubscribe links: the one-click door, and the page the email's link opens.
export type ItemOptOutLinks = { unsubscribeUrl: string; unsubscribePage: string };

// The app's email sender, over its own templates and client.
export interface ItemMailer {
  optOutDoor: (token: string) => string;
  optOutPage: (token: string) => string;
  // A typed-in address, with its own unsubscribe links.
  sendToAddress: (
    address: string,
    message: ItemMessage,
    links: ItemOptOutLinks,
  ) => Promise<unknown>;
  // An account person, by id (they manage their own notifications): false when there is no address to send to.
  sendToPerson: (personId: string, message: ItemMessage) => Promise<boolean>;
}

// What a rule's own change is tagged with, so the events it queues obey the chain rules.
export type ItemSource = {
  role: 'automation';
  rule: string;
  chain: number;
  // The chain across apps the run goes on in, for what its writes queue.
  cross?: CrossAppChain;
};

// What an app's own step is run with.
export interface ItemActionContext {
  rule: ItemRule;
  event: ItemEvent;
  outline: ItemOutline;
  names: ItemNames;
  // The run's tab, when it has one.
  tab: { id: string; name: string; url: string } | null;
  // A text with the run's values filled in.
  fill(text: string): string;
  source: ItemSource;
  now: number;
}

export type ItemActionRunner = (action: ItemPart, ctx: ItemActionContext) => Promise<StepOutcome>;

export type SnapshotDone = { ok: true } | { ok: false; reason: string };

export interface ItemRoomKit {
  kinds: ItemKinds;
  itemId: string;
  itemWord: ItemWord;
  // The telemetry category the item's runs are counted under ('Document', 'Design', 'Space').
  category: string;
  outline(): Promise<ItemOutline>;
  tabUrl(tabId: string): string;
  snapshots: {
    list(): Promise<{ id: string; name: string | null }[]>;
    take(name: string, author: AutomationPerson): Promise<SnapshotDone>;
    // `reason` 'snapshot_missing' when the snapshot is gone.
    revert(id: string, author: AutomationPerson): Promise<SnapshotDone>;
  };
  // The item's text (or one tab's) for Summarise with AI.
  text(tabId?: string): Promise<string>;
  // Add a Tab from a Template; absent where the app has none.
  addTab?(
    template: string,
    name: string,
  ): Promise<{ id: string; name: string } | { failed: string }>;
  mail: ItemMailer | null;
  sends: AutomationSendsClient<ItemSendSubject> | null;
  // Steps in other apps; absent, they fail with "Steps in other apps aren't set up here".
  crossApp?: ItemCrossApp;
  ai: { client: AutomationsAi | null; gateway?: string };
  // The app's own steps, by kind.
  run: Readonly<Record<string, ItemActionRunner>>;
  // The app's own values that need the room (the rest are filled by their kinds from the event).
  values?(event: ItemEvent): Promise<Readonly<Record<string, string>>>;
  // Which of `ids` the item still has, for a reference of the app's own (`field`: item/refs.ts ItemOwnRef). Asked by
  // the Rules list only when a rule names one; absent, such a reference is never said to be gone.
  owns?(field: string, ids: readonly string[]): Promise<ReadonlySet<string>>;
  telemetry(events: TelemetryWireEvent[]): Promise<void>;
  hookUrl(ruleId: string): string;
  putAway(): boolean;
  defer(promise: Promise<unknown>): void;
}

// What a run needs: the kit, the item's SQL and its rules.
export interface ItemDeps {
  kit: ItemRoomKit;
  sql: () => Sql;
  store: AutomationStore<ItemRule>;
  // The schedule changed (a run now waits): the room's alarm asks again.
  wake(): void;
  // Whether a rule that is on hears a kind the SQL triggers feed: only then does a writer's window matter.
  fed(): boolean;
}

export type { ItemFillContext };
