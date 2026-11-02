// A label whose control keeps one width whatever it says: every wording sits
// in the same grid cell, all but the current one invisible and hidden from
// assistive tech, so the cell is always as wide as the longest wording and
// nothing beside it reflows when the wording changes.
export function StableLabel({
  options,
  current,
  itemClassName = '',
  block = false,
}: {
  // Every wording the control can show.
  options: readonly string[];
  current: string;
  // Classes for each wording (a button's text run utility, say).
  itemClassName?: string;
  // A block of text (a paragraph) rather than an inline label: as tall as
  // its tallest wording.
  block?: boolean;
}) {
  const all = options.includes(current) ? options : [...options, current];
  return (
    <span className={block ? 'grid' : 'inline-grid'}>
      {all.map((option) => {
        const shown = option === current;
        return (
          <span
            key={option}
            data-stable-option
            aria-hidden={shown ? undefined : true}
            className={`[grid-area:1/1] ${shown ? '' : 'invisible'} ${itemClassName}`.trim()}
          >
            {option}
          </span>
        );
      })}
    </span>
  );
}
