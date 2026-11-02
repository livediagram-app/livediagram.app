// The selection toolbar's button and divider, shared by SelectionPopover and the per-element button
// groups it hosts (FlowchartStepButtons).
import { HoverCard } from '@livehuddle/ui';
import { TOOLBAR_DIVIDER } from '@/components/chrome/toolbar-surface';

export function Divider() {
  return <div aria-hidden className={TOOLBAR_DIVIDER} />;
}

export function PopoverButton({
  label,
  description,
  onClick,
  children,
  active,
}: {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <HoverCard title={label} description={description}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active ? true : undefined}
        className={
          active
            ? 'flex h-8 w-8 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }
      >
        {children}
      </button>
    </HoverCard>
  );
}
