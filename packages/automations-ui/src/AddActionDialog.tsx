'use client';

// The Add an Action picker (liveplanner/docs/specs/026-plan/automations.md "The rule builder"): + Add Action opens a
// dialog of every action it may add, in the app's groups (kit.kinds.actionGroups), each tile with its picture, its
// icon, its name and a line on what it does, in the pickers' shared dialog (TilePicker). Which groups show follows
// where the action goes: the steps of the top level alone only there, the kinds a branch leaves out never in one.
// A group whose kinds the rule holds all it may of is dimmed and says so.

import { useMemo, useState, type ReactElement } from 'react';
import {
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_WAITS_MAX,
} from '@liveworkspace/automations';
import { CROSS_APP_STEPS_MAX, isCrossAppKind } from '@liveworkspace/automations/cross-app';
import { Button, HoverCard, PlusIcon } from '@liveworkspace/ui';
import { addActionHeroArt } from './AddActionHeroArt';
import { StepTile } from './glyphs';
import type { AnyAutomationsKit } from './kit';
import { useAutomationsKit } from './kit-context';
import { canAddAi, canAddCrossApp, canAddOutgoing, canAddWait } from './rule-draft';
import { TilePicker } from './tile-picker/TilePicker';
import type { RuleBody } from './types';
import { creditsLeftLine, tierUsage } from '@liveworkspace/subscription-ui/item-tier';
import { useAutomationsTier } from './tier/automations-tier';

export type PickerWhere = 'top' | 'list' | 'branch';

export type PickerGroup = {
  id: string;
  name: string;
  // A note beside the group's name (AI's daily allowance).
  note?: string;
  kinds: readonly string[];
  // Why the group's tiles are dimmed: the rule holds all it may of them.
  full?: string;
  badge?: string;
  footnote?: string;
};

// Why a kind can't be added to this rule: it holds all it may of its family (a message step, an AI step, a Wait).
function fullWords(body: RuleBody, key: string): string | null {
  if (key.startsWith('notify_'))
    return canAddOutgoing(body)
      ? null
      : `A rule holds up to ${AUTOMATION_OUTGOING_MAX} outgoing actions`;
  if (key.startsWith('ai_'))
    return canAddAi(body) ? null : `A rule holds up to ${AUTOMATION_AI_STEPS_MAX} AI actions`;
  if (key === 'wait')
    return canAddWait(body) ? null : `A rule holds up to ${AUTOMATION_WAITS_MAX} Waits`;
  if (isCrossAppKind(key))
    return canAddCrossApp(body)
      ? null
      : `A rule holds up to ${CROSS_APP_STEPS_MAX} steps in other apps`;
  return null;
}

/** The groups for where the action goes: the rule's top level, or an If / Else list or a branch. A kind of the top
 *  level alone (and one nothing may follow) shows only there; a branch leaves out what it can't hold; a group left
 *  with no kind goes. No body (changing a step's kind): nothing is full. `only`: the kinds a step may become. */
export function pickerGroups(
  kit: AnyAutomationsKit,
  body: RuleBody | null,
  where: PickerWhere,
  only?: (key: string) => boolean,
): PickerGroup[] {
  const out: PickerGroup[] = [];
  for (const g of kit.kinds.actionGroups) {
    const kinds = g.kinds.filter((k) => {
      const kind = kit.kinds.actions[k];
      if (!kind || (only && !only(k))) return false;
      if (where !== 'top' && (kind.top || kind.last)) return false;
      return where !== 'branch' || !kind.notInBranch;
    });
    if (kinds.length === 0) continue;
    const group: PickerGroup = { id: g.id, name: g.name, kinds };
    if (g.note) group.note = g.note;
    if (g.badge) group.badge = g.badge;
    if (g.footnote) group.footnote = g.footnote;
    if (body) {
      const said = kinds.map((k) => fullWords(body, k));
      if (said.every((s) => s !== null)) group.full = said[0]!;
    }
    out.push(group);
  }
  return out;
}

/** An action's tile icon, by its key. */
export function ActionTile({ actionKey, size = 24 }: { actionKey: string; size?: 24 | 32 }) {
  const kit = useAutomationsKit();
  return <StepTile tone="action" glyph={kit.kinds.actions[actionKey]?.glyph} size={size} />;
}

