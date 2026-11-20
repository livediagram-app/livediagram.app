// The share-link security scenes for liveplanner (privacy-and-security/share-link-security): the Password
// Protection switch with a password saved, and a pass's lifetime with an expired pass waiting under Expired. The
// Share dialog's parts are ./sharing-parts; the gate a visitor meets is ./sharing SharePasswordGate.

import { Button, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  ActivePass,
  Bin,
  LifetimeControl,
  LinkField,
  Lock,
  Pass,
  SectionLabel,
} from './sharing-parts';

/** The Password Protection switch with a password saved: Password Set, Replace and Remove, and
 *  the Password tag it puts on every pass. */
export function SharePasswordSwitch() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={234} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={218}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <SectionLabel x={x + 16} y={26}>
        PASSES
      </SectionLabel>
      <ActivePass x={x + 16} y={36} w={w - 32} role="view" password />
      <g transform="translate(0 28)">
        <line x1={x} y1={108} x2={x + w} y2={108} className="stroke-slate-200" strokeWidth={0.75} />
        {/* The settings-style switch row. */}
        <Label x={x + 16} y={126} size={12} weight={600} tone="strong">
          Password Protection
        </Label>
        <Label x={x + 16} y={143} size={10} tone="muted">
          Everyone opening a pass must enter it first, embeds included.
        </Label>
        <rect x={x + w - 54} y={117} width={36} height={20} rx={10} className="fill-brand-500" />
        <circle cx={x + w - 28} cy={127} r={7.5} className="fill-white help-art-as-drawn" />
        {/* The detail row, hung off a guide rule. */}
        <line
          x1={x + 20}
          y1={158}
          x2={x + 20}
          y2={186}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />
        <Lock x={x + 32} y={166} />
        <Label x={x + 47} y={173} size={11} weight={600} tone="strong">
          Password Set
        </Label>
        <Button x={x + w - 156} y={161} w={66} h={24} label="Replace" />
        <Button x={x + w - 84} y={161} w={66} h={24} label="Remove" />
      </g>
    </Scene>
  );
}

/** Choosing a lifetime, the countdown chip on an expiring pass, and an expired pass with Extend. */
export function ShareLifetimes() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={292} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={276}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect x={x + 16} y={20} width={w - 32} height={36} rx={9} className="fill-slate-50" />
      <Label x={x + 26} y={39} size={10} weight={600} tone="body">
        Valid
      </Label>
      <LifetimeControl x={x + 60} y={25} w={210} active={1} role="view" />
      {/* Create Pass takes the chosen role's colour: violet for a Viewer pass. */}
      <rect
        x={x + 278}
        y={25}
        width={82}
        height={26}
        rx={7}
        className="fill-violet-600 dark:fill-violet-500"
      />
      <Label x={x + 319} y={39} anchor="middle" size={11} weight={600} tone="onAccent">
        Create Pass
      </Label>
      <SectionLabel x={x + 16} y={74}>
        PASSES
      </SectionLabel>
      <ActivePass x={x + 16} y={84} w={w - 32} role="view" left="6d left" />
      <SectionLabel x={x + 16} y={188}>
        EXPIRED
      </SectionLabel>
      <Pass x={x + 16} y={196} w={w - 32} h={78} role="edit" expired>
        {/* The stamp sits beside the struck-through link, then Extend and the bin. */}
        <g transform={`translate(${x + 28} 222) rotate(-3)`}>
          <rect
            width={58}
            height={18}
            rx={3}
            className="fill-none stroke-rose-400"
            strokeWidth={1.8}
          />
          <Label x={29} y={10} anchor="middle" size={10} weight={700} className="fill-rose-500">
            EXPIRED
          </Label>
        </g>
        <LinkField x={x + 92} y={220} w={0} struck />
        <Button x={x + 28} y={246} w={92} h={22} label="Extend 1 week" />
        <Bin x={x + w - 38} y={251} />
      </Pass>
    </Scene>
  );
}
