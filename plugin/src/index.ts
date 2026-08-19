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
 * Maximum bytes accepted on the unarchive route. The body carries only
 * `{sessionId: string}`; 8 KiB is well above any plausible id and bounds the
 * memory the bridge buffers per request, mirroring the upstream
 * `client-connection` `DEFAULT_MAX_REQUEST_BODY_BYTES` defense but sized for
 * this single small JSON envelope.
 */
const MAX_REQUEST_BODY_BYTES = 8 * 1024

/**
 * Trusted hosts accepted on the unarchive route besides loopback. Empty by
 * default — deployments serving over LAN literals (e.g. `192.168.x.x`) must
 * add the bound authority here. The list follows the upstream
 * `isTrustedApiRequest(req, trustedHosts)` contract: an entry with an explicit
 * `:port` matches that exact authority, a port-less entry matches the
 * hostname on any port.
 */
const TRUSTED_HOSTS: readonly string[] = []

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseHost(authority: string): URL | undefined {
  try { return new URL(`http://${authority}`) } catch { return undefined }
}

/**
 * Loopback classification mirroring upstream `isLoopbackHostname`:
 * `localhost`, IPv6 loopback, and every IPv4 address in 127/8. Hostnames are
 * WHATWG-normalized (lowercased), so `LOCALHOST` and bracketed IPv6 literals
 * `[::1]` match.
 */
function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether a Host authority matches a `trustedHosts` entry (port-less matches any port). */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseHost(entry)
    if (entryUrl === undefined) return false
    return entryUrl.port === ''
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Trust fence for the unarchive route, mirroring `client-connection`'s
 * `isTrustedApiRequest`. Two confused-deputy paths a browser opens against a
 * local HTTP API must be closed: DNS rebinding (the rebound page carries the
 * attacker's domain in `Host` even though the socket lands on this server)
 * and cross-site requests fired from a malicious page.
 *
 * Order matters: the `Host` fence runs first against every request (no
 * marker shortcut — a browser read over plain HTTP arrives with neither
 * `Origin` nor `Fetch-Metadata`, indistinguishable from curl, and its
 * response is still readable by the rebound page). `sec-fetch-site: cross-site`
 * is refused outright; an attached `Origin` must equal the Host authority;
 * the literal `null` (sandboxed iframes, file: pages) is an opaque origin
 * and also refused; absence of `Origin` is fine because the Host fence above
 * already bound the request.
 *
 * The dsh web page loads from this same server, so a same-origin browser
 * request is the normal case; a missing `Origin` is only accepted from a
 * loopback or trusted peer.
 * @param req - the node HTTP request.
 * @returns true when the request may reach the unarchive handler.
 */
function isTrustedRequest(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (host === undefined) return false
  const hostUrl = parseHost(Array.isArray(host) ? host[0]! : host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, TRUSTED_HOSTS)) return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    const originHost = new URL(origin).host
    return originHost === hostUrl.host && originHost !== ''
  } catch {
    return false
  }
}

/**
 * Read and parse a small JSON request body, capping the bytes buffered at
 * {@link MAX_REQUEST_BODY_BYTES}. Two-layer size defense matches the upstream
 * `bridge()`: the `Content-Length` header is checked first (cheap rejection
 * for a client that announces an oversized body), then the actual stream is
 * summed as it arrives so a missing or lying header still cannot exhaust
 * memory. On overflow the socket is destroyed (matches upstream's
 * `req.destroy()` + `connection: close`).
 */
function readJson(req: IncomingMessage): Promise<{ sessionId?: unknown }> {
  return new Promise((resolve, reject) => {
    const declared = req.headers['content-length']
    if (declared !== undefined && Number(declared) > MAX_REQUEST_BODY_BYTES) {
      reject(new Error('payload too large'))
      req.destroy()
      return
    }
    let received = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      received += chunk.byteLength
      if (received > MAX_REQUEST_BODY_BYTES) {
        req.removeAllListeners('data')
        req.removeAllListeners('end')
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (received === 0) { resolve({}); return }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { sessionId?: unknown }) }
      catch { reject(new Error('invalid JSON body')) }
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
        const message = error instanceof Error ? error.message : String(error)
        // readJson rejects with 'payload too large' when the body exceeds the
        // bridge cap; surface that as 413 (RFC 7231 §6.5.11), not 500.
        if (message === 'payload too large') {
          res.writeHead(413, { 'Content-Type': 'text/plain', connection: 'close' })
          res.end('payload too large')
          return
        }
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`unarchive failed: ${message}`)
      }
    },
  }), 'dsh-ui-archive-manager: unarchive route')
}
