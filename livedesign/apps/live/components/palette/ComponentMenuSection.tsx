'use client';

// The Component section of an element's menu (docs/specs/009-elements/components.md "The menu"). On an instance: its
// main's name (an Editor renames it), Edit Component, Detach, Reset Overrides, Remove from Library, and Overrides, one
// row per element of the main that takes one (text, colours, icon). On anything else: Make Component, greyed with
// its reason when the selection cannot be made into one. Read from the editor itself, as the Tab Window section is.
import { useState } from 'react';
import {
  componentOverrideTargets,
  isInstance,
  type ComponentOverride,
  type DesignComponent,
  type Element,
  type InstanceElement,
  type OverrideTarget,
} from '@livedesign/design';
import {
  lucidePackage,
  lucidePencil,
  lucideRotateCcw,
  lucideShapes,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import {
  MenuAccordionSection,
  MenuActionRow,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MENU_CELL_INPUT } from '@liveworkspace/workbench/components/palette/menu-editor-classes';
import { useEditorContext, useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import { MAKE_COMPONENT_REFUSAL } from '@/app/design/[id]/useComponentActions';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { CatalogIconThumb } from '@/components/primitives/icon-glyph';
import { getLineArtIconCatalog } from '@/lib/icons';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';

const ComponentIcon = lucideGlyph(lucidePackage, 16);
const EditIcon = lucideGlyph(lucidePencil, 16);
const DetachIcon = lucideGlyph(lucideShapes, 16);
const ResetIcon = lucideGlyph(lucideRotateCcw, 16);
const RemoveIcon = lucideGlyph(lucideTrash2, 16);

// Icons a swap search shows at most.
const ICON_RESULTS = 12;

type SectionProps = (id: string) => { open: boolean; onToggle: () => void; flush: boolean };

/** Make Component for one element or a multi-selection: a row, greyed with its reason when refused. */
export function MakeComponentRow({
  ids,
  onDone,
}: {
  ids: ReadonlySet<string>;
  onDone: () => void;
}) {
  const { componentActions } = useEditorContext();
  if (!componentActions.canEdit) return null;
  const refusal = componentActions.makeRefusal(ids);
  const row = (
    <MenuActionRow
      label="Make Component"
      icon={<ComponentIcon />}
      disabled={refusal !== null}
      onClick={() => {
        componentActions.makeFromSelection(ids);
        onDone();
      }}
    />
  );
  return refusal ? (
    <Tooltip label={MAKE_COMPONENT_REFUSAL[refusal]}>
      <div>{row}</div>
    </Tooltip>
  ) : (
    row
  );
}

export function ComponentMenuSection({
  target,
  sectionProps,
  onClose,
}: {
  target: Element;
  sectionProps: SectionProps;
  onClose: () => void;
}) {
  // Outside an editor (a menu drawn on its own, as in tests and previews) there is no library: no section.
  const editor = useOptionalEditorContext();
  if (!editor) return null;
  const { componentActions, componentLibrary } = editor;
  if (!isInstance(target)) {
    if (!componentActions.canEdit) return null;
    return (
      <MenuAccordionSection
        title="Component"
        icon={<ComponentIcon />}
        {...sectionProps('component')}
      >
        <MakeComponentRow ids={new Set([target.id])} onDone={onClose} />
      </MenuAccordionSection>
    );
  }
  const main = componentLibrary.lookup(target.componentId);
  const mayChange = componentActions.canEdit && target.locked !== true;
  return (
    <MenuAccordionSection
      title={main ? main.name : 'Component'}
      icon={<ComponentIcon />}
      {...sectionProps('component')}
    >
      {!main ? (
        <p className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
          {componentLibrary.loaded ? 'Missing component' : 'Loading component'}
        </p>
      ) : (
        <>
          {componentActions.canEdit ? (
            <ComponentNameRow main={main} onRename={componentActions.rename} />
          ) : null}
          {mayChange ? (
            <>
              <MenuActionRow
                label="Edit Component"
                icon={<EditIcon />}
                onClick={() => {
                  componentActions.startEdit(target.id);
                  onClose();
                }}
              />
              <MenuActionRow
                label="Detach"
                icon={<DetachIcon />}
                onClick={() => {
                  componentActions.detach(target.id);
                  onClose();
                }}
              />
              <MenuActionRow
                label="Reset Overrides"
                icon={<ResetIcon />}
                disabled={!target.componentOverrides}
                onClick={() => componentActions.resetOverrides(target.id)}
              />
              {!main.archived ? (
                <MenuActionRow
                  label="Remove from Library"
                  icon={<RemoveIcon />}
                  onClick={() => componentActions.removeFromLibrary(main.id)}
                />
              ) : null}
              <ComponentOverrides
                instance={target}
                main={main}
                onSet={(elementId, field, value) =>
                  componentActions.setOverride(target.id, elementId, field, value)
                }
              />
            </>
          ) : null}
        </>
      )}
    </MenuAccordionSection>
  );
}

function ComponentNameRow({
  main,
  onRename,
}: {
  main: DesignComponent;
  onRename: (id: string, name: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onRename(main.id, draft);
    setDraft(null);
  };
  return (
    <div className="px-2 py-1.5">
      <label className="block">
        <span className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Name
        </span>
        <input
          data-component-name=""
          value={draft ?? main.name}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setDraft(null);
            e.stopPropagation();
          }}
          className={`${MENU_CELL_INPUT} w-full`}
        />
      </label>
    </div>
  );
}

const FIELD_LABEL: Record<Exclude<keyof ComponentOverride, 'label' | 'iconId'>, string> = {
  fillColor: 'Fill',
  strokeColor: 'Border',
  textColor: 'Text',
};

/** One row per element of the main that takes an override: its text, its colours, its icon. A changed field is
 *  marked and clears back to the main's with its reset. */
export function ComponentOverrides({
  instance,
  main,
  onSet,
}: {
  instance: InstanceElement;
  main: DesignComponent;
  onSet: (elementId: string, field: keyof ComponentOverride, value: string | undefined) => void;
}) {
  const targets = componentOverrideTargets(main);
  if (targets.length === 0) return null;
  return (
    <div className="px-2 pb-1.5 pt-1" data-component-overrides="">
      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Overrides
      </p>
      <ul className="flex flex-col gap-2">
        {targets.map((t) => (
          <OverrideRow
            key={t.elementId}
            target={t}
            override={instance.componentOverrides?.[t.elementId]}
            onSet={(field, value) => onSet(t.elementId, field, value)}
          />
        ))}
      </ul>
    </div>
  );
}

function OverrideRow({
  target,
  override,
  onSet,
}: {
  target: OverrideTarget;
  override: ComponentOverride | undefined;
  onSet: (field: keyof ComponentOverride, value: string | undefined) => void;
}) {
  const main = target.main as Element & Partial<Record<keyof ComponentOverride, string>>;
  const changed = override && Object.keys(override).length > 0;
  return (
    <li
      className="rounded-md border border-slate-200 p-1.5 dark:border-slate-700"
      data-override-row={target.elementId}
    >
      <div className="flex items-center justify-between gap-2 px-0.5 pb-1">
        <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {target.name}
        </span>
        {changed ? (
          <Tooltip label="Use the component's own">
            <button
              type="button"
              aria-label={`Reset ${target.name}`}
              onClick={() => {
                for (const f of Object.keys(override) as (keyof ComponentOverride)[])
                  onSet(f, undefined);
              }}
              className="cursor-pointer rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ResetIcon />
            </button>
          </Tooltip>
        ) : null}
      </div>
      {target.fields.includes('label') ? (
        <OverrideText
          label={`${target.name} text`}
          value={override?.label ?? main.label ?? ''}
          onCommit={(v) => onSet('label', v === (main.label ?? '') ? undefined : v)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {(['fillColor', 'strokeColor', 'textColor'] as const)
          .filter((f) => target.fields.includes(f))
          .map((f) => (
            <span key={f} className="flex items-center gap-1 text-[11px] text-slate-500">
              <ColourSwatchButton
                label={`${target.name} ${FIELD_LABEL[f].toLowerCase()} colour`}
                value={override?.[f] ?? main[f]}
                swatch={override?.[f] ?? main[f] ?? 'transparent'}
                onPick={(id) => onSet(f, id)}
              />
              {FIELD_LABEL[f]}
            </span>
          ))}
      </div>
      {target.fields.includes('iconId') ? (
        <OverrideIcon
          name={target.name}
          current={override?.iconId ?? main.iconId}
          onPick={(id) => onSet('iconId', id === main.iconId ? undefined : id)}
        />
      ) : null}
    </li>
  );
}

function OverrideText({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      value={draft ?? value}
      maxLength={5000}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
        e.stopPropagation();
      }}
      className={`${MENU_CELL_INPUT} w-full`}
    />
  );
}

function OverrideIcon({
  name,
  current,
  onPick,
}: {
  name: string;
  current: string | undefined;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  // The catalogue loads on demand; a search waits for it rather than finding nothing.
  const catalogLoaded = useIconCatalogs();
  const q = query.trim().toLowerCase();
  const results =
    q && catalogLoaded
      ? getLineArtIconCatalog()
          .filter((i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q))
          .slice(0, ICON_RESULTS)
      : [];
  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5">
        {current ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 dark:border-slate-700">
            <CatalogIconThumb iconId={current} />
          </span>
        ) : null}
        <input
          aria-label={`Swap ${name} icon`}
          placeholder="Swap Icon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className={`${MENU_CELL_INPUT} flex-1`}
        />
      </div>
      {results.length > 0 ? (
        <div className="grid grid-cols-6 gap-1 pt-1">
          {results.map((icon) => (
            <Tooltip key={icon.id} label={icon.label}>
              <button
                type="button"
                aria-label={`Use ${icon.label}`}
                onClick={() => {
                  onPick(icon.id);
                  setQuery('');
                }}
                className="flex h-7 cursor-pointer items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
              >
                <CatalogIconThumb iconId={icon.id} />
              </button>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
