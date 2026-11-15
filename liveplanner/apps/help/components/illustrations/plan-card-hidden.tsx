// A card's Hidden tab (docs/specs/026-plan/item-types.md "The Hidden tab"), re-exported from ./plan: an Idea turned
// into a Work Item, its Solution and Effort kept From Idea, each with Copy To Field and Remove. Composed from the
// shared primitives so the house style holds; the labels are the editor's own (HiddenValuesTab).

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
import { STRIPE } from './plan-parts';

/** The card panel on its Hidden tab: the line saying what it holds, the From Idea group, two values. */
export function PlanCardHiddenTabScene() {
  const values = [
    { name: 'Solution', value: 'Map fields by name, then by rule', y: 120 },
    { name: 'Effort', value: 'Medium', y: 178 },
  ];
  return (
    <Scene w={420} h={250} bg="plain">
      <rect
        x={10}
        y={10}
        width={400}
        height={230}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* Header: the card's new type and number. */}
      <rect x={22} y={20} width={4} height={12} rx={1.5} className={STRIPE.task} />
      <Label x={30} y={27} size={11} weight={700} tone="strong">
        Work Item
      </Label>
      <Label x={88} y={27} size={11} tone="muted">
        #12
      </Label>
      <Label x={394} y={27} size={12} anchor="middle" tone="muted">
        ✕
      </Label>
      <Label x={24} y={50} size={14} weight={700} tone="strong">
        Map fields on a type change
      </Label>
      {/* The tab bar: Hidden last, picked, with its count. */}
      <line x1={22} y1={74} x2={398} y2={74} className="stroke-slate-200" strokeWidth={1} />
      <Label x={24} y={67} size={10} weight={500} tone="muted">
        Overview
      </Label>
      <Label x={78} y={67} size={10} weight={500} tone="muted">
        Activity
      </Label>
      <Label x={126} y={67} size={10} weight={600} tone="accent">
        Hidden
      </Label>
      <rect x={163} y={59} width={14} height={11} rx={5.5} className="fill-brand-50" />
      <Label x={170} y={67} size={8} weight={600} anchor="middle" tone="accent">
        2
      </Label>
      <rect x={126} y={73} width={51} height={2} rx={1} className="fill-brand-600" />
      {/* What the tab holds. */}
      <rect x={22} y={82} width={376} height={18} rx={5} className="fill-slate-50" />
      <Label x={30} y={91} size={10} tone="body">
        Values this card keeps from fields its Work Item type doesn’t show.
      </Label>
      {/* The group they came from. */}
      <rect x={24} y={106} width={8} height={8} rx={2} className={STRIPE.idea} />
      <Label x={36} y={110} size={9} weight={700} tone="muted">
        FROM IDEA
      </Label>
      {values.map((v) => (
        <g key={v.name}>
          <rect
            x={22}
            y={v.y}
            width={376}
            height={50}
            rx={8}
            className="fill-white stroke-slate-200"
            strokeWidth={1}
          />
          <Label x={32} y={v.y + 14} size={10} weight={700} tone="strong">
            {v.name}
          </Label>
          {/* Copy To Field and Remove, an Editor's. */}
          <rect
            x={290}
            y={v.y + 6}
            width={78}
            height={16}
            rx={4}
            className="fill-white stroke-slate-300"
            strokeWidth={1}
          />
          <Label x={329} y={v.y + 14} size={9} weight={600} anchor="middle" tone="body">
            Copy To Field
          </Label>
          {/* Remove's bin. */}
          <path
            d={`M379 ${v.y + 9} h10 M382 ${v.y + 9} v-1.5 h4 v1.5 M380.5 ${v.y + 9} l0.8 9 h5.4 l0.8 -9`}
            fill="none"
            className="stroke-slate-400"
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x={32}
            y={v.y + 26}
            width={356}
            height={16}
            rx={4}
            className="fill-slate-50 stroke-slate-200"
            strokeWidth={1}
          />
          <Label x={38} y={v.y + 34} size={10} tone="muted">
            {v.value}
          </Label>
        </g>
      ))}
    </Scene>
  );
}
