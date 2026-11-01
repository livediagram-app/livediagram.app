// The fixtures read as text in tests (Vite's `?raw` import), as this package has no Node types.
declare module '*?raw' {
  const text: string;
  export default text;
}
