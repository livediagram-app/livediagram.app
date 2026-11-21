// What an app hands `defineItemAutomationsKit`, and the item as the kit's parts read it (blueprint item-ui.md "The
// helper"). Types only.

import type { ComponentType, ReactNode } from 'react';
import type {
  ItemHave,
  ItemKinds,
  ItemNames,
  ItemPart,
  ItemTemplate,
} from '@liveworkspace/automations/item';
import type { App, IndexClient } from '@liveworkspace/index-client';
import type {
  ActionPanelProps,
  AutomationsPlumbing,
  ConditionPanelProps,
  GlyphType,
  TriggerPanelProps,
} from '../kit';
import type { SceneTone, ToneClasses } from '../tile-picker/tile-scene';

/** The open item as the editor holds it. `useItem()` must answer the SAME object while nothing in it changed
 *  (memoise it on its fields): the outline, every sentence and every panel are memoised on it. */
export interface ItemView {
  id: string;
  name: string;
  tabs: readonly { id: string; name: string }[];
  /** The tab the person is on: Test Rule's and Run Rule's first choice. Null: none. */
  currentTabId: string | null;
  /** The people rules may name (Who Did It, Send Email to a person). */
  people: readonly { id: string; name: string }[];
  /** The share link the page holds, for the reads made as this person. */
  shareCode: string | null;
  signedIn: boolean;
  /** Opens a tab in the editor. The screen closes first. */
  openTab: (tabId: string) => void;
}

/** A snapshot as Revert to Snapshot lists it (`SnapshotSummary` of @liveworkspace/snapshots fits). */
export interface ItemSnapshot {
  id: string;
  name: string | null;
  createdAt: number;
  kept?: boolean;
}

/** A template Add a Tab from a Template may name. */
export interface ItemTabTemplate {
  id: string;
  name: string;
  /** A small picture beside its name (the app's template thumbnail). */
  picture?: ReactNode;
}

/** A kind's picture with no stage round it. */
export type ItemVignette = (p: { tone: ToneClasses }) => ReactNode;

/** A list read once while the screen is open: the item's snapshots, its connections. */
export type OnceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ItemSnapshots {
  status: OnceStatus;
  list: readonly ItemSnapshot[];
  /** Reads the list, the first time it is asked for while the screen is open. */
  ask: () => void;
  /** Reads it again, after a failed read. */
  retry: () => void;
}

/** The item as rules read it in the browser: what the sentence, the panels, the values and the templates take. */
export interface ItemUiOutline {
  item: ItemView;
  /** What rules are worded by: the tabs and people, the tab templates, and the snapshots and connections once read. */
  names: ItemNames;
  /** What the item has, for what a rule needs: a list not read yet is not checked. */
  have: ItemHave;
  snapshots: ItemSnapshots;
  templates: readonly ItemTabTemplate[];
}

export interface ItemOwnTrigger {
  scene: ItemVignette;
  /** Its fields. None: the panel says when it starts, from the kind's `line`. */
  Panel?: ComponentType<TriggerPanelProps<ItemPart, ItemUiOutline>>;
}
export interface ItemOwnCondition {
  Panel?: ComponentType<ConditionPanelProps<ItemPart, ItemUiOutline>>;
}
export interface ItemOwnAction {
  scene: ItemVignette;
  glyph: GlyphType;
  Panel?: ComponentType<ActionPanelProps<ItemPart, ItemUiOutline>>;
  /** With no Panel: what the step does, where there is nothing to set. Defaults to the kind's `line`. */
  note?: string;
}

export interface ItemAutomationsKitInput {
  /** The app's registry (`defineItemKinds`), the same value its api reads. */
  kinds: ItemKinds;
  /** The item's app, for its connections. */
  app: App;
  /** The light half (`defineItemPlumbing`): the SAME object the host was given. */
  plumbing: AutomationsPlumbing;
  /** A hook: the open item. See ItemView for what must be memoised. */
  useItem: () => ItemView;
  /** The item's snapshots, newest first, read as this person (the app's snapshots route). Asked for once per time
   *  the screen is open, and only when a Revert to Snapshot panel shows or a listed rule names a snapshot. */
  snapshots: (item: Pick<ItemView, 'id' | 'shareCode'>) => Promise<readonly ItemSnapshot[]>;
  /** The templates Add a Tab from a Template offers. Needed when `kinds.tabTemplates`. */
  tabTemplates?: readonly ItemTabTemplate[];
  /** The app's OWN kinds only, by kind: a shared kind named here throws. Every own trigger and action needs an
   *  entry (its picture); an own condition only when it has fields. */
  own?: {
    triggers?: Readonly<Record<string, ItemOwnTrigger>>;
    conditions?: Readonly<Record<string, ItemOwnCondition>>;
    actions?: Readonly<Record<string, ItemOwnAction>>;
    /** The colour of a group the app added (a kind's `group`), in the pickers. Violet otherwise. */
    tones?: Readonly<Record<string, SceneTone>>;
  };
  /** The app's ready-made rules. Each tile's picture is composed from its trigger's and its last step's
   *  (ItemTemplateScene); `scenes` draws one by hand instead, `tones` colours one. */
  templates: {
    list: readonly ItemTemplate[];
    categories: readonly { id: string; name: string }[];
    tones?: Readonly<Record<string, SceneTone>>;
    scenes?: Readonly<Record<string, ItemVignette>>;
  };
  /** Describe a Rule's example chips and the box's placeholder. */
  describe: { examples: readonly { label: string; text: string }[]; placeholder: string };
  /** The help article's button in the Rules tab's empty state ("How Rules Work"). */
  helpButton: ReactNode;
  /** The index's client, for the item's connections. */
  indexClient: IndexClient;
  /** A hook: where a guest signs in. */
  useSignInHref: () => string;
  /** The header the app's Incoming Webhook door reads a signature from. */
  signatureHeader: string;
  /** A new rule's trigger. `edited` otherwise. */
  firstTrigger?: string;
}
