import { Label } from '@/components/illustrations/primitives';
import { Card, Chip, Stage } from './parts';

// Privacy and Security: a share link with its safeguards on (a password, an expiry, view-only), guarded by the
// shield that stands for everything the category covers.
export function PrivacyAndSecurityArt() {
  return (
    <Stage>
      {/* The shield. */}
      <g>
        <path
          d="M318 26 l52 18 v44 c0 38 -26 62 -52 76 c-26 -14 -52 -38 -52 -76 v-44 Z"
          className="fill-slate-900/[0.06]"
          transform="translate(2 6)"
        />
        <path
          d="M318 26 l52 18 v44 c0 38 -26 62 -52 76 c-26 -14 -52 -38 -52 -76 v-44 Z"
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={2}
        />
        <path d="M318 40 l40 14 v34 c0 30 -20 50 -40 61 Z" className="fill-brand-400" />
        <path
          d="M298 94 l14 14 28 -30"
          className="fill-none stroke-white help-art-as-drawn"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* The share dialog. */}
      <Card x={22} y={28} w={232} h={168} r={14}>
        <Label x={38} y={50} size={12} weight={700} tone="strong">
          Share link
        </Label>
        <Chip x={182} y={41} label="Can view" tone="brand" w={60} />
        <rect
          x={34}
          y={64}
          width={208}
          height={26}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M44 77 a3.5 3.5 0 0 1 3.5 -3.5 h3 M57 77 a3.5 3.5 0 0 1 -3.5 3.5 h-3 M47 77 h7"
          className="fill-none stroke-brand-500"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Label x={64} y={77.5} size={9.5} weight={500} tone="body">
          livepages.app/s/k7Qp2…
        </Label>

        <Label x={38} y={108} size={9} weight={700} tone="muted">
          PASSWORD
        </Label>
        <rect
          x={34}
          y={116}
          width={208}
          height={26}
          rx={7}
          className="fill-white stroke-brand-400"
          strokeWidth={1.4}
        />
        <rect x={44} y={125} width={10} height={8} rx={1.5} className="fill-brand-500" />
        <path
          d="M46 125 v-2.5 a3 3 0 0 1 6 0 v2.5"
          className="fill-none stroke-brand-500"
          strokeWidth={1.4}
        />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle key={i} cx={66 + i * 10} cy={129} r={3} className="fill-slate-600" />
        ))}

        <Chip x={34} y={158} label="Expires in 7 days" tone="amber" h={22} size={9.5} />
        <Chip x={152} y={158} label="Revoke" tone="rose" h={22} size={9.5} w={58} />
      </Card>

      <Chip x={270} y={180} label="No trackers" tone="emerald" h={22} size={9.5} />
    </Stage>
  );
}
