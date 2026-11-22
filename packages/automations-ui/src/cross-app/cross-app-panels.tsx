'use client';

// The steps in other apps' panels (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps";
// blueprint cross-app.md "In the builder"): the target first (TargetField), then what its lists offer (a board and
// its column, a parent page, a Space's tab, a template), then every text with its values as chips and Insert a
// Value, and a live Preview of what lands. Every app's kit draws the same panels: the item kits and liveplanner's.
import {
  CROSS_APP_BODY_MAX,
  CROSS_APP_DUE_DAYS_MAX,
  CROSS_APP_NOTICE_PEOPLE_MAX,
  CROSS_APP_TITLE_MAX,
  type DocTabStep,
  type InboxNoticeStep,
  type KbPageStep,
  type PlanCardStep,
  type SpacePostStep,
} from '@liveworkspace/index-client';
import { AUTOMATION_TEXT_MAX } from '@liveworkspace/automations';
import { appWord, targetWords } from '@liveworkspace/automations/cross-app';
import { SwitchRow, TextInput } from '@liveworkspace/ui';
import type { ActionPanelProps } from '../kit';
import { ChipToggles, PanelField, PanelNote, PanelSelect } from '../step-panels/panel-parts';
import { ValueTextField } from '../ValueInsert';
import { CrossAppPreview } from './CrossAppPreview';
import { TargetField } from './TargetField';

type Props<Step> = ActionPanelProps<Step, unknown>;

const GONE = 'No longer there';

/** The people a Notify may pick: the item's (an item kit's outline) or the plan's (liveplanner's). */
export function outlinePeople(outline: unknown): readonly { id: string; name: string }[] {
  const o = outline as { item?: { people?: unknown }; people?: unknown } | null;
  const list = o?.item?.people ?? o?.people;
  return Array.isArray(list)
    ? (list as { id: string; name: string }[]).filter((p) => typeof p?.id === 'string')
    : [];
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <SwitchRow
      checked={checked}
      onChange={onChange}
      layout="flex items-start justify-between gap-3 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{label}</span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </SwitchRow>
  );
}

