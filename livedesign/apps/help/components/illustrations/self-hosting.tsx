// Self-Hosting-category illustrations (docs/specs/018-help/help-app.md): the stack at a glance, the
// deploy flow, and where optional configuration comes from. Composed only from the shared primitives so the house
// style holds.

import { Scene, Shape, Arrow, Panel, Label } from './primitives';

/** The whole stack at a glance: the static apps and the router sitting in
 *  front of the api Worker, which owns D1 and the Durable Object room. */
export function StackOverview() {
  return (
    <Scene w={420} h={250}>
      {/* The static frontend apps, in a row */}
      <Shape x={48} y={24} w={84} h={36} kind="rect" label="marketing" labelTone="strong" />
      <Shape x={168} y={24} w={84} h={36} kind="rect" label="live" labelTone="strong" />
      <Shape x={288} y={24} w={84} h={36} kind="rect" label="help" labelTone="strong" />

      {/* Router stitches them under one hostname */}
      <Shape x={114} y={100} w={192} h={40} kind="rect" accent label="router" />
      <Arrow from={[90, 60]} to={[160, 100]} tone="muted" head={false} />
      <Arrow from={[210, 60]} to={[210, 100]} tone="muted" head={false} />
      <Arrow from={[330, 60]} to={[260, 100]} tone="muted" head={false} />

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
    ['/help', 'help'],
    ['/new, /explorer', 'live'],
    ['everything else', 'marketing'],
  ];
  return (
    <Scene w={420} h={232}>
      <Shape x={24} y={94} w={96} h={44} kind="rect" accent label="router" />
      {routes.map(([path, app], i) => {
        const y = 32 + i * 44;
        return (
          <g key={i}>
            <Arrow from={[120, 116]} to={[268, y + 18]} kind="elbow" tone="muted" />
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

/** The deploy flow, as three stages left to right: GitHub Actions deploys
 *  marketing, help and api in parallel; live and mcp follow the api; the
 *  router goes last because its bindings need the four path-routed apps to
 *  exist. Elbow connectors only, so no line crosses a box. */
export function DeployFlow() {
  const first = ['marketing', 'help', 'api'];
  const rowY = (i: number) => 44 + i * 38;
  const apiY = rowY(2) + 14;
  return (
    <Scene w={420} h={260}>
      {/* The trigger */}
      <Shape x={8} y={106} w={64} h={40} kind="rect" label="GitHub" labelTone="strong" />
      <Label x={40} y={160} anchor="middle" size={10} tone="muted">
        Actions
      </Label>
      <Arrow from={[72, 126]} to={[92, 126]} />

      {/* Stage 1: in parallel */}
      <Panel x={92} y={14} w={112} h={186} title="IN PARALLEL" />
      {first.map((name, i) => (
        <Shape key={name} x={104} y={rowY(i)} w={88} h={28} kind="rect" accent label={name} />
      ))}

      {/* Stage 2: after the api */}
      <Panel x={222} y={150} w={96} h={96} title="AFTER API" />
      <Shape x={234} y={178} w={72} h={28} kind="rect" accent label="live" />
      <Shape x={234} y={212} w={72} h={28} kind="rect" accent label="mcp" />
      <Arrow from={[192, apiY]} to={[234, 192]} kind="elbow" />
      <Arrow from={[192, apiY]} to={[234, 226]} kind="elbow" />

      {/* Stage 3: the router, once everything it binds to exists */}
      {/* Both earlier stages join one bus, so the router takes a single arrow. */}
      <Panel x={336} y={88} w={76} h={86} title="LAST" />
      <Shape x={346} y={118} w={56} h={40} kind="rect" label="router" labelTone="strong" />
      <Arrow from={[204, 138]} to={[326, 138]} tone="muted" head={false} />
      <Arrow from={[306, 192]} to={[326, 192]} tone="muted" head={false} />
      <Arrow from={[326, 192]} to={[326, 138]} tone="muted" head={false} />
      <Arrow from={[326, 138]} to={[346, 138]} tone="muted" />
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
