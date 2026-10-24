'use client';

// A photo page's title-bar menus (docs/specs/031-photo/photo-pages.md "The title bar"): Image (the
// applied adjustments, the autos, the size and turn commands), Select and Filter (by category, the
// last one used first as Repeat), each the cog's size with a tooltip and named while there is room.
// The menus are the app's menu rows, grouped with separators. For someone who may edit.
import { useState } from 'react';
import {
  lucideFunnel,
  lucideImage,
  lucideScan,
  lucideSlidersHorizontal,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import {
  ADJUSTMENT_IDS,
  adjustmentName,
  FILTER_CATEGORY_NAMES,
  FILTERS,
  type FilterCategory,
} from '@livedesign/photo-engine';
import { titleButtonClass } from '@/components/canvas/TitlePopoverButton';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { ActionGlyph, AdjustGlyph, FilterGlyph } from './photo-menu-icons';
import { lastPhotoFilter, photoDialogs } from '@/lib/photo-editor/photo-dialog-store';
import {
  openAdjustment,
  PHOTO_ACTIONS,
  runPhotoAction,
  type PhotoMenu,
} from '@/lib/photo-editor/photo-actions';

const ImageIcon = lucideGlyph(lucideImage, 14);
const SelectIcon = lucideGlyph(lucideScan, 14);
const FilterIcon = lucideGlyph(lucideFunnel, 14);
const AdjustIcon = lucideGlyph(lucideSlidersHorizontal, 16);

export { photoTitleBarRoom } from './photo-title-bar-room';

const CATEGORIES = Object.keys(FILTER_CATEGORY_NAMES) as FilterCategory[];

function ActionRows({
  menu,
  photo,
  close,
}: {
  menu: PhotoMenu;
  photo: PhotoEditorView;
  close: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const rows = PHOTO_ACTIONS.filter((a) => a.menu === menu);
  return (
    <>
      {rows.map((a, i) => (
        <span key={a.id}>
          {i > 0 && rows[i - 1]!.section !== a.section ? <MenuGroupSeparator /> : null}
          <MenuActionRow
            plain
            icon={<ActionGlyph id={a.id} />}
            label={a.label}
            onClick={() => {
              close();
              runPhotoAction(a.id, photo);
            }}
          />
        </span>
      ))}
    </>
  );
}

function MenuButton({
  name,
  icon,
  labelled,
  open,
  onToggle,
  anchorRef,
}: {
  name: string;
  icon: React.ReactNode;
  labelled: boolean;
  open: boolean;
  onToggle: () => void;
  anchorRef: (el: HTMLButtonElement | null) => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <Tooltip label={name}>
      <button
        ref={anchorRef}
        type="button"
        aria-label={name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={titleButtonClass(open, labelled)}
      >
        {icon}
        {labelled ? <span aria-hidden>{name}</span> : null}
      </button>
    </Tooltip>
  );
}

export function PhotoTitleBar({
  pageId,
  photo,
  labelled,
}: {
  pageId: string;
  photo: PhotoEditorView;
  labelled: boolean;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [open, setOpen] = useState<PhotoMenu | 'Filter' | null>(null);
  // Each a state setter, so the refs are stable: a new callback each render would hand the menu a
  // null anchor between renders and close it.
  const [imageAnchor, setImageAnchor] = useState<HTMLButtonElement | null>(null);
  const [selectAnchor, setSelectAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const close = () => {
    setOpen(null);
    setSection(null);
  };
  const toggle = (m: PhotoMenu | 'Filter') => {
    // The page's own commands: it comes into focus first.
    photo.press(pageId);
    setOpen(open === m ? null : m);
  };
  const ready = photo.session?.pageId === pageId;
  const last = lastPhotoFilter.get();
  return (
    <div
      data-photo-title-bar=""
      className="pointer-events-auto flex items-center gap-1"
      // Its menus are portalled, but React bubbles their presses up here: the canvas under the page
      // must not take them (it would close the menu, or start a marquee).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <MenuButton
        name="Image"
        icon={<ImageIcon />}
        labelled={labelled}
        open={open === 'Image'}
        onToggle={() => toggle('Image')}
        anchorRef={setImageAnchor}
      />
      <MenuButton
        name="Select"
        icon={<SelectIcon />}
        labelled={labelled}
        open={open === 'Select'}
        onToggle={() => toggle('Select')}
        anchorRef={setSelectAnchor}
      />
      <MenuButton
        name="Filter"
        icon={<FilterIcon />}
        labelled={labelled}
        open={open === 'Filter'}
        onToggle={() => toggle('Filter')}
        anchorRef={setFilterAnchor}
      />
      {open && ready ? (
        <PortalMenu
          anchor={open === 'Image' ? imageAnchor : open === 'Select' ? selectAnchor : filterAnchor}
          placement="below"
          onClose={close}
          label={`${open} menu`}
        >
          {open === 'Image' ? (
            <>
              <MenuAccordionSection
                title="Adjustments"
                icon={<AdjustIcon />}
                open={section === 'adjust'}
                onToggle={() => setSection(section === 'adjust' ? null : 'adjust')}
              >
                {ADJUSTMENT_IDS.map((id) => (
                  <MenuActionRow
                    key={id}
                    plain
                    icon={<AdjustGlyph id={id} />}
                    label={`${adjustmentName(id)}…`}
                    onClick={() => {
                      close();
                      openAdjustment(id);
                    }}
                  />
                ))}
              </MenuAccordionSection>
              <ActionRows menu="Image" photo={photo} close={close} />
            </>
          ) : open === 'Filter' ? (
            <>
              {last ? (
                <>
                  <MenuActionRow
                    plain
                    icon={<ActionGlyph id="repeat-filter" />}
                    label={`Repeat ${FILTERS[last.id]?.name ?? 'Filter'}`}
                    onClick={() => {
                      close();
                      runPhotoAction('repeat-filter', photo);
                    }}
                  />
                  <MenuGroupSeparator />
                </>
              ) : null}
              {CATEGORIES.map((c) => (
                <MenuAccordionSection
                  key={c}
                  title={FILTER_CATEGORY_NAMES[c]}
                  icon={<FilterGlyph category={c} />}
                  open={section === c}
                  onToggle={() => setSection(section === c ? null : c)}
                >
                  {Object.values(FILTERS)
                    .filter((f) => f.category === c)
                    .map((f) => (
                      <MenuActionRow
                        key={f.id}
                        plain
                        icon={<FilterGlyph category={c} />}
                        label={f.params.length ? `${f.name}…` : f.name}
                        onClick={() => {
                          close();
                          photoDialogs.open({ kind: 'filter', id: f.id });
                        }}
                      />
                    ))}
                </MenuAccordionSection>
              ))}
            </>
          ) : (
            <ActionRows menu={open} photo={photo} close={close} />
          )}
        </PortalMenu>
      ) : null}
    </div>
  );
}
