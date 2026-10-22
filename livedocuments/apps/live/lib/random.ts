// The editor's random-choice helpers, backed by the platform CSPRNG.
//
// Nothing here guards a secret: the callers roll a costume, a display name, a
// presence colour, or the order templates appear in. `Math.random()` would be
// perfectly adequate for all of it — but a weak PRNG feeding a value that later
// looks like personal data (an avatar's gender, a participant's identity) is
// exactly the shape static analysis flags, and arguing with three recurring
// "insecure randomness" alerts costs more than using the strong generator that
// every one of our runtimes already ships. `crypto.getRandomValues` is present
// in browsers, in Workers, and in Node 18+, which covers the app, the static
// export build, and the test runner.
//
// If a genuinely security-sensitive random value ever lands in the editor (a
// token, an invite code), it belongs here too — and now it starts from the
// right primitive rather than from Math.random.

// A uniform float in [0, 1), the `Math.random()` contract. Drawn from a full
// 32-bit sample and divided by 2^32, so every representable step is equally
// likely.
export function randomUnit(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]! / 2 ** 32;
}

// A uniform index into a collection of `length` items, or -1 when it is empty
// (the caller then has nothing to pick, and -1 reads as "no choice" the way an
// out-of-range index would).
export function randomIndex(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return -1;
  return Math.floor(randomUnit() * length);
}

// One item from `options`, or undefined when there is nothing to choose from.
export function randomPick<T>(options: readonly T[]): T | undefined {
  const index = randomIndex(options.length);
  return index === -1 ? undefined : options[index];
}
