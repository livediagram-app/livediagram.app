'use client';

// The knowledge steps' panels (docs/specs/013-workspace/automations.md "Steps of its own", "The screen"): Set the
// Page Owner, Clear Verification, Email the Page Owner and Always in Context, built from the platform's panel parts
// so they sit beside the shared steps' as one family. Each takes the page (the run's, where the trigger is about
// one, or a chosen one) with `RunOrPageField`, which Name This Version's panel shares. Loaded with the screen.

import {
  KINDS,
  type ClearVerificationStep,
  type ContextStep,
  type EmailOwnerStep,
  type OwnerTo,
  type SetOwnerStep,
} from '@liveknowledge/document/automations';
import { RUN_TAB } from '@liveworkspace/automations/item';
import type { ActionPanelProps } from '@liveworkspace/automations-ui/kit';
import { goneLabel, type ItemUiOutline } from '@liveworkspace/automations-ui/item';
import { useRuleContext } from '@liveworkspace/automations-ui/rule-context';
import { EmailPanel } from '@liveworkspace/automations-ui/step-panels/EmailPanel';
import {
  PanelField,
  PanelNote,
  PanelSelect,
} from '@liveworkspace/automations-ui/step-panels/panel-parts';

type Props<Step> = ActionPanelProps<Step, ItemUiOutline>;

/** Whether the rule's trigger is about one page, so a run has a page of its own. */
export function useRunHasPage(): boolean {
  const trigger = useRuleContext().body?.trigger.kind ?? '';
  return KINDS.trigger(trigger)?.tabbed === true;
}

/** The page a step works on: the run's own (where the trigger is about one) or one chosen. */
export function RunOrPageField({
  value,
  onChange,
  pages,
  invalid,
  hint,
}: {
  value: string;
  onChange: (tab: string) => void;
  pages: ItemUiOutline['item']['tabs'];
  invalid: boolean;
  hint: string;
}) {
  const tabbed = useRunHasPage();
  const run = value === RUN_TAB;
  const gone = value !== '' && !run && !pages.some((t) => t.id === value);
  return (
    <PanelField
      label="Page"
      hint={
        run && !tabbed
          ? 'This rule’s trigger is about no page, so the run has none: pick one.'
          : hint
      }
    >
      {(id, hintId) => (
        <PanelSelect
          id={id}
          aria-describedby={hintId}
          aria-invalid={invalid || (run && !tabbed) || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {value === '' ? <option value="">Pick a page</option> : null}
          {/* The run's page only where a run has one; kept while the step still says so. */}
          {tabbed || run ? <option value={RUN_TAB}>The Page the Rule Runs On</option> : null}
          {pages.length > 0 || gone ? (
            <optgroup label="One Page">
              {gone ? (
                <option value={value}>{goneLabel('tab', null, 'knowledgebase')}</option>
              ) : null}
              {pages.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </PanelSelect>
      )}
    </PanelField>
  );
}

const STARTER = 'trigger';
const ownerKey = (to: OwnerTo): string => ('trigger' in to ? STARTER : `person:${to.person}`);
const ownerOf = (key: string): OwnerTo =>
  key === STARTER ? { trigger: true } : { person: key.slice('person:'.length) };

export function SetOwnerPanel({
  action,
  onChange,
  outline,
  invalidPath,
  personless,
}: Props<SetOwnerStep>) {
  const { tabs, people } = outline.item;
  const key = ownerKey(action.to);
  const gone =
    'person' in action.to && !people.some((p) => p.id === (action.to as { person: string }).person);
  return (
    <div className="flex flex-col gap-4">
      <PanelField
        label="Owner"
        hint="Whoever started the rule is the person, or for an agent the person whose agent it is. An owner must be able to open the knowledgebase."
      >
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            aria-invalid={invalidPath?.startsWith('to') || undefined}
            value={key}
            onChange={(e) => onChange({ ...action, to: ownerOf(e.target.value) })}
          >
            {/* Nobody is behind a time or a review coming due: kept only while the step still says so. */}
            {!personless || key === STARTER ? (
              <option value={STARTER}>Whoever Started the Rule</option>
            ) : null}
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
      <RunOrPageField
        value={action.tab}
        pages={tabs}
        invalid={invalidPath === 'tab'}
        hint="The page whose owner this sets. Page Health shows the new owner."
        onChange={(tab) => onChange({ ...action, tab })}
      />
    </div>
  );
}

export function ClearVerificationPanel({
  action,
  onChange,
  outline,
  invalidPath,
}: Props<ClearVerificationStep>) {
  return (
    <div className="flex flex-col gap-4">
      <RunOrPageField
        value={action.tab}
        pages={outline.item.tabs}
        invalid={invalidPath === 'tab'}
        hint="It reads Not Verified until someone verifies it again. Its owner stays."
        onChange={(tab) => onChange({ ...action, tab })}
      />
    </div>
  );
}

export function ContextPanel({ action, onChange, outline, invalidPath }: Props<ContextStep>) {
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Do">
        {(id) => (
          <PanelSelect
            id={id}
            value={action.on ? 'add' : 'remove'}
            onChange={(e) => onChange({ ...action, on: e.target.value === 'add' })}
          >
            <option value="add">Add to Always in Context</option>
            <option value="remove">Remove from Always in Context</option>
          </PanelSelect>
        )}
      </PanelField>
      <RunOrPageField
        value={action.tab}
        pages={outline.item.tabs}
        invalid={invalidPath === 'tab'}
        hint="Every agent is handed the pages in Always in Context before it starts, up to 8,000 tokens in all. A page that would pass that is not added, and the run says so."
        onChange={(tab) => onChange({ ...action, tab })}
      />
    </div>
  );
}

export function EmailOwnerPanel({ action, onChange, invalidPath }: Props<EmailOwnerStep>) {
  const tabbed = useRunHasPage();
  return (
    <div className="flex flex-col gap-4">
      {tabbed ? null : (
        <PanelNote>
          This rule’s trigger is about no page, so there is no page owner to email. Pick a trigger
          about a page, or use Send Email.
        </PanelNote>
      )}
      <EmailPanel
        recipient={<PanelNote>To the owner of the page the rule runs on.</PanelNote>}
        addresses={null}
        onAddresses={() => undefined}
        subject={action.subject}
        onSubject={(subject) => onChange({ ...action, subject })}
        body={action.body}
        onBody={(body) => onChange({ ...action, body })}
        invalidPath={invalidPath}
        hint="Sent to the owner’s own address with a link to the knowledgebase. A page with no owner fails the run, and the Audit Trail says so."
      />
    </div>
  );
}
