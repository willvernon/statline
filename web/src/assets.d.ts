// Side-effect stylesheet imports and the HTML import in server.ts.
declare module '*.css'
declare module '*.html' {
  const html: import('bun').HTMLBundle
  export default html
}