/** A disabled button that says why: still focusable (aria-disabled, its press ignored), so hover and keyboard focus
 *  both show the hover card with the reason. One with no reason is plainly disabled. */
export function disabledProps(
  disabled: boolean,
  why: string | null | undefined,
): { disabled?: boolean; 'aria-disabled'?: true } {
  if (!disabled) return {};
  return why ? { 'aria-disabled': true } : { disabled: true };
}

/** The hover card saying why a button is disabled; the button alone while there is no reason. */
export function DisabledWhy({
  title,
  why,
  children,
}: {
  title: string;
  why: string | null | undefined;
  children: ReactElement;
}) {
  if (!why) return children;
  return (
    <HoverCard title={title} description={why}>
      {children}
    </HoverCard>
  );
}

/** The dashed + Add Action button and the picker it opens. `where`: the rule's top level, an If / Else list, or a
 *  branch. */
export function AddActionButton({
  body,
  where,
  disabled,
  why = null,
  onPick,
}: {
  body: RuleBody;
  where: PickerWhere;
  disabled: boolean;
  // Why it is disabled, said on hover and focus (DisabledWhy).
  why?: string | null;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DisabledWhy title="Add Action" why={disabled ? why : null}>
        <Button
          variant="secondary"
          size="xs"
          className="border-dashed"
          aria-haspopup="dialog"
          aria-expanded={open}
          {...disabledProps(disabled, why)}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
        >
          <PlusIcon size={12} />
          Add Action
        </Button>
      </DisabledWhy>
      {open ? (
        <AddActionDialog
          body={body}
          where={where}
          onClose={() => setOpen(false)}
          onPick={(k) => {
            setOpen(false);
            onPick(k);
          }}
        />
      ) : null}
    </>
  );
}

export function AddActionDialog({
  body,
  where,
  onClose,
  onPick,
  current,
  only,
}: {
  // Null when changing a step's kind: nothing reads as full.
  body: RuleBody | null;
  where: PickerWhere;
  onClose: () => void;
  onPick: (key: string) => void;
  // Changing a step: its kind now, badged Current (the picker is titled Change the Action).
  current?: string;
  // Changing a step: the kinds it may become (a message step: the other tools alone).
  only?: (key: string) => boolean;
}) {
  const kit = useAutomationsKit();
  // The item's tier, with Pro on: AI says what is left of the month's credits to someone who may know.
  const tier = useAutomationsTier();
  const credits = useMemo(() => (tier?.item.on ? tierUsage(tier.item, 'aiCredits') : null), [tier]);
  const sections = useMemo(
    () =>
      pickerGroups(kit, body, where, only).map((g) => {
        const ai = credits !== null && g.kinds.some((k) => k.startsWith('ai_'));
        const note = ai
          ? [g.note, creditsLeftLine(credits.used, credits.limit)].filter(Boolean).join(' · ')
          : g.note;
        return {
          id: g.id,
          name: g.name,
          ...(note ? { note } : {}),
          ...(ai && credits.used >= credits.limit ? { noteAtLimit: true } : {}),
          ...(g.full ? { full: g.full } : {}),
          ...(g.badge ? { badge: g.badge } : {}),
          ...(g.footnote ? { footnote: g.footnote } : {}),
          tiles: g.kinds.map((k) => {
            const kind = kit.kinds.actions[k]!;
            return {
              key: k,
              name: kind.name,
              line: kind.line,
              icon: <StepTile tone="action" glyph={kind.glyph} size={24} />,
              scene: kind.scene(g.id),
            };
          }),
        };
      }),
    [kit, body, where, only, credits],
  );
  return (
    <TilePicker
      title={current ? 'Change the Action' : 'Add an Action'}
      line={
        // Steps may act on the whole item (a snapshot, an email), not only the run's tab or card.
        current ? 'What should this step do instead?' : 'What should this rule do?'
      }
      art={addActionHeroArt}
      noun="action"
      emptyHint={kit.kinds.actionHint}
      sections={sections}
      current={current}
      onPick={onPick}
      onClose={onClose}
    />
  );
}