export function PlanCardPanel({ action, onChange, outline, invalidPath }: Props<PlanCardStep>) {
  const set = (patch: Partial<PlanCardStep>) => onChange({ ...action, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <TargetField
        target={action.target}
        apps={['liveplanner']}
        noun="plan"
        invalid={invalidPath === 'target'}
        onChange={(target) => set({ target, board: '', column: '' })}
      >
        {(target) => {
          const boards = target.boards ?? [];
          const board = boards.find((b) => b.id === action.board);
          if (boards.length === 0)
            return <PanelNote>This plan has no board to put a card on.</PanelNote>;
          return (
            <div className="grid gap-4 sm:grid-cols-2">
              <PanelField label="Board">
                {(id) => (
                  <PanelSelect
                    id={id}
                    aria-invalid={invalidPath === 'board' || undefined}
                    value={action.board}
                    onChange={(e) => {
                      const next = boards.find((b) => b.id === e.target.value);
                      set({ board: e.target.value, column: next?.columns[0] ?? '' });
                    }}
                  >
                    {action.board ? null : <option value="">Pick a board</option>}
                    {action.board && !board ? <option value={action.board}>{GONE}</option> : null}
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </PanelSelect>
                )}
              </PanelField>
              <PanelField label="Column">
                {(id) => (
                  <PanelSelect
                    id={id}
                    aria-invalid={invalidPath === 'column' || undefined}
                    value={action.column}
                    disabled={!board}
                    onChange={(e) => set({ column: e.target.value })}
                  >
                    {action.column && board && !board.columns.includes(action.column) ? (
                      <option value={action.column}>{GONE}</option>
                    ) : null}
                    {(board?.columns ?? []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </PanelSelect>
                )}
              </PanelField>
            </div>
          );
        }}
      </TargetField>
      <ValueTextField
        label="Title"
        multiline={false}
        maxLength={CROSS_APP_TITLE_MAX}
        value={action.title}
        invalid={invalidPath === 'title'}
        onChange={(title) => set({ title })}
      />
      <ValueTextField
        label="Description"
        maxLength={2000}
        value={action.description}
        invalid={invalidPath === 'description'}
        hint={action.linkBack ? 'A link back to what fired the rule goes at its end.' : undefined}
        onChange={(description) => set({ description })}
      />
      <ValueTextField
        label="Assignee"
        multiline={false}
        maxLength={80}
        value={action.assignee ?? ''}
        placeholder="A person’s name, or a value"
        invalid={invalidPath === 'assignee'}
        hint="Matched by name to the plan’s people. Left empty, nobody."
        onChange={(assignee) => {
          const { assignee: _drop, ...rest } = action;
          onChange(assignee ? { ...rest, assignee } : rest);
        }}
      />
      <PanelField label="Due In" hint="Days after the rule runs. Left empty, no due date.">
        {(id, hintId) => (
          <TextInput
            id={id}
            hintId={hintId}
            type="number"
            min={0}
            max={CROSS_APP_DUE_DAYS_MAX}
            inputMode="numeric"
            invalid={invalidPath === 'dueDays'}
            value={action.dueDays ?? ''}
            onChange={(e) => {
              const { dueDays: _drop, ...rest } = action;
              const n = Number.parseInt(e.target.value, 10);
              onChange(
                Number.isFinite(n)
                  ? { ...rest, dueDays: Math.max(0, Math.min(CROSS_APP_DUE_DAYS_MAX, n)) }
                  : rest,
              );
            }}
          />
        )}
      </PanelField>
      <Switch
        checked={action.linkBack === true}
        onChange={(linkBack) => set({ linkBack })}
        label="Link Back"
        hint="Ends the description with a link to what fired the rule."
      />
      <Switch
        checked={action.skipIfOpen === true}
        onChange={(skipIfOpen) => set({ skipIfOpen })}
        label="Skip If Open"
        hint="No new card while an open one already links back."
      />
      <CrossAppPreview
        outline={outline}
        where={`${action.column || 'A column'} on ${targetWords(action.target, 'a plan')}`}
        lines={[
          { label: 'Title', text: action.title },
          { label: 'Description', text: action.description },
        ]}
      />
    </div>
  );
}

export function KbPagePanel({ action, onChange, outline, invalidPath }: Props<KbPageStep>) {
  const set = (patch: Partial<KbPageStep>) => onChange({ ...action, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <TargetField
        target={action.target}
        apps={['liveknowledge']}
        noun="knowledgebase"
        invalid={invalidPath === 'target'}
        onChange={(target) => {
          const { parent: _drop, ...rest } = action;
          onChange({ ...rest, target });
        }}
      >
        {(target) => {
          const pages = target.pages ?? [];
          return (
            <PanelField label="Under" hint="The page it goes under. Top Level puts it at the top.">
              {(id, hintId) => (
                <PanelSelect
                  id={id}
                  aria-describedby={hintId}
                  aria-invalid={invalidPath === 'parent' || undefined}
                  value={action.parent ?? ''}
                  onChange={(e) => {
                    const { parent: _drop, ...rest } = action;
                    onChange(e.target.value ? { ...rest, parent: e.target.value } : rest);
                  }}
                >
                  <option value="">Top Level</option>
                  {action.parent && !pages.some((p) => p.id === action.parent) ? (
                    <option value={action.parent}>{GONE}</option>
                  ) : null}
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </PanelSelect>
              )}
            </PanelField>
          );
        }}
      </TargetField>
      <ValueTextField
        label="Title"
        multiline={false}
        maxLength={CROSS_APP_TITLE_MAX}
        value={action.title}
        invalid={invalidPath === 'title'}
        onChange={(title) => set({ title })}
      />
      <ValueTextField
        label="Body"
        maxLength={CROSS_APP_BODY_MAX}
        value={action.body}
        invalid={invalidPath === 'body'}
        hint="Markdown: headings, lists and links read as the editor writes them."
        onChange={(body) => set({ body })}
      />
      <CrossAppPreview
        outline={outline}
        where={`A page in ${targetWords(action.target, 'a knowledgebase')}`}
        lines={[
          { label: 'Title', text: action.title },
          { label: 'Body', text: action.body },
        ]}
        note="Written by the rule, owned by you and Never Verified until someone checks it."
      />
    </div>
  );
}

export function SpacePostPanel({ action, onChange, outline, invalidPath }: Props<SpacePostStep>) {
  return (
    <div className="flex flex-col gap-4">
      <TargetField
        target={action.target}
        apps={['livehuddle']}
        noun="Space"
        invalid={invalidPath === 'target'}
        onChange={(target) => onChange({ ...action, target, spaceTab: '' })}
      >
        {(target) => {
          const tabs = target.tabs ?? [];
          return (
            <PanelField label="Tab">
              {(id) => (
                <PanelSelect
                  id={id}
                  aria-invalid={invalidPath === 'spaceTab' || undefined}
                  value={action.spaceTab}
                  onChange={(e) => onChange({ ...action, spaceTab: e.target.value })}
                >
                  {action.spaceTab ? null : <option value="">Pick a tab</option>}
                  {action.spaceTab && !tabs.some((t) => t.id === action.spaceTab) ? (
                    <option value={action.spaceTab}>{GONE}</option>
                  ) : null}
                  {tabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </PanelSelect>
              )}
            </PanelField>
          );
        }}
      </TargetField>
      <ValueTextField
        label="Note"
        maxLength={AUTOMATION_TEXT_MAX}
        value={action.text}
        invalid={invalidPath === 'text'}
        onChange={(text) => onChange({ ...action, text })}
      />
      <CrossAppPreview
        outline={outline}
        where={`A note in ${targetWords(action.target, 'a Space')}, signed by the rule`}
        lines={[{ label: 'Note', text: action.text }]}
      />
    </div>
  );
}

export function DocTabPanel({ action, onChange, outline, invalidPath }: Props<DocTabStep>) {
  return (
    <div className="flex flex-col gap-4">
      <TargetField
        target={action.target}
        apps={['livedocuments', 'livediagram']}
        noun="document"
        invalid={invalidPath === 'target'}
        onChange={(target) => onChange({ ...action, target, docTemplate: '' })}
      >
        {(target) => {
          const templates = target.templates ?? [];
          return (
            <PanelField
              label="Template"
              hint={`A tab as New Tab makes it in ${appWord(action.target.app)}.`}
            >
              {(id, hintId) => (
                <PanelSelect
                  id={id}
                  aria-describedby={hintId}
                  aria-invalid={invalidPath === 'docTemplate' || undefined}
                  value={action.docTemplate}
                  onChange={(e) => onChange({ ...action, docTemplate: e.target.value })}
                >
                  {action.docTemplate ? null : <option value="">Pick a template</option>}
                  {action.docTemplate && !templates.some((t) => t.id === action.docTemplate) ? (
                    <option value={action.docTemplate}>{GONE}</option>
                  ) : null}
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </PanelSelect>
              )}
            </PanelField>
          );
        }}
      </TargetField>
      <ValueTextField
        label="Name"
        multiline={false}
        maxLength={CROSS_APP_TITLE_MAX}
        value={action.name}
        invalid={invalidPath === 'name'}
        onChange={(name) => onChange({ ...action, name })}
      />
      <CrossAppPreview
        outline={outline}
        where={`A new tab in ${targetWords(action.target, 'a document')}`}
        lines={[{ label: 'Name', text: action.name }]}
      />
    </div>
  );
}

export function InboxNoticePanel({
  action,
  onChange,
  outline,
  invalidPath,
}: Props<InboxNoticeStep>) {
  const people = outlinePeople(outline);
  const picked = action.to.flatMap((r) => ('person' in r ? [r.person] : []));
  const values = action.to.filter((r) => !('person' in r));
  return (
    <div className="flex flex-col gap-4">
      <ChipToggles
        label="Notify"
        options={people.map((p) => ({ value: p.id, label: p.name }))}
        value={picked}
        empty="Nobody here to notify yet."
        hint={`Up to ${CROSS_APP_NOTICE_PEOPLE_MAX} people. Each sees it in their Inbox, in every app, while they can open this.`}
        onChange={(ids) =>
          onChange({
            ...action,
            to: [
              ...ids.slice(0, CROSS_APP_NOTICE_PEOPLE_MAX).map((person) => ({ person })),
              ...values,
            ],
          })
        }
      />
      <ValueTextField
        label="Message"
        maxLength={AUTOMATION_TEXT_MAX}
        value={action.text}
        invalid={invalidPath === 'text'}
        onChange={(text) => onChange({ ...action, text })}
      />
      <CrossAppPreview
        outline={outline}
        where="A notice in their Inbox"
        lines={[{ label: 'Message', text: action.text }]}
      />
    </div>
  );
}
