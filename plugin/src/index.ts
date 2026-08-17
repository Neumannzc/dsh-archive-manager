/**
 * Archive manager plugin, node half. The official npm dsh (`0.1.0-rc.6`)
 * ships archiveSession but NOT unarchiveSession (it was briefly published
 * then rolled back upstream). This half restores the unarchive capability
 * without touching core packages:
 *
 * 1. Patches `WorkspaceRegistry.unarchiveSession` when absent (idempotent:
 *    a future official release that adds the method wins, this patch steps
 *    aside). The implementation mirrors the upstream logic — remove the id
 *    from the registry-global archive set through the registry's own
 *    operation queue, so durability and ordering semantics are identical.
 * 2. Registers one exact HTTP route (`POST /dsh-ui-archive-manager/unarchive`)
 *    on the official `webServer` carrier (the same channel dsh-web-ui's
 *    remote-web-ui uses). The browser half calls it instead of a core RPC
 *    that does not exist. The state change then propagates to every client
 *    through the core `archived-sessions-changed` frame — no extra wiring.
 *
 * The browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
// Type-only: pulls the host-webserver Context merge (ctx.webServer) and the
// WebRoute shape used by the register call below.
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Route path the browser half fetches (page origin, same-host). */
export const UNARCHIVE_ROUTE = '/dsh-ui-archive-manager/unarchive'

/** Services required before this plugin mounts. */
export const inject = ['workspaceRegistry', 'webServer']

/** Registry-global durable state shape (subset this plugin reads/writes). */
interface WorkspaceDomainState {
  archivedSessionIds: string[]
}

/** Registry internals the patch needs; private on the class, plain at runtime. */
type RegistryInternals = {
  enqueueOperation<T>(operation: () => Promise<T>): Promise<T>
  requireState(): WorkspaceDomainState
  setState(state: WorkspaceDomainState): Promise<void>
}

/**
 * Remove one session from the registry-global archive set, restoring its
 * appearance on every grouping surface at its retained accounting slot.
 * An id absent from the set resolves without writing.
 */
async function unarchive(registry: WorkspaceRegistry, sessionId: string): Promise<void> {
  const internals = registry as unknown as RegistryInternals
  await internals.enqueueOperation(async () => {
    const state = internals.requireState()
    if (!state.archivedSessionIds.includes(sessionId)) return
    await internals.setState({
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId),
    })
  })
}

/**
 * Trust fence for the unarchive route, mirroring the connection package's
 * browser-trust semantics (loopback or same-origin; cross-site refused).
 * The dsh web page loads from this same server, so a same-origin browser
 * request is the normal case; a missing Origin is only accepted from a
 * loopback peer.
 * @param req - the node HTTP request.
 * @returns true when the request may reach the unarchive handler.
 */
function isTrustedRequest(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  const origin = req.headers.origin
  if (origin !== undefined) {
    if (typeof host !== 'string') return false
    try {
      return new URL(origin).host === new URL(`http://${host}`).host
    } catch {
      return false
    }
  }
  const address = req.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Read and parse a small JSON request body. */
function readJson(req: IncomingMessage): Promise<{ sessionId?: unknown }> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      if (body.length === 0) { resolve({}); return }
      try { resolve(JSON.parse(body) as { sessionId?: unknown }) } catch { reject(new Error('invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

/**
 * Host plugin body: patch the unarchive capability and expose it to the
 * browser half over the official webServer carrier.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  const registry = ctx.workspaceRegistry as WorkspaceRegistry & { unarchiveSession?: (sessionId: string) => Promise<void> }

  // 1. Unarchive capability. An official release that adds the method keeps
  //    its own implementation; this patch only fills the gap. The effect
  //    disposer removes the patch again when this plugin unloads.
  if (typeof registry.unarchiveSession !== 'function') {
    registry.unarchiveSession = (sessionId: string) => unarchive(registry, sessionId)
    ctx.effect(() => () => { delete registry.unarchiveSession }, 'dsh-ui-archive-manager: unarchive patch')
  }

  // 2. Browser→host channel for the unarchive action.
  const unarchiveSession = (registry.unarchiveSession ?? ((sessionId: string) => unarchive(registry, sessionId)))
    .bind(registry)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: UNARCHIVE_ROUTE,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isTrustedRequest(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end('forbidden')
        return
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain' })
        res.end('method not allowed')
        return
      }
      try {
        const { sessionId } = await readJson(req)
        if (typeof sessionId !== 'string' || sessionId.length === 0) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('missing sessionId')
          return
        }
        await unarchiveSession(sessionId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`unarchive failed: ${String(error)}`)
      }
    },
  }), 'dsh-ui-archive-manager: unarchive route')
}
