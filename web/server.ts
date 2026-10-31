// Local server. `bun run dev` bundles index.html on request with hot reload;
// `bun run preview` serves the built dist/ instead. Both serve the JSON data and
// fonts from disk and fall back to index.html so client routes like /player/... load.

import { join, normalize, sep } from 'node:path'
import index from './index.html'

const prod = process.argv.includes('--prod')
const port = Number(process.env.PORT ?? 5173)
const root = join(import.meta.dir, prod ? 'dist' : 'public')

/** File under `root`, or null. Rejects paths that climb out of it. */
async function file(pathname: string) {
  const path = normalize(join(root, decodeURIComponent(pathname)))
  if (!path.startsWith(root + sep)) return null
  const f = Bun.file(path)
  return (await f.exists()) ? f : null
}

const server = prod
  ? Bun.serve({
      port,
      async fetch(req) {
        const { pathname } = new URL(req.url)
        const f = pathname !== '/' && (await file(pathname))
        if (f) return new Response(f)
        // Missing data or font files are real 404s; anything else is a client route.
        if (/^\/(data|fonts)\//.test(pathname)) return new Response('Not found', { status: 404 })
        return new Response(Bun.file(join(root, 'index.html')))
      },
    })
  : Bun.serve({
      port,
      development: { hmr: true, console: true },
      routes: {
        '/data/*': publicFile,
        '/fonts/*': publicFile,
        '/*': index,
      },
    })

console.log(`Statline web on ${server.url}${prod ? ' (dist)' : ''}`)

async function publicFile(req: Request) {
  const f = await file(new URL(req.url).pathname)
  return f ? new Response(f) : new Response('Not found', { status: 404 })
}

