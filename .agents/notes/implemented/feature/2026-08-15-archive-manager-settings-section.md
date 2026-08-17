# Agent Note: Archive-manager settings section

Status: implemented

English | [中文](2026-08-15-archive-manager-settings-section.zh.md)

Extends the [session archive (registry-global set)](../feature/2026-07-31-session-archive-global-set.md) decision with the recovery direction and a management surface; the archive decision itself is unchanged.

## Problem

Archiving a session is one-way in the product. `workspace.archiveSession` moves a session id into the registry-global archive set and the session vanishes from every grouping surface, but no surface can view the archived set and no operation can restore a session — the registry's own README described unarchiving as "a future unarchive restores its position". Users who archived a session by accident had no recovery path.

## Decision

**Unarchiving is a first-class registry operation.** `WorkspaceRegistry.unarchiveSession(sessionId)` removes the id from the durable archive set; an id already absent resolves without writing. It deliberately does not validate session existence: the set only ever contains ids that passed `archiveSession`'s existence check, and a vanished id is invisible to grouping surfaces anyway. Because archiving never touches workspace accounting, unarchiving restores the session's exact position with no reattachment. The `domain/changed` listener already streams `host/archived-sessions-changed` on any archive-set write, so the unary RPC echo plus the frame keep every tab in sync with no event changes.

**The wire mirrors `archiveSession`.** `workspace.unarchiveSession` takes `{ sessionId }` and answers the full updated set, registered through the same rpc-map / schema / fetch-transport rows. The client workspaces service (`IWorkspaces.unarchiveSession`) installs the echoed set into the shared snapshot store like its archive twin.

**A new settings section owns the archived view.** `ui-archive-manager` registers `settings.section` id `archives` at order 25 — below the agent-presets page — labeled 归档管理. The section derives its rows from the same framework feeds the sidebar reads (`useSessions` + `useWorkspaces`), grouping archived sessions by workspace exactly like the unarchived tree: workspace registry order, accounting order within a group, a trailing ungrouped bucket, and the browser's own visibility rules (blank placeholders and subagent children excluded). Each row carries an unarchive action that calls the workspaces service; the row leaves on the unary echo and the sidebar picks it up from the same snapshot. The section owns no store and no Host state — its data and action already exist in the runtime.

## Alternatives considered

**Have the section write the domain global directly.** Rejected: the registry caches `WorkspaceDomainState` in memory, so an out-of-band write would leave the registry's next mutation stale and re-archive or clobber the set.

**Expose unarchive only as a model tool.** Rejected: the request was a user-facing management surface, and the row-menu Archive gesture already owns the archive direction; the section deliberately offers only the direction that cannot be reached elsewhere.

**Reuse the workspace browser tree with an "include archived" flag.** Rejected: the browser row carries live-status affordances that make no sense for hidden history, and an additive settings page keeps the archive set visible without disturbing the browsing surface's invariants.

## Consequences

Archived sessions are now recoverable through Settings → 归档管理, and the archive set is visible rather than opaque. The unary RPC and the existing changed frame keep local and remote tabs converging without new event plumbing. The `archives` section order (25) sits below the agent-presets page (20) and above the `better-sidebar` demo row (100); deployments reordering settings pages restate their own order values. The e2e (`apps/web/tests/archive-manager.e2e.ts`) drives the full round trip — adopt a workspace, archive two seeded titled sessions from their row menus, review them grouped under the workspace in the section, unarchive one, verify durability across reload, and unarchive the rest to the empty state — with zero model calls.
