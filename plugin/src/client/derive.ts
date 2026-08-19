/**
 * Derives the archived-session view from the same snapshots the workspace
 * browser groups by: one group per Workspace in stable Host order, with
 * archived members in their accounting order, plus the ungrouped bucket for
 * archived sessions outside every Workspace. The mirror rule of the browser
 * tree — blank placeholders and subagent children are never top-level rows —
 * keeps the archived view looking like the unarchived one.
 */
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Group key for archived sessions outside every Workspace. */
export const UNGROUPED_KEY = ''

/** One archived session row in a group. */
export interface ArchivedSessionNode {
  id: SessionId
  /** Stored display title; blank rows are excluded, so no placeholder label is needed. */
  title: string
  updatedAt: number
}

/** One archived-session group: the workspace section facts plus its rows. */
export interface ArchivedGroupNode {
  /** Group key: the workspace id or {@link UNGROUPED_KEY}. */
  key: string
  /** Backing Workspace id; absent only for the ungrouped bucket. */
  workspaceId: string | undefined
  /** Display label: the workspace title, or the ungrouped bucket label. */
  label: string
  /** Visible archived session rows. */
  sessions: readonly ArchivedSessionNode[]
}

/** Relative-time bucket for archived session rows. */
export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'

/** Structured relative time: the bucket plus its magnitude (0 for 'now'). */
export interface RelativeTime {
  unit: RelativeTimeUnit
  n: number
}

/**
 * Compact relative time for session rows, matching the sidebar tree pattern
 * (upstream `ui-workspace/tree.ts:relativeTime` — same buckets, same
 * boundaries, same constants).
 * @param updatedAt - epoch ms of the session's last activity.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns the row's trailing time bucket and magnitude.
 */
export function relativeTime(updatedAt: number, now: number): RelativeTime {
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  const diff = Math.max(0, now - updatedAt)
  if (diff < MIN) return { unit: 'now', n: 0 }
  if (diff < HOUR) return { unit: 'minutes', n: Math.floor(diff / MIN) }
  if (diff < DAY) return { unit: 'hours', n: Math.floor(diff / HOUR) }
  if (diff < 30 * DAY) return { unit: 'days', n: Math.floor(diff / DAY) }
  if (diff < 365 * DAY) return { unit: 'months', n: Math.floor(diff / (30 * DAY)) }
  return { unit: 'years', n: Math.floor(diff / (365 * DAY)) }
}

/** Whether one summary is a top-level row in the archived view (blank and subagent rows are not). */
function archivedRowVisible(summary: SessionSummary | undefined): boolean {
  return summary !== undefined
    && summary.origin !== 'subagent'
    && !summary.blank
}

/**
 * Group archived sessions by Host Workspace, mirroring the browser's grouping
 * surface: workspace registry order, members in accounting order, and a
 * trailing ungrouped bucket. Only ids in the archive set appear.
 * @param list - sessions list snapshot (membership lookup).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param ungroupedLabel - localized label for sessions outside every Workspace.
 * @returns groups in render order (the ungrouped bucket last, when non-empty).
 */
export function deriveArchivedGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  ungroupedLabel: string,
): ArchivedGroupNode[] {
  const archived = new Set(archivedSessionIds)
  const groups: ArchivedGroupNode[] = []
  const accounted = new Set<SessionId>()
  for (const workspace of workspaces) {
    const sessions: ArchivedSessionNode[] = []
    for (const id of workspace.sessionIds) {
      if (!archived.has(id)) continue
      const summary = list.byId[id]
      accounted.add(id)
      if (summary === undefined || !archivedRowVisible(summary)) continue
      sessions.push({ id, title: summary.displayTitle, updatedAt: summary.updatedAt })
    }
    if (sessions.length === 0) continue
    groups.push({
      key: String(workspace.workspaceId),
      workspaceId: String(workspace.workspaceId),
      label: workspace.title,
      sessions,
    })
  }
  const stray: ArchivedSessionNode[] = []
  for (const id of list.ids) {
    if (!archived.has(id) || accounted.has(id)) continue
    const summary = list.byId[id]
    if (summary === undefined || !archivedRowVisible(summary)) continue
    stray.push({ id, title: summary.displayTitle, updatedAt: summary.updatedAt })
  }
  if (stray.length > 0) {
    groups.push({ key: UNGROUPED_KEY, workspaceId: undefined, label: ungroupedLabel, sessions: stray })
  }
  return groups
}
