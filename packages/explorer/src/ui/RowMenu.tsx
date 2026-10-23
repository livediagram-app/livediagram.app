import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { EllipsisIcon } from './icons';

const SIZE_CLASS = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-7 w-7',
} as const;

// The ⋯ trigger every row and card carries (liveplanner's EllipsisTriggerButton). `reveal` hides it under a
// fine pointer until the row is hovered or focused; `tuck` is a card header's corner margin.
export const EllipsisTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
    expanded?: boolean;
    size?: keyof typeof SIZE_CLASS;
    reveal?: boolean;
    tuck?: boolean;
    className?: string;
    tabIndex?: number;
  }
>(function EllipsisTriggerButton(
  {
    label,
    onClick,
    onKeyDown,
    expanded,
    size = 'lg',
    reveal = false,
    tuck = false,
    className,
    tabIndex,
  },
  ref,
) {
  const revealClass = reveal
    ? expanded
      ? 'opacity-100'
      : 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100'
    : '';
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={[
        'relative inline-flex shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200',
        SIZE_CLASS[size],
        revealClass,
        tuck ? '-mr-1 -mt-0.5' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <EllipsisIcon />
    </button>
  );
});

// A row's ⋯ menu state: the trigger toggles it, a right-click anywhere on the row opens it at the trigger,
// Down or Up Arrow on the trigger opens it too.
export function useRowMenu({ disabled = false }: { disabled?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const onClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((o) => !o);
  }, []);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      setOpen(true);
    },
    [open],
  );
  const onContextMenu = disabled
    ? undefined
    : (e: MouseEvent) => {
        e.preventDefault();
        setOpen(true);
      };
  return {
    open,
    close,
    triggerRef,
    onContextMenu,
    triggerProps: { ref: triggerRef, onClick, onKeyDown, expanded: open },
  };
}
