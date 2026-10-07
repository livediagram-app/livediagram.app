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
      <Shape x={18} y={24} w={72} h={36} kind="rect" label="marketing" labelTone="strong" />
      <Shape x={96} y={24} w={72} h={36} kind="rect" label="live" labelTone="strong" />
      <Shape x={174} y={24} w={72} h={36} kind="rect" label="telemetry" labelTone="strong" />
      <Shape x={252} y={24} w={72} h={36} kind="rect" label="help" labelTone="strong" />
      <Shape x={330} y={24} w={72} h={36} kind="rect" label="community" labelTone="strong" />

      {/* Router stitches them under one hostname */}
      <Shape x={114} y={100} w={192} h={40} kind="rect" accent label="router" />
      <Arrow from={[54, 60]} to={[140, 100]} tone="muted" head={false} />
      <Arrow from={[132, 60]} to={[175, 100]} tone="muted" head={false} />
      <Arrow from={[210, 60]} to={[210, 100]} tone="muted" head={false} />
      <Arrow from={[288, 60]} to={[245, 100]} tone="muted" head={false} />
      <Arrow from={[366, 60]} to={[280, 100]} tone="muted" head={false} />

      {/* The api Worker */}
      <Shape x={134} y={176} w={152} h={40} kind="rect" label="api Worker" labelTone="strong" />
      <Arrow from={[210, 140]} to={[210, 176]} />

      {/* Storage the api owns */}
      <Shape x={30} y={172} w={84} h={48} kind="cylinder" label="D1" labelTone="strong" />
      <Shape x={306} y={172} w={88} h={48} kind="hexagon" label="Durable" labelTone="strong" />
      <Arrow from={[134, 196]} to={[114, 196]} tone="muted" />
      <Arrow from={[286, 196]} to={[306, 196]} tone="muted" />

      <Label x={73} y={236} anchor="middle" size={10} tone="muted">
        database
      </Label>
      <Label x={350} y={236} anchor="middle" size={10} tone="muted">
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
    ['/help', 'help'],
    ['/community', 'community'],
    ['/new, /explorer', 'live'],
    ['everything else', 'marketing'],
  ];
  return (
    <Scene w={420} h={308}>
      <Shape x={24} y={138} w={96} h={44} kind="rect" accent label="router" />
      {routes.map(([path, app], i) => {
        const y = 32 + i * 44;
        return (
          <g key={i}>
            <Arrow from={[120, 160]} to={[268, y + 18]} kind="elbow" tone="muted" />
            <rect
              x={268}
              y={y}
              width={128}
              height={36}
              rx={7}
              className="fill-white stroke-brand-300"
              strokeWidth={2}
            />
            <Label x={282} y={y + 13} size={10} tone="muted">
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

/** The deploy flow: GitHub Actions builds, then deploys marketing, telemetry,
 *  help, community and api in parallel; live and the optional mcp follow the
 *  api; the router goes last because its bindings need the six path-routed
 *  apps to exist. */
export function DeployFlow() {
  const first: [string, number][] = [
    ['marketing', 14],
    ['telemetry', 50],
    ['help', 86],
    ['community', 122],
    ['api', 166],
  ];
  return (
    <Scene w={420} h={260}>
      {/* GitHub Actions trigger */}
      <Shape x={10} y={96} w={80} h={48} kind="rect" label="GitHub" labelTone="strong" />
      <Label x={50} y={160} anchor="middle" size={10} tone="muted">
        Actions
      </Label>

      {/* First wave, in parallel */}
      {first.map(([name, y]) => (
        <g key={name}>
          <Shape x={118} y={y} w={88} h={28} kind="rect" accent label={name} />
          <Arrow from={[90, 120]} to={[118, y + 14]} kind="curved" />
        </g>
      ))}
      <Label x={162} y={210} anchor="middle" size={10} tone="muted">
        in parallel
      </Label>

      {/* After the api */}
      <Shape x={228} y={150} w={72} h={28} kind="rect" accent label="live" />
      <Shape x={228} y={196} w={72} h={28} kind="rect" dashed label="mcp" labelTone="strong" />
      <Arrow from={[206, 180]} to={[228, 164]} />
      <Arrow from={[206, 180]} to={[228, 210]} />
      <Label x={264} y={240} anchor="middle" size={10} tone="muted">
        optional
      </Label>

      {/* Router last */}
      <Shape x={326} y={70} w={84} h={48} kind="rect" label="router" labelTone="strong" />
      <Arrow from={[206, 28]} to={[326, 84]} kind="curved" tone="muted" />
      <Arrow from={[206, 64]} to={[326, 90]} tone="muted" />
      <Arrow from={[206, 100]} to={[326, 96]} tone="muted" />
      <Arrow from={[206, 136]} to={[326, 102]} tone="muted" />
      <Arrow from={[300, 164]} to={[350, 118]} kind="curved" tone="muted" />
      <Label x={368} y={134} anchor="middle" size={10} tone="muted">
        last
      </Label>
    </Scene>
  );
}

/** Configuration supplied at runtime: secrets per surface, never in source. */
export function ConfigSources() {
  const rows: [string, string][] = [
    ['Local dev', '.env.local, .dev.vars'],
    ['Secrets', 'wrangler secret put'],
    ['Settings', 'wrangler.toml [vars]'],
    ['Frontends', 'NEXT_PUBLIC_* at build'],
  ];
  return (
    <Scene w={420} h={210}>
      <Panel x={70} y={18} w={280} h={176} title="ENVIRONMENT">
        {rows.map(([surface, source], i) => {
          const y = 62 + i * 34;
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
      <Label x={60} y={86} anchor="middle" size={10} tone="accent">
        yes
      </Label>

      {/* Guest fallback path */}
      <Shape x={258} y={104} w={132} h={40} kind="rect" accent label="Guest path" />
      <Arrow from={[256, 56]} to={[324, 104]} kind="curved" />
      <Label x={360} y={86} anchor="middle" size={10} tone="muted">
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
