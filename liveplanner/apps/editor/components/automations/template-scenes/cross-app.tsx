'use client';

// The starter templates' scenes for steps in other apps: a card finished here writing a page in a knowledgebase.
// Part of TemplateScene.tsx (docs/specs/026-plan/automations.md "Steps in other apps").

import {
  at,
  Card,
  CheckGlyph,
  Column,
  Pill,
  type ToneClasses,
} from '@liveworkspace/automations-ui/scene-parts';

export function ReleaseNote({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Done" className="w-[40%] flex-none">
        <Card>
          <span className="absolute right-1 top-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
            <CheckGlyph aria-hidden />
          </span>
        </Card>
        <Card ghost wide="w-3/5" />
      </Column>
      <div
        className="ats-t ats-in relative flex h-[58px] w-[48px] shrink-0 flex-col gap-[4px] rounded-md bg-white p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800"
        style={at('none', 'translateY(10px) scale(0.8)', 160)}
      >
        <span className={`h-[4px] w-2/3 rounded-full ${tone.solid}`} />
        <span className="h-[3px] w-full rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="h-[3px] w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <Pill
          className="ats-t ats-in ats-pop -bottom-1.5 -right-2 bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
          style={at('none', 'scale(0.4)', 440)}
        >
          Release
        </Pill>
      </div>
    </>
  );
}
