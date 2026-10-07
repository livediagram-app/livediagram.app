'use client';

// The Gantt chart's window (docs/specs/026-plan/plan-views.md "Scale", "Scrolling the timeline"): the viewer's
// own scale and start day, never saved or sent. Until the viewer touches it, it follows the cards (the
// smallest scale that fits, from the model's start). A sideways wheel over the timeline and a drag of the axis
// scroll it; the header steps, rescales and goes back to today.
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ganttDayShift,
  ganttFitScale,
  ganttRescaleFrom,
  ganttStepDays,
  ganttTodayFrom,
  ganttWindow,
  type GanttModel,
  type GanttScale,
} from '@livediagram/items';

export function useGanttWindow({
  model,
  trackRef,
  axisRef,
  interactive,
  ready,
}: {
  model: Pick<GanttModel, 'from' | 'to' | 'today'>;
  // The timeline, whose width turns pixels into days, and the axis strip that pans it.
  trackRef: RefObject<HTMLElement | null>;
  axisRef: RefObject<HTMLElement | null>;
  // Only a chart that takes input scrolls; elsewhere the canvas keeps the wheel. `ready` is whether the
  // timeline is drawn (not loading or empty), so its listeners attach once it is.
  interactive: boolean;
  ready: boolean;
}) {
  const [picked, setPicked] = useState<GanttScale | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const scale = picked ?? ganttFitScale(model);
  const from = start ?? model.from;
  const view = ganttWindow(scale, from);

  // The wheel and the pan read the window as it is now, not as it was when they were attached.
  const live = useRef({ scale, from });
  useEffect(() => {
    live.current = { scale, from };
  });

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !interactive) return;
    // Sub-day wheel travel, kept until it adds up to a day.
    let rest = 0;
    const onWheel = (e: WheelEvent) => {
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!sideways && !e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      const px = (sideways ? e.deltaX : e.deltaY) + rest;
      const { scale: s, from: f } = live.current;
      const w = ganttWindow(s, f);
      const days = ganttDayShift(w, px, el.getBoundingClientRect().width);
      const perDay = el.getBoundingClientRect().width / (w.to - w.from + 1);
      rest = px - days * perDay;
      if (days !== 0) setStart(f + days);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [trackRef, interactive, ready]);

  // A pan in flight: its window listeners' remover, so the chart going mid-pan leaves none behind.
  const endPan = useRef<(() => void) | null>(null);
  useEffect(() => () => endPan.current?.(), []);

  useEffect(() => {
    const axis = axisRef.current;
    if (!axis || !interactive) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const { scale: s, from: f } = live.current;
      const w = ganttWindow(s, f);
      const width = trackRef.current?.getBoundingClientRect().width ?? 0;
      const onMove = (ev: PointerEvent) =>
        setStart(f - ganttDayShift(w, ev.clientX - startX, width));
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        endPan.current = null;
      };
      endPan.current?.();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      endPan.current = onUp;
    };
    axis.addEventListener('pointerdown', onDown);
    return () => axis.removeEventListener('pointerdown', onDown);
  }, [axisRef, trackRef, interactive, ready]);

  return {
    scale,
    view,
    setScale: (next: GanttScale) => {
      setStart(ganttRescaleFrom(from, scale, next));
      setPicked(next);
    },
    step: (dir: -1 | 1) => setStart(from + dir * ganttStepDays(scale)),
    today: () => setStart(ganttTodayFrom(scale, model.today)),
    // A date drag or draw begins: the window and scale stay as the viewer sees them, so a change to the
    // chart's dates never moves the timeline under the pointer (plan-views.md "Drags and draws pin the timeline").
    pin: () => {
      setStart(from);
      setPicked(scale);
    },
  };
}
