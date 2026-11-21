'use client';

// Component Changed's panel (docs/specs/013-workspace/automations.md "Triggers of its own", "The screen"; blueprint
// automations.md "Editor", "The kit"), built from the platform's panel parts so it sits beside the shared triggers'
// as one family: Any Component, or one main of the design's library, read when the panel shows. Picking one saves
// its id and its name (the words' when the library is not at hand); a main since deleted stays as "(No Longer
// Here)" until another is picked, and a copy's pick left empty asks for one. Loaded with the screen.

import {
  COMPONENT_CHANGED_EVENT,
  type ComponentChangedTrigger,
} from '@livedesign/design/automations';
import { Button } from '@liveworkspace/ui';
import type { TriggerPanelProps } from '@liveworkspace/automations-ui/kit';
import type { ItemUiOutline } from '@liveworkspace/automations-ui/item';
import {
  PanelField,
  PanelNote,
  PanelSelect,
} from '@liveworkspace/automations-ui/step-panels/panel-parts';
import { useLibraryMains, type LibraryMain } from './use-library-mains';

type Props = TriggerPanelProps<ComponentChangedTrigger, ItemUiOutline>;

const HINT =
  'It starts once the library has been quiet for 2 minutes after the last change, so a burst of edits is one run. A revert or a copy is not a change.';

/** A main the rule names that the library no longer holds, in the select: as the shared panels say a gone tab. */
export const goneMain = (name?: string | null) => `${name || 'A component'} (No Longer Here)`;

/** A main as its option says it: its name, and Archived for one taken out of the palette. */
export const mainLabel = (main: LibraryMain) =>
  main.archived ? `${main.name} (Archived)` : main.name;

// The select's value for Any Component: no main's id (the library's ids are generated, never this).
export const ANY_MAIN = '*';

/** The trigger with `id` picked from `list`, or with no pick for Any Component. A main's name is stored at most
 *  COMPONENT_NAME_MAX long, as the trigger keeps it. */
export function pickMain(id: string, list: readonly LibraryMain[]): ComponentChangedTrigger {
  if (id === ANY_MAIN) return { kind: COMPONENT_CHANGED_EVENT };
  const name = list.find((m) => m.id === id)?.name.trim();
  return { kind: COMPONENT_CHANGED_EVENT, component: id, ...(name ? { name } : {}) };
}

export function ComponentChangedPanel({ trigger, onChange, outline }: Props) {
  const { status, list, retry } = useLibraryMains(outline.item);
  const value = trigger.component;
  // A copy's or a file's rule keeps the pick empty until one is chosen ('' is to pick; absent is Any Component).
  const toPick = value === '';
  const loading = status === 'loading';
  const known = list.some((m) => m.id === value);
  if (status === 'error')
    return (
      <div className="flex flex-col gap-2">
        <PanelNote>
          Couldn’t load this design’s components. Check your connection and try again.
        </PanelNote>
        <Button variant="secondary" size="xs" className="self-start" onClick={retry}>
          Try Again
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Component" hint={HINT}>
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            aria-invalid={toPick || undefined}
            value={value ?? ANY_MAIN}
            disabled={loading}
            onChange={(e) => {
              if (e.target.value) onChange(pickMain(e.target.value, list));
            }}
          >
            {toPick ? <option value="">Pick a component</option> : null}
            <option value={ANY_MAIN}>Any Component</option>
            {loading && value ? (
              <option value={value}>{trigger.name || 'Loading components…'}</option>
            ) : null}
            {!loading && value && !known ? (
              <option value={value}>{goneMain(trigger.name)}</option>
            ) : null}
            {loading
              ? null
              : list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {mainLabel(m)}
                  </option>
                ))}
          </PanelSelect>
        )}
      </PanelField>
      {!loading && list.length === 0 ? (
        <PanelNote>
          This design has no components yet. Any Component still hears the first one made; to keep
          to one, make it a component first, then pick it here.
        </PanelNote>
      ) : null}
    </div>
  );
}
