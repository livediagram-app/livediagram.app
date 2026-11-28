import type { BoxedElement, ShapeElement } from '@livehuddle/document';
import {
  AspectLockMenuIcon,
  SizeMenuIcon,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { Switch } from '@livehuddle/ui';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The multi-selection menu's Size section: the aspect-ratio lock for the boxed members and, for shapes, Reset Aspect
// Ratio, reading off the first member and writing selection-wide. Arrange (front / back, opacity) and Rotation left
// livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Element looks, layers, opacity and rotation").
export function MultiPlacementSections({
  props,
  boxedSel,
  morphable,
  sectionProps,
  onClose,
}: {
  props: EditorContextMenuProps;
  boxedSel: BoxedElement[];
  morphable: ShapeElement[];
  sectionProps: Scaffold['sectionProps'];
  onClose: () => void;
}) {
  if (!boxedSel.length) return null;
  return (
    <MenuAccordionSection title="Size" icon={<SizeMenuIcon />} {...sectionProps('m-size')}>
      <button
        type="button"
        onClick={props.onToggleAspectLock}
        aria-pressed={!!boxedSel[0]!.aspectLocked}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span className="flex items-center gap-2">
          <span className="text-slate-400 dark:text-slate-400">
            <AspectLockMenuIcon />
          </span>
          Lock Aspect Ratio
        </span>
        <Switch presentational size="sm" checked={!!boxedSel[0]!.aspectLocked} />
      </button>
      {/* The shapes' Reset Aspect Ratio, which the Shape section held while the diagram shapes could be morphed
          between (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5). */}
      {morphable.length ? (
        <div className="px-2 pb-1.5 pt-0.5">
          <MenuActionButton
            label="Reset Aspect Ratio"
            onClick={() => {
              props.onResetAspectRatio();
              onClose();
            }}
          />
        </div>
      ) : null}
    </MenuAccordionSection>
  );
}
