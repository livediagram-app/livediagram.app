// The Sharing scenes for what a pass offers past its role (sharing.tsx): the password switch and the
// gate a visitor meets, lifetimes, the Opens row, and the Embed and Live image menus.

import { Button, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  ActivePass,
  Bin,
  LifetimeControl,
  LinkField,
  Lock,
  menuButtonWidth,
  Pass,
  passMenus,
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
        strokeWidth={2}
      />
      <SectionLabel x={x + 16} y={26}>
        PASSES
      </SectionLabel>
      <ActivePass x={x + 16} y={36} w={w - 32} role="view" password />
      <g transform="translate(0 28)">
        <line x1={x} y1={108} x2={x + w} y2={108} className="stroke-slate-200" strokeWidth={1.5} />
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
          strokeWidth={2}
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

/** What a visitor on a protected share link sees: the full-screen password card. */
export function SharePasswordGate() {
  return (
    <Scene w={420} h={226} bg="plain">
      <rect
        x={70}
        y={10}
        width={280}
        height={206}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <circle cx={210} cy={42} r={18} className="fill-brand-100" />
      <Lock x={203} y={33} className="stroke-brand-600" />
      <Label x={210} y={78} anchor="middle" size={13} weight={700} tone="strong">
        This design is password-protected
      </Label>
      <Label x={210} y={98} anchor="middle" size={10} tone="body">
        Enter the password Aria set to open this design.
      </Label>
      <rect
        x={94}
        y={114}
        width={232}
        height={30}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={106} y={130} size={12} tone="strong">
        ••••••••
      </Label>
      <Label x={210} y={158} anchor="middle" size={10} weight={500} className="fill-rose-500">
        That password didn&apos;t match. Try again.
      </Label>
      <Button x={94} y={174} w={232} h={30} label="Open design" variant="primary" />
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
        strokeWidth={2}
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

/** The Opens dropdown in the composer's fine print, open on the design's tabs. */
export function ShareOpensRow() {
  const x = 14;
  const w = 392;
  return (
    <Scene w={420} h={196} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={180}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <SectionLabel x={x + 16} y={26}>
        ISSUE A PASS
      </SectionLabel>
      <rect x={x + 16} y={36} width={w - 32} height={70} rx={9} className="fill-slate-50" />
      <Label x={x + 26} y={55} size={10} weight={600} tone="body">
        Opens
      </Label>
      <rect
        x={x + 66}
        y={42}
        width={294}
        height={26}
        rx={7}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <Label x={x + 76} y={56} size={11} weight={500} tone="strong">
        Roadmap
      </Label>
      <path
        d={`M${x + 344} ${53} l4 4 l4 -4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
      />
      <Label x={x + 26} y={89} size={10} weight={600} tone="body">
        Valid
      </Label>
      <LifetimeControl x={x + 66} y={76} w={204} active={0} />
      <Button x={x + 278} y={76} w={82} h={26} label="Create Pass" variant="primary" />
      {/* The open dropdown, over the row below. */}
      <rect
        x={x + 66}
        y={72}
        width={206}
        height={92}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {['All tabs', 'Roadmap', 'Pricing', 'Risks'].map((t, i) => (
        <g key={t}>
          {i === 1 ? (
            <rect
              x={x + 70}
              y={76 + i * 21}
              width={198}
              height={21}
              rx={5}
              className="fill-brand-50"
            />
          ) : null}
          <Label
            x={x + 80}
            y={87 + i * 21}
            size={11}
            weight={i === 1 ? 600 : 400}
            tone={i === 1 ? 'accent' : 'body'}
          >
            {t}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

/** A pass's Embed or Live image menu, open: the copy formats it offers (and, for the live image
 *  on a multi-tab design, the Tab picker). */
function ShareCopyMenu({ variant }: { variant: 'embed' | 'image' }) {
  const x = 14;
  const w = 392;
  const image = variant === 'image';
  const items = image
    ? ['Copy image URL', 'Copy Markdown', 'Copy HTML']
    : ['Copy embed URL', 'Copy iframe'];
  const m = passMenus(x + 16, w - 32);
  // The menu opens under its button, right edges aligned, so it stays inside the dialog.
  const menuX = image
    ? m.image + menuButtonWidth('Live image') - 188
    : m.embed + menuButtonWidth('Embed') - 188;
  const menuY = 110;
  const headerH = image ? 32 : 0;
  const menuH = headerH + items.length * 24 + 8;
  return (
    <Scene w={420} h={image ? 232 : 192} bg="plain">
      <rect
        x={x}
        y={8}
        width={w}
        height={image ? 216 : 176}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <ActivePass x={x + 16} y={20} w={w - 32} role="view" open={variant} />
      <rect
        x={menuX}
        y={menuY}
        width={188}
        height={menuH}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {image ? (
        <g>
          <Label x={menuX + 12} y={menuY + 17} size={10} weight={600} tone="muted">
            Tab
          </Label>
          <rect
            x={menuX + 36}
            y={menuY + 6}
            width={140}
            height={22}
            rx={6}
            className="fill-white stroke-slate-200"
            strokeWidth={1.2}
          />
          <Label x={menuX + 44} y={menuY + 18} size={10} tone="strong">
            Overview
          </Label>
          <line
            x1={menuX}
            y1={menuY + headerH}
            x2={menuX + 188}
            y2={menuY + headerH}
            className="stroke-slate-200"
            strokeWidth={1.2}
          />
        </g>
      ) : null}
      {items.map((it, i) => (
        <g key={it}>
          <rect
            x={menuX + 14}
            y={menuY + headerH + 10 + i * 24}
            width={10}
            height={8}
            rx={1.5}
            fill="none"
            className="stroke-slate-400"
            strokeWidth={1.2}
          />
          <Label x={menuX + 32} y={menuY + headerH + 15 + i * 24} size={11} tone="body">
            {it}
          </Label>
        </g>
      ))}
    </Scene>
  );
}

export function ShareEmbedMenu() {
  return <ShareCopyMenu variant="embed" />;
}

export function ShareLiveImageMenu() {
  return <ShareCopyMenu variant="image" />;
}
