'use client';

// The social pieces' settings in the element menu (docs/specs/009-elements/social-pieces.md): a World Clock's zones
// and a Jukebox's source. Typed locally and committed with Add / Set or Enter, like the Screen's link. Only an
// Editor's menu renders them (EditorContextMenuHost hands a Participant or a Viewer its own short menu).
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import {
  CLOCK_LABEL_MAX,
  CLOCK_ZONES_MAX,
  isJukeboxSource,
  JUKEBOX_SOURCE_MAX,
  type ClockZone,
  type ShapeElement,
} from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { Tooltip } from '@livehuddle/ui';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { typedClockZone } from '@/lib/zone-time';

type SectionProps = (id: string) => { open: boolean; onToggle: () => void };

const FIELD =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const PRIMARY =
  'h-7 cursor-pointer rounded-md bg-brand-700 px-2 text-[11px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 disabled:cursor-default disabled:opacity-50';
const SECONDARY =
  'h-7 cursor-pointer rounded-md bg-slate-100 px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

// The menu listens for keys; typing in a field must not trigger them. Enter runs `onEnter`.
const fieldKeys = (onEnter: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    onEnter();
  }
  e.stopPropagation();
};

// Every zone this browser knows, for the suggestions; empty where it cannot list them.
function knownZones(): string[] {
  try {
    const list = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
      'timeZone',
    );
    return list ?? [];
  } catch {
    return [];
  }
}

export function WorldClockMenuSection({
  target,
  sectionProps,
  onSetZones,
}: {
  target: ShapeElement;
  sectionProps: SectionProps;
  onSetZones: (zones: ClockZone[] | undefined) => void;
}) {
  const listId = useId();
  const zones = target.clockZones ?? [];
  const [zone, setZone] = useState('');
  const [error, setError] = useState(false);
  const suggestions = useMemo(() => knownZones(), []);
  const full = zones.length >= CLOCK_ZONES_MAX;
  const add = () => {
    const next = typedClockZone(zone);
    if (!next || full) {
      setError(true);
      return;
    }
    setError(false);
    setZone('');
    onSetZones([...zones, next]);
  };
  const setLabel = (i: number, label: string) =>
    onSetZones(
      zones.map((z, k) => (k === i ? { ...z, label: label.slice(0, CLOCK_LABEL_MAX) } : z)),
    );
  const remove = (i: number) => {
    const next = zones.filter((_, k) => k !== i);
    onSetZones(next.length > 0 ? next : undefined);
  };
  return (
    <MenuAccordionSection
      title="World Clock"
      icon={<ToolsMenuGlyph />}
      {...sectionProps('world-clock')}
    >
      <div className="flex flex-col gap-1.5 px-3 pb-2 pt-1">
        {zones.length === 0 ? (
          <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Shows each viewer their own time. Add up to {CLOCK_ZONES_MAX} zones; the first three are
            on the clock.
          </p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label="Zones">
            {zones.map((z, i) => (
              <ZoneRow
                key={`${z.zone}-${i}`}
                zone={z}
                onLabel={(l) => setLabel(i, l)}
                onRemove={() => remove(i)}
              />
            ))}
          </ul>
        )}
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Add Zone
          <div className="mt-1 flex gap-1.5">
            <input
              value={zone}
              list={listId}
              onChange={(e) => {
                setZone(e.target.value);
                setError(false);
              }}
              onKeyDown={fieldKeys(add)}
              disabled={full}
              placeholder={full ? 'Six zones is the most' : 'Europe/London'}
              aria-invalid={error}
              className={FIELD}
            />
            <button type="button" onClick={add} disabled={!zone.trim() || full} className={PRIMARY}>
              Add
            </button>
          </div>
        </label>
        <datalist id={listId}>
          {suggestions.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        {error ? (
          <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-400">
            That isn&apos;t a time zone this browser knows
          </p>
        ) : null}
      </div>
    </MenuAccordionSection>
  );
}

function ZoneRow({
  zone,
  onLabel,
  onRemove,
}: {
  zone: ClockZone;
  onLabel: (label: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useFollowingDraft(`${zone.zone}\u0000${zone.label}`, () => zone.label);
  const commit = () => {
    if (draft.trim() && draft !== zone.label) onLabel(draft.trim());
  };
  return (
    <li className="flex items-center gap-1.5">
      <input
        value={draft}
        maxLength={CLOCK_LABEL_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={fieldKeys(commit)}
        aria-label={`Label for ${zone.zone}`}
        className={FIELD}
      />
      <Tooltip label={`Remove ${zone.label}`}>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${zone.label}`}
          className={`${SECONDARY} w-7 shrink-0 px-0`}
        >
          ×
        </button>
      </Tooltip>
    </li>
  );
}

function normalised(raw: string): string {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
}

export function JukeboxMenuSection({
  target,
  sectionProps,
  onSetSource,
}: {
  target: ShapeElement;
  sectionProps: SectionProps;
  onSetSource: (source: string | undefined) => void;
}) {
  const saved = target.jukeboxSource ?? '';
  const [draft, setDraft] = useFollowingDraft(`${target.id}\u0000${saved}`, () => saved);
  const [error, setError] = useState(false);
  const url = normalised(draft);
  const commit = () => {
    if (!url) return;
    if (url.length > JUKEBOX_SOURCE_MAX || !isJukeboxSource(url)) {
      setError(true);
      return;
    }
    setError(false);
    if (url !== saved) onSetSource(url);
  };
  return (
    <MenuAccordionSection title="Jukebox" icon={<ToolsMenuGlyph />} {...sectionProps('jukebox')}>
      <div className="px-3 pt-1">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Music Link
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            onKeyDown={fieldKeys(commit)}
            placeholder="An https link to an MP3, AAC or Ogg stream"
            aria-invalid={error}
            className={`mt-1 ${FIELD}`}
          />
        </label>
        {error ? (
          <p role="alert" className="pt-1 text-[10px] text-rose-600 dark:text-rose-400">
            That isn&apos;t an https link
          </p>
        ) : null}
        <p className="pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Use music you have the rights to share. People hear it in this jukebox&apos;s room once
          they press Play on it.
        </p>
        <div className="flex gap-1.5 py-2">
          <button
            type="button"
            onClick={commit}
            disabled={!url || url === saved}
            className={`${PRIMARY} flex-1`}
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setError(false);
              onSetSource(undefined);
            }}
            disabled={!saved}
            className={`${SECONDARY} flex-1`}
          >
            Clear
          </button>
        </div>
      </div>
    </MenuAccordionSection>
  );
}
