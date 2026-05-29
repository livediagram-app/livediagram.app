import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  title: string;
  description: string;
  children: ReactNode;
};

// Custom tooltip with a bold title and a one-line description. Appears above
// the wrapped element on hover/focus. Rendered via portal so it isn't clipped
// by floating panels or transform contexts.
export function Tooltip({ title, description, children }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !wrapRef.current) return;
    // Prefer the first child's rect so wrappers around absolutely-positioned
    // children (e.g. the minimized palette button) still anchor correctly.
    const target = wrapRef.current.firstElementChild ?? wrapRef.current;
    const rect = target.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [visible]);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex"
    >
      {children}
      {visible && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-50 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-900/10"
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, calc(-100% - 8px))',
              }}
            >
              <p className="text-xs font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
