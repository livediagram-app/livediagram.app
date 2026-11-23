// The constant-time key check is @liveworkspace/api-kit's (timing-safe.ts), where the operator's restore door uses it
// too; this path stays for the index's doors and the Automations engine that import it from here.
export { bearerMatches, timingSafeEqual } from '@liveworkspace/api-kit/timing-safe';
