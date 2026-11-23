'use client';

import { useState } from 'react';
import { ENTITY_KEYS, ENTITY_KEY_LABELS, type EntityKey } from '@livediagram/document';
import { CheckIcon, Glyph, Tooltip } from '@livediagram/ui';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { EntityKeyGlyph } from '@/components/canvas/entity/EntityKeyGlyph';

// A field's key in the Fields dialog (docs/specs/009-elements/entity.md "The Fields dialog"): a button showing the
// key's glyph alone, as the entity draws it, which opens a menu of every key, each glyph beside its name. The names
// are in the menu only: a row of the dialog has no room for them, and the menu is where the glyphs are learnt.
const KEY_NAMES: Readonly<Record<EntityKey, string>> = {
  pk: 'Primary Key',
  fk: 'Foreign Key',
  'pk-fk': 'Primary and Foreign Key',
  uk: 'Unique Key',
};

const OPTIONS: readonly (EntityKey | undefined)[] = [undefined, ...ENTITY_KEYS];
const nameOf = (key: EntityKey | undefined) => (key ? KEY_NAMES[key] : 'No Key');

// No key: an empty slot.
function NoKeyGlyph() {
  return (
    <Glyph size={14} units={16}>
      <circle cx="8" cy="8" r="4.5" strokeDasharray="2 2.2" />
    </Glyph>
  );
}

const keyGlyph = (key: EntityKey | undefined) =>
  key ? <EntityKeyGlyph fieldKey={key} color="currentColor" /> : <NoKeyGlyph />;

export function EntityKeyPicker({
  index,
  value,
  onPick,
}: {
  // The field's place in the list, for its name.
  index: number;
  value: EntityKey | undefined;
  onPick: (key: EntityKey | undefined) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Tooltip label={nameOf(value)}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          aria-label={`Field ${index + 1} key: ${nameOf(value)}. Change key`}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
          className={`flex h-9 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 ${
            value
              ? 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              : 'border-dashed border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
          } ${anchor ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
        >
          {keyGlyph(value)}
        </button>
      </Tooltip>
      {anchor ? (
        <PortalMenu anchor={anchor} label="Key" onClose={() => setAnchor(null)}>
          {OPTIONS.map((key) => (
            <MenuActionRow
              key={key ?? 'none'}
              plain
              label={nameOf(key)}
              icon={keyGlyph(key)}
              aside={
                key === value ? (
                  <CheckIcon />
                ) : key ? (
                  <span className="font-mono text-[10px] text-slate-400">
                    {ENTITY_KEY_LABELS[key]}
                  </span>
                ) : undefined
              }
              onClick={() => {
                setAnchor(null);
                if (key !== value) onPick(key);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}
