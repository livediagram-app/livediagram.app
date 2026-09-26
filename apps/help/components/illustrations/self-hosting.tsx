// Self-Hosting-category illustrations (docs/specs/018-help/help-app.md): the stack at a glance, the
// deploy flow, and how optional configuration (Clerk auth) degrades to a
// pure-guest fallback. Composed only from the shared primitives so the house
// style holds.

import { Scene, Shape, Arrow, Panel, Label, TextBar } from './primitives';

/** The whole stack at a glance: the static apps and the router sitting in
 *  front of the api Worker, which owns D1 and the Durable Object room. */
export function StackOverview() {
  return (
    <Scene w={420} h={250}>
      {/* The static frontend apps, in a row */}
      <Shape x={20} y={24} w={84} h={36} kind="rect" label="marketing" labelTone="strong" />
      <Shape x={114} y={24} w={84} h={36} kind="rect" label="live" labelTone="strong" />
      <Shape x={208} y={24} w={84} h={36} kind="rect" label="telemetry" labelTone="strong" />
      <Shape x={302} y={24} w={84} h={36} kind="rect" label="help" labelTone="strong" />

      {/* Router stitches them under one hostname */}
      <Shape x={114} y={100} w={192} h={40} kind="rect" accent label="router" />
      <Arrow from={[62, 60]} to={[150, 100]} tone="muted" head={false} />
      <Arrow from={[156, 60]} to={[180, 100]} tone="muted" head={false} />
      <Arrow from={[250, 60]} to={[240, 100]} tone="muted" head={false} />
      <Arrow from={[344, 60]} to={[272, 100]} tone="muted" head={false} />

      {/* The api Worker */}
      <Shape x={134} y={176} w={152} h={40} kind="rect" label="api Worker" labelTone="strong" />
      <Arrow from={[210, 140]} to={[210, 176]} />

      {/* Storage the api owns */}
      <Shape x={30} y={172} w={84} h={48} kind="cylinder" label="D1" labelTone="strong" />
      <Shape x={306} y={172} w={88} h={48} kind="hexagon" label="Durable" labelTone="strong" />
      <Arrow from={[134, 196]} to={[114, 196]} tone="muted" />
      <Arrow from={[286, 196]} to={[306, 196]} tone="muted" />

      <Label x={73} y={236} anchor="middle" size={9} tone="muted">
        database
      </Label>
      <Label x={350} y={236} anchor="middle" size={9} tone="muted">
        realtime room
      </Label>
    </Scene>
  );
}

/** How the router forwards a request by URL path to the right app. */
export function RequestRouting() {
  const routes: [string, string][] = [
    ['/api/*', 'api'],
    ['/telemetry', 'telemetry'],
    ['/new, /explorer', 'live'],
    ['everything else', 'marketing'],
  ];
  return (
    <Scene w={420} h={220}>
      <Shape x={24} y={88} w={96} h={44} kind="rect" accent label="router" />
      {routes.map(([path, app], i) => {
        const y = 32 + i * 44;
        return (
          <g key={i}>
            <Arrow from={[120, 110]} to={[268, y + 18]} kind="elbow" tone="muted" />
            <rect
              x={268}
              y={y}
              width={128}
              height={36}
              rx={7}
              className="fill-white stroke-brand-300"
              strokeWidth={2}
            />
            <Label x={282} y={y + 13} size={9} tone="muted">
              {path}
            </Label>
            <Label x={282} y={y + 26} size={11} weight={600} tone="strong">
              {app}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** The deploy flow: GitHub Actions builds, then deploys the four apps in
 *  parallel, with the router last because its bindings depend on them. */
export function DeployFlow() {
  return (
    <Scene w={420} h={250}>
      {/* GitHub Actions trigger */}
      <Shape x={20} y={100} w={92} h={48} kind="rect" label="GitHub" labelTone="strong" />
      <Label x={66} y={138} anchor="middle" size={9} tone="muted">
        Actions
      </Label>

      {/* Parallel app deploys */}
      <Shape x={172} y={20} w={92} h={32} kind="rect" accent label="marketing" />
      <Shape x={172} y={64} w={92} h={32} kind="rect" accent label="live" />
      <Shape x={172} y={108} w={92} h={32} kind="rect" accent label="telemetry" />
      <Shape x={172} y={152} w={92} h={32} kind="rect" accent label="api" />

      <Arrow from={[112, 118]} to={[172, 36]} kind="curved" />
      <Arrow from={[112, 120]} to={[172, 80]} kind="curved" />
      <Arrow from={[112, 124]} to={[172, 124]} />
      <Arrow from={[112, 128]} to={[172, 168]} kind="elbow" />

      <Label x={218} y={206} anchor="middle" size={9} tone="muted">
        deploy in parallel
      </Label>

      {/* Router last */}
      <Shape x={312} y={86} w={92} h={48} kind="rect" label="router" labelTone="strong" />
      <Arrow from={[264, 36]} to={[312, 100]} kind="curved" tone="muted" />
      <Arrow from={[264, 80]} to={[312, 104]} tone="muted" />
      <Arrow from={[264, 124]} to={[312, 112]} tone="muted" />
      <Arrow from={[264, 168]} to={[312, 122]} kind="curved" tone="muted" />
      <Label x={358} y={148} anchor="middle" size={9} tone="muted">
        last
      </Label>
    </Scene>
  );
}

/** Configuration supplied at runtime: secrets per surface, never in source. */
export function ConfigSources() {
  const rows: [string, string][] = [
    ['Local dev', '.env.local (gitignored)'],
    ['Workers', 'wrangler secret put'],
    ['Frontends', 'NEXT_PUBLIC_* only'],
  ];
  return (
    <Scene w={420} h={210}>
      <Panel x={70} y={24} w={280} h={162} title="ENVIRONMENT">
        {rows.map(([surface, source], i) => {
          const y = 64 + i * 38;
          return (
            <g key={i}>
              <Label x={90} y={y} size={11} weight={600} tone="strong">
                {surface}
              </Label>
              <rect
                x={172}
                y={y - 11}
                width={160}
                height={22}
                rx={6}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth={1.5}
              />
              <Label x={182} y={y} size={10} tone="muted">
                {source}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** Optional Clerk auth with a guest-only fallback: a config switch picks the
 *  identity path, but the editor works either way. */
export function GuestFallback() {
  return (
    <Scene w={420} h={244}>
      {/* The config toggle */}
      <Shape x={148} y={20} w={124} h={40} kind="diamond" label="Clerk set?" labelTone="strong" />

      {/* Configured path */}
      <Shape x={28} y={104} w={132} h={40} kind="rect" label="Signed-in" labelTone="strong" />
      <Arrow from={[164, 56]} to={[94, 104]} kind="curved" />
      <Label x={60} y={86} anchor="middle" size={9} tone="accent">
        yes
      </Label>

      {/* Guest fallback path */}
      <Shape x={258} y={104} w={132} h={40} kind="rect" accent label="Guest path" />
      <Arrow from={[256, 56]} to={[324, 104]} kind="curved" />
      <Label x={360} y={86} anchor="middle" size={9} tone="muted">
        unset
      </Label>

      {/* Both lead to a working editor */}
      <Shape
        x={120}
        y={176}
        w={180}
        h={40}
        kind="stadium"
        label="Editor works"
        labelTone="strong"
      />
      <Arrow from={[94, 144]} to={[170, 176]} kind="curved" tone="muted" />
      <Arrow from={[324, 144]} to={[250, 176]} kind="curved" tone="muted" />
      <TextBar x={140} y={226} w={140} tone="faint" />
    </Scene>
  );
}
