import {
  appendWebRow,
  HERO_DEFAULT_CAPTION,
  PAGE_HEADING_MAX,
  withWebRows,
  type Element,
  type HeroCaption,
  type WebRows,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { elementTelemetryType } from '@/lib/element-telemetry';

type WebComponentSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
};

// The web components' writes (spec/146): the rows of a stat row / process /
// header, and a hero image's caption card. Two addressing styles, like the
// checklist's: the canvas edits ONE element by id (an inline edit, the "+" at
// the end of a row), the context menu edits the selection.
export function useWebComponentSetters({ currentSelectionIds, commit }: WebComponentSetterDeps) {
  // Replace the rows of one element, from an inline edit on the canvas.
  // Bounded by withWebRows, so a paste can't outgrow what validate accepts.
  const setWebRows = (elementId: string, rows: WebRows) => {
    commit((els) =>
      els.map((el) => (el.id === elementId && el.type === 'shape' ? withWebRows(el, rows) : el)),
    );
  };

  // The canvas "+": one more row on one element.
  const appendWebRowTo = (elementId: string) => {
    let added: Element | null = null;
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || el.type !== 'shape') return el;
        const next = appendWebRow(el);
        if (next !== el) added = next;
        return next;
      }),
    );
    if (added) track('Element', 'Changed', elementTelemetryType(added));
  };

  // The menu's row editors: the whole array at once, so an add / remove /
  // retitle is one undo step. Each field only lands on its own kind.
  const setWebRowsSelected = (rows: WebRows) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'shape' ? withWebRows(el, rows) : el)),
    );
    track(
      'Element',
      'Changed',
      rows.stats ? 'StatRow' : rows.processSteps ? 'ProcessSteps' : 'Header',
    );
  };

  // A hero caption line, edited in place on the card.
  const setHeroCaptionLine = (elementId: string, field: keyof HeroCaption, value: string) => {
    commit((els) =>
      els.map((el) =>
        el.id === elementId && el.type === 'image' && el.heroCaption
          ? {
              ...el,
              heroCaption: {
                ...el.heroCaption,
                [field]: value.replace(/\s+/g, ' ').trim().slice(0, PAGE_HEADING_MAX),
              },
            }
          : el,
      ),
    );
  };

  // The image menu's Caption Card toggle: any image can become a hero, and a
  // hero can lose its card. Turning it on starts from the default words.
  const setHeroCaptionSelected = (on: boolean) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || el.type !== 'image') return el;
        if (!on) {
          const { heroCaption: _drop, ...rest } = el;
          return rest;
        }
        return el.heroCaption ? el : { ...el, heroCaption: { ...HERO_DEFAULT_CAPTION } };
      }),
    );
    track('Element', 'Changed', 'Hero');
  };

  return {
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
  };
}
