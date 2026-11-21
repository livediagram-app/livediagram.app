'use client';

// The rule the builder holds, as its panels read it (blueprint ui.md "The builder"): the body as it stands (Insert a
// Value's groups are built for it), whether it is an Incoming Webhook rule (Webhook Field… is offered), its saved id
// and its address and secret as the api last listed them (the trigger panel's Make Secret and Regenerate). Provided
// by RuleBuilder around its steps and panel.

import { createContext, use, useMemo, type ReactNode } from 'react';
import type { AutomationHookInfo, AutomationKind } from '@liveworkspace/automations';
import type { RuleBody } from './types';

export type RuleContext = {
  // Null outside a builder (a panel drawn on its own).
  body: RuleBody | null;
  incoming: boolean;
  // The saved rule's id (null: not saved yet), and its address and secret as listed (absent: not saved as one yet).
  ruleId: string | null;
  hook: AutomationHookInfo | undefined;
  // The builder's clock, for when the secret was made and last used.
  now: number;
};

const NONE: RuleContext = { body: null, incoming: false, ruleId: null, hook: undefined, now: 0 };

const Context = createContext<RuleContext>(NONE);

export function RuleContextProvider({
  value,
  children,
}: {
  value: RuleContext;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRuleContext(): RuleContext {
  return use(Context);
}

// The item as rules read it (kit.useOutline), as the open step's panel holds it: a text field's Insert a Value reads
// it from here, so each field does not work the outline out again.
// `step`: the step whose panel it is (kit.values reads what stands before it); absent for a trigger or a condition.
type PanelOutline = { outline: unknown; step?: AutomationKind | undefined };
const OutlineContext = createContext<PanelOutline | null>(null);

export function PanelOutlineProvider({
  outline,
  step,
  children,
}: {
  outline: unknown;
  step?: AutomationKind | undefined;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ outline, step }), [outline, step]);
  return <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>;
}

/** The panel's outline, or null for a field drawn outside a step's panel. */
export function usePanelOutline(): PanelOutline | null {
  return use(OutlineContext);
}
