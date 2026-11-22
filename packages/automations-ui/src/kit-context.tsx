'use client';

// The kit the screen reads (kit.ts), and what the open screen offers the app's own parts (blueprint ui.md "The
// kit", "The screen's context"). The app provides its kit once, around the screen; every row, card and panel reads
// it from here.

import { createContext, use, type ReactNode } from 'react';
import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { AnyAutomationsKit, AutomationsOffer, AutomationsScope } from './kit';
import type { RulePart } from './rule-draft';
import type { RuleBody } from './types';

const KitContext = createContext<AnyAutomationsKit | null>(null);

// Tests only: the kit read where no provider stands, so an app's tests of one panel need no wrapper.
let fallback: AnyAutomationsKit | null = null;
export function setFallbackAutomationsKit(kit: AnyAutomationsKit | null): void {
  fallback = kit;
}

/** `kit` must be the same object from render to render (kit.ts says why). */
export function AutomationsKitProvider({
  kit,
  children,
}: {
  kit: AnyAutomationsKit;
  children: ReactNode;
}) {
  return <KitContext.Provider value={kit}>{children}</KitContext.Provider>;
}

export function useAutomationsKit(): AnyAutomationsKit {
  const kit = use(KitContext) ?? fallback;
  if (!kit) throw new Error('Automations: no kit provided (AutomationsKitProvider)');
  return kit;
}

const NO_OFFER: AutomationsOffer = {};
const noOffer = (): AutomationsOffer => NO_OFFER;

/** What the app offers here and now (kit.kinds.useOffer); `open`: while a picker shows, so a read behind it waits
 *  for the press. The kit never changes, so its hook is called on every render or on none. */
export function useAutomationsOffer(open = false): AutomationsOffer {
  const offer = useAutomationsKit().kinds.useOffer ?? noOffer;
  return offer({ open });
}

// The rule the builder holds, kept by the screen while the person is away from it (on the Connections tab, or on a
// round trip an app's view makes): its body with unsaved changes, what its template left to pick and the step that
// was open. `ruleId` null: a rule not saved yet.
export type KeptRule = {
  ruleId: string | null;
  body: RuleBody;
  picks: readonly AutomationTemplatePickAt[];
  part: RulePart | null;
};

export type AutomationsScreen = {
  scope: AutomationsScope;
  signedIn: boolean;
  /** Opens one of the app's views (kit.views), asking Discard Changes? first while a rule has unsaved changes. */
  openView: (id: string, arrival?: unknown) => void;
  /** Add a Connection…: the Connections tab, the rule being built kept as it stands for Back to Rule. */
  openConnections: () => void;
  /** A rule's runs on the Audit Trail, asking Discard Changes? first while a rule has unsaved changes. Absent where
   *  the screen has none (a test's). */
  openRuns?: (ruleId: string) => void;
  /** The rule the builder holds now (null outside the builder), for an app's round trip to keep. */
  draft: () => KeptRule | null;
  /** The builder's word of what it holds (null as it leaves). */
  keepDraft: (kept: KeptRule | null) => void;
};

export const AutomationsScreenContext = createContext<AutomationsScreen | null>(null);

/** The open screen; null outside it (a panel drawn on its own in a test). */
export function useAutomationsScreen(): AutomationsScreen | null {
  return use(AutomationsScreenContext);
}
