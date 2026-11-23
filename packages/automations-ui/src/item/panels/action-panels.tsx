'use client';

// Send Email, Add a Tab from a Template and Summarise with AI (blueprint item-ui.md "Panels"; automations.md "Steps
// every app has"). Send Email is stage 3's EmailPanel with an item's To: the owner, whoever started the rule (where
// someone did), a person, or typed-in addresses.

import { AiStepCredits } from '../../tier/AiStepCredits';
import { useTabWords } from '../tab-words';
import {
  inTabWords,
  RUN_TAB,
  STEP_NAME_MAX,
  type ItemAddTab,
  type ItemEmail,
  type ItemEmailTo,
  type ItemKinds,
  type ItemSummarise,
} from '@liveworkspace/automations/item';
import type { ComponentType } from 'react';
import type { ActionPanelProps } from '../../kit';
import { AiStepSource } from '../../AiStepSource';
import { useAutomationsKit } from '../../kit-context';
import { useRuleContext } from '../../rule-context';
import { EmailPanel } from '../../step-panels/EmailPanel';
import { PanelField, PanelNote, PanelSelect } from '../../step-panels/panel-parts';
import { ValueChipsText, ValueTextField } from '../../ValueInsert';
import type { ItemUiOutline } from '../types';
import { goneLabel, itemTitle } from '../words';

type Props<Step> = ActionPanelProps<Step, ItemUiOutline>;

const ADDRESSES = 'addresses';

export const toKey = (to: ItemEmailTo): string =>
  'owner' in to
    ? 'owner'
    : 'trigger' in to
      ? 'trigger'
      : 'person' in to
        ? `person:${to.person}`
        : ADDRESSES;

/** To, from its select's value; the typed-in addresses stay while To is Email Addresses. */
export function toOf(key: string, from: ItemEmailTo): ItemEmailTo {
  if (key === 'owner') return { owner: true };
  if (key === 'trigger') return { trigger: true };
  if (key === ADDRESSES) return 'addresses' in from ? from : { addresses: [] };
  return { person: key.slice('person:'.length) };
}

export function ItemEmailPanel({
  action,
  onChange,
  outline,
  invalidPath,
  personless,
}: Props<ItemEmail>) {
  const { item } = useAutomationsKit().plumbing.words;
  const { to } = action;
  const key = toKey(to);
  const { people } = outline.item;
  const gone = 'person' in to && !people.some((p) => p.id === to.person);
  return (
    <EmailPanel
      recipient={
        <PanelField label="To">
          {(id) => (
            <PanelSelect
              id={id}
              value={key}
              aria-invalid={invalidPath === 'to' || undefined}
              onChange={(e) => onChange({ ...action, to: toOf(e.target.value, to) })}
            >
              <option value="owner">The Owner</option>
              {/* Nobody is behind a time or a call: kept only while the rule still says so, to be changed. */}
              {!personless || key === 'trigger' ? (
                <option value="trigger">Whoever Started the Rule</option>
              ) : null}
              <option value={ADDRESSES}>Email Addresses</option>
              {people.length > 0 || gone ? (
                <optgroup label="People">
                  {gone ? <option value={key}>{goneLabel('person')}</option> : null}
                  {people.map((p) => (
                    <option key={p.id} value={`person:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </PanelSelect>
          )}
        </PanelField>
      }
      addresses={'addresses' in to ? to.addresses : null}
      onAddresses={(addresses) => onChange({ ...action, to: { addresses } })}
      subject={action.subject}
      onSubject={(subject) => onChange({ ...action, subject })}
      body={action.body}
      onBody={(body) => onChange({ ...action, body })}
      invalidPath={invalidPath}
      hint={`Sent with a link to this ${item}. A person gets it at their own address; a typed-in address can stop this ${item}’s emails from the message.`}
    />
  );
}

export function AddTabPanel({ action, onChange, outline, invalidPath }: Props<ItemAddTab>) {
  const { item } = useAutomationsKit().plumbing.words;
  const words = useTabWords();
  const { templates } = outline;
  const picked = templates.find((t) => t.id === action.template);
  if (templates.length === 0 && !action.template)
    return <PanelNote>{words(`This ${item} has no templates to add a tab from.`)}</PanelNote>;
  return (
    <div className="flex flex-col gap-4">
      <PanelField
        label="Template"
        hint={words('The new tab is made as New Tab makes it, last in order.')}
      >
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            aria-invalid={invalidPath === 'template' || undefined}
            value={action.template}
            onChange={(e) => onChange({ ...action, template: e.target.value })}
          >
            {action.template ? null : <option value="">Pick a template</option>}
            {action.template && !picked ? (
              <option value={action.template}>{goneLabel('template')}</option>
            ) : null}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      {picked?.picture ? (
        <div
          aria-hidden
          data-tab-template-picture=""
          className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
        >
          {picked.picture}
        </div>
      ) : null}
      <ValueTextField
        label="Name"
        multiline={false}
        maxLength={STEP_NAME_MAX}
        value={action.name}
        invalid={invalidPath === 'name'}
        hint={words('The new tab’s name. Values are filled in when the rule runs.')}
        onChange={(name) => onChange({ ...action, name })}
      />
    </div>
  );
}

const WHOLE = '';

/** Summarise with AI's panel, over the app's registry: the run's tab is offered where the trigger is about one. */
export function summarisePanel(kinds: ItemKinds): ComponentType<Props<ItemSummarise>> {
  return function SummarisePanel({ action, onChange, outline }: Props<ItemSummarise>) {
    const trigger = useRuleContext().body?.trigger.kind ?? '';
    const tabbed = kinds.trigger(trigger)?.tabbed === true;
    const { tabs } = outline.item;
    const value = action.tab ?? WHOLE;
    const words = (text: string) => inTabWords(text, kinds.itemWord);
    const gone = value !== WHOLE && value !== RUN_TAB && !tabs.some((t) => t.id === value);
    return (
      <div className="flex flex-col gap-4">
        <PanelField
          label="Read"
          hint={words(`The text it summarises: this ${kinds.itemWord}’s, or one tab’s.`)}
        >
          {(id, hintId) => (
            <PanelSelect
              id={id}
              aria-describedby={hintId}
              value={value}
              onChange={(e) => {
                const { tab: _tab, ...rest } = action;
                onChange(e.target.value === WHOLE ? rest : { ...rest, tab: e.target.value });
              }}
            >
              <option value={WHOLE}>The Whole {itemTitle(kinds.itemWord)}</option>
              {/* The run's tab only where a run has one; kept while the rule still says so. */}
              {tabbed || value === RUN_TAB ? (
                <option value={RUN_TAB}>{words('The Tab the Rule Runs On')}</option>
              ) : null}
              {tabs.length > 0 || gone ? (
                <optgroup label={words('One Tab')}>
                  {gone ? (
                    <option value={value}>{goneLabel('tab', null, kinds.itemWord)}</option>
                  ) : null}
                  {tabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </PanelSelect>
          )}
        </PanelField>
        <PanelNote>
          The summary becomes the value <ValueChipsText text="{{AI Summary}}" /> for the steps after
          this one: pick it from Insert a Value in their text.
        </PanelNote>
        <AiStepSource item={kinds.itemWord} />
        <AiStepCredits />
      </div>
    );
  };
}
