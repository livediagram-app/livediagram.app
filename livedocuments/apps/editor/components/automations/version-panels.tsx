'use client';

// Name This Version's and Restore a Version's panels (docs/specs/013-workspace/automations.md "Steps of its own", "The
// screen"; blueprint automations.md "Editor", "The kit"), built from the platform's panel parts so they sit beside
// the shared steps' as one family. Name This Version takes the tab (the run's, where the trigger has one, or a chosen
// one) and a name with values; Restore a Version takes a tab, then one of that tab's named versions, read from Version
// History when the tab is picked. Loaded with the screen.

import {
  KINDS,
  RESTORE_VERSION_STEP,
  type NameVersionStep,
  type RestoreVersionStep,
} from '@livedocuments/document/automations';
import { RUN_TAB, STEP_NAME_MAX } from '@liveworkspace/automations/item';
import { Button, CompactEmptyState, lucideGlyph } from '@liveworkspace/ui';
import { lucideBookmark } from '@liveworkspace/icons/lucide';
import type { ActionPanelProps } from '@liveworkspace/automations-ui/kit';
import { TabSelect, goneLabel, type ItemUiOutline } from '@liveworkspace/automations-ui/item';
import { useRuleContext } from '@liveworkspace/automations-ui/rule-context';
import {
  PanelField,
  PanelNote,
  PanelSelect,
} from '@liveworkspace/automations-ui/step-panels/panel-parts';
import { ValueTextField } from '@liveworkspace/automations-ui/ValueInsert';
import { useNamedVersions, type NamedVersion } from './use-named-versions';

type Props<Step> = ActionPanelProps<Step, ItemUiOutline>;

const BookmarkGlyph = lucideGlyph(lucideBookmark, 18);

/** A version the step names that its tab no longer holds as a named one, in a select: as the shared panels say a
 *  gone snapshot (goneLabel). */
const goneVersion = (name?: string | null) => `${name || 'A version'} (No Longer Here)`;

export function NameVersionPanel({
  action,
  onChange,
  outline,
  invalidPath,
}: Props<NameVersionStep>) {
  const trigger = useRuleContext().body?.trigger.kind ?? '';
  // The run has a tab of its own only where the trigger is about one.
  const tabbed = KINDS.trigger(trigger)?.tabbed === true;
  const { tabs } = outline.item;
  const value = action.tab;
  const run = value === RUN_TAB;
  const goneTab = value !== '' && !run && !tabs.some((t) => t.id === value);
  return (
    <div className="flex flex-col gap-4">
      <PanelField
        label="Tab"
        hint={
          run && !tabbed
            ? 'This rule’s trigger is about no tab, so the run has none to name: pick one.'
            : 'The tab whose content as it is now is kept under the name, in Version History.'
        }
      >
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            aria-invalid={invalidPath === 'tab' || (run && !tabbed) || undefined}
            value={value}
            onChange={(e) => onChange({ ...action, tab: e.target.value })}
          >
            {value === '' ? <option value="">Pick a tab</option> : null}
            {/* The run's tab only where a run has one; kept while the step still says so. */}
            {tabbed || run ? <option value={RUN_TAB}>The Tab the Rule Runs On</option> : null}
            {tabs.length > 0 || goneTab ? (
              <optgroup label="One Tab">
                {goneTab ? <option value={value}>{goneLabel('tab')}</option> : null}
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
      <ValueTextField
        label="Name"
        multiline={false}
        maxLength={STEP_NAME_MAX}
        value={action.name}
        invalid={invalidPath === 'name' || invalidPath === ''}
        hint="The version’s name in Version History. Values are filled in when the rule runs. A tab holds up to 25 named versions."
        onChange={(name) => onChange({ ...action, name })}
      />
    </div>
  );
}

/** A named version as its option says it: its name and the day it was kept. */
export function versionLabel(version: NamedVersion, locale?: string): string {
  const day = new Date(version.createdAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  });
  return `${version.name} · ${day}`;
}

const RESTORE_HINT =
  'The tab goes back to this version for everyone, as Restore does in Version History. What it replaces is kept as a version, so it can be undone there.';

function VersionField({
  action,
  onChange,
  item,
  invalid,
}: {
  action: RestoreVersionStep;
  onChange: (next: RestoreVersionStep) => void;
  item: ItemUiOutline['item'];
  invalid: boolean;
}) {
  const { status, list, retry } = useNamedVersions(item, action.tab);
  if (status === 'error')
    return (
      <div className="flex flex-col gap-2">
        <PanelNote>
          Couldn’t load this tab’s versions. Check your connection and try again.
        </PanelNote>
        <Button variant="secondary" size="xs" className="self-start" onClick={retry}>
          Try Again
        </Button>
      </div>
    );
  const loading = status === 'loading';
  if (!loading && list.length === 0 && !action.version)
    return (
      <CompactEmptyState
        role="status"
        icon={<BookmarkGlyph aria-hidden />}
        title="No named versions yet"
        description="Name a version of this tab in Version History first. Then pick it here."
      />
    );
  const known = list.some((v) => v.id === action.version);
  return (
    <PanelField label="Version" hint={RESTORE_HINT}>
      {(id, hintId) => (
        <PanelSelect
          id={id}
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          value={action.version}
          disabled={loading}
          onChange={(e) => {
            const picked = list.find((v) => v.id === e.target.value);
            if (picked)
              onChange({
                kind: RESTORE_VERSION_STEP,
                tab: action.tab,
                version: picked.id,
                name: picked.name.slice(0, STEP_NAME_MAX),
              });
          }}
        >
          {loading ? <option value={action.version}>Loading versions…</option> : null}
          {!loading && !action.version ? <option value="">Pick a version</option> : null}
          {!loading && action.version && !known ? (
            <option value={action.version}>{goneVersion(action.name)}</option>
          ) : null}
          {loading
            ? null
            : list.map((v) => (
                <option key={v.id} value={v.id}>
                  {versionLabel(v)}
                </option>
              ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}

export function RestoreVersionPanel({
  action,
  onChange,
  outline,
  invalidPath,
}: Props<RestoreVersionStep>) {
  const { item } = outline;
  // A tab deleted since has no versions to read: the step says so until another tab is picked.
  const here = item.tabs.some((t) => t.id === action.tab);
  return (
    <div className="flex flex-col gap-4">
      <TabSelect
        label="Tab"
        value={action.tab}
        tabs={item.tabs}
        invalid={invalidPath === 'tab'}
        hint="A version belongs to one tab: pick the tab, then one of its named versions."
        // A new tab's versions are its own: the one picked before is cleared.
        onChange={(tab) => onChange({ kind: RESTORE_VERSION_STEP, tab, version: '' })}
      />
      {action.tab && !here ? (
        <PanelNote>
          {action.name ? `“${action.name}” was a version of a tab` : 'This step names a tab'} this
          document no longer has. Pick another tab, then one of its named versions.
        </PanelNote>
      ) : null}
      {here ? (
        <VersionField
          action={action}
          onChange={onChange}
          item={item}
          invalid={invalidPath === 'version' || invalidPath === ''}
        />
      ) : null}
    </div>
  );
}
