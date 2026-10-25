'use client';

// The active layer's blend mode (docs/specs/031-photo/photo-layers.md "The Layers tab"): a button naming it,
// opening the modes as the app's menu rows in their groups; pointing at a mode (or focusing it) previews it
// on the photo, a press keeps it, and closing the menu shows the photo as it was.
import { Fragment, useState } from 'react';
import { BLEND_MODE_NAMES, type BlendMode } from '@livedesign/photo-engine';
import { lucideChevronDown } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { blendSwatch } from '@/lib/photo-editor/blend-swatch';

const Chevron = lucideGlyph(lucideChevronDown, 12);

/** A blend mode drawn as itself (blend-swatch), for the button and each row. */
function Swatch({ mode, size }: { mode: BlendMode; size: number }) {
  const src = mode === 'pass-through' ? null : blendSwatch(mode);
  return (
    <span
      aria-hidden
      className="block shrink-0 overflow-hidden rounded ring-1 ring-slate-200 dark:ring-slate-700"
      style={{ width: size * 1.5, height: size }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

export function PhotoBlendPicker({
  value,
  groups,
  onPreview,
  onChange,
}: {
  value: BlendMode;
  groups: readonly (readonly BlendMode[])[];
  // A mode shown on the photo while pointed at; null puts the photo back.
  onPreview: (mode: BlendMode | null) => void;
  onChange: (mode: BlendMode) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => {
    onPreview(null);
    setOpen(false);
  };
  return (
    <div className="flex w-full items-center gap-2">
      <span className="w-14 shrink-0 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
        Blend
      </span>
      <button
        ref={setAnchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Blend Mode: ${BLEND_MODE_NAMES[value]}`}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[12.5px] font-medium text-slate-800 ring-1 transition dark:text-slate-100 ${
          open
            ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-500/50'
            : 'bg-white ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800'
        }`}
      >
        <Swatch mode={value} size={16} />
        <span className="min-w-0 flex-1 truncate">{BLEND_MODE_NAMES[value]}</span>
        <span className="text-slate-400">
          <Chevron />
        </span>
      </button>
      {open && anchor ? (
        <PortalMenu anchor={anchor} label="Blend Mode" onClose={close}>
          {groups.map((group, i) => (
            <Fragment key={group.join()}>
              {i > 0 ? <MenuGroupSeparator /> : null}
              {group.map((mode) => (
                <div
                  key={mode}
                  onPointerEnter={() => onPreview(mode)}
                  onFocus={() => onPreview(mode)}
                >
                  <MenuActionRow
                    plain
                    icon={<Swatch mode={mode} size={14} />}
                    label={BLEND_MODE_NAMES[mode]}
                    onClick={() => {
                      setOpen(false);
                      onChange(mode);
                    }}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </PortalMenu>
      ) : null}
    </div>
  );
}
