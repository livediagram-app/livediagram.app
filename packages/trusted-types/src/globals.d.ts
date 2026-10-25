// The browser's TrustedHTML, which TypeScript's DOM library leaves out. Declared as @types/react declares it (an
// empty interface), so the two merge wherever a page also has React's types.
interface TrustedHTML {}
