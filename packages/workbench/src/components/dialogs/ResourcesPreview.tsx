'use client';

// The picture over the Resources dialog's list (each product's docs/specs/008-canvas/element-menu-quick-bar.md
// "Resources"): the element as a card on a dotted canvas, wearing a badge for each resource it has, as it does on the
// canvas, with a caption saying how many. Drawn, not rendered from the element: every element reads the same here.
import type { ResourceOption } from '../palette/element-resources';

export function ResourcesPreview({
  elementName,
  options,
}: {
  elementName: string;
  options: readonly ResourceOption[];
}) {
  const on = options.filter((o) => o.on);
  return (
    <div
      aria-hidden
      data-resources-preview=""
      className="relative grid h-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 bg-[radial-gradient(rgb(148_163_184/0.45)_1px,transparent_1.3px)] bg-size-[14px_14px] sm:h-36 dark:bg-slate-800/70 dark:bg-[radial-gradient(rgb(100_116_139/0.45)_1px,transparent_1.3px)]"
    >
      <div className="relative grid h-[4.5rem] w-32 place-items-center rounded-[10px] border-2 border-brand-500 bg-white px-2 text-[13px] font-semibold text-slate-700 shadow-[0_8px_20px_-12px_rgb(15_23_42/0.45)] dark:border-brand-400 dark:bg-slate-900 dark:text-slate-200">
        <span className="truncate">{elementName}</span>
        {on.length ? (
          <span className="absolute -right-2.5 -top-2.5 flex gap-[3px]">
            {on.map((o) => (
              <span
                key={o.key}
                data-preview-badge={o.key}
                className="flex size-[22px] items-center justify-center rounded-[7px] bg-brand-700 text-white shadow-[0_0_0_2px_white] dark:bg-brand-600 dark:shadow-[0_0_0_2px_var(--color-slate-900)] [&_svg]:size-3"
              >
                {o.icon}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <span className="absolute bottom-2 left-3 text-[11.5px] text-slate-500 dark:text-slate-400">
        {on.length
          ? `${on.length} attached, shown as badges on the canvas`
          : 'Nothing attached yet'}
      </span>
    </div>
  );
}
