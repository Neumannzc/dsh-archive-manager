/**
 * Pure-function tests for `deriveArchivedGroups`. The derivation mirrors
 * upstream `ui-workspace/tree.ts:deriveGroups` minus everything the archived
 * view doesn't render: blank sessions and subagent children are excluded,
 * grouped workspaces preserve Host order, and a trailing ungrouped bucket
 * catches stray archived sessions outside every workspace.
 */
import { describe, expect, it } from 'vitest'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { deriveArchivedGroups, UNGROUPED_KEY } from '../src/client/derive.ts'

const sid = (id: string): SessionId => id as SessionId

/** Minimal SessionSummary with the fields the derivation reads. */
const summary = (id: string, updatedAt: number, partial: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id),
  displayTitle: id,
  running: false,
  blank: false,
  updatedAt,
  ...partial,
})

/** Minimal SessionListState with the fields the derivation reads. */
const list = (...items: SessionSummary[]): SessionListState => ({
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  current: undefined,
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
})

/** Minimal WorkspaceView with the fields the derivation reads. */
const workspace = (id: string, sessionIds: readonly string[], title = id): WorkspaceView => ({
  workspaceId: sid(id) as unknown as WorkspaceView['workspaceId'],
  path: `/projects/${id}`,
  title,
  sessionIds: sessionIds.map(sid),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const NO_ARCHIVE: readonly SessionId[] = []
const archive = (...ids: readonly string[]): readonly SessionId[] => ids.map(sid)

describe('deriveArchivedGroups', () => {
  it('returns no groups when the archive set is empty', () => {
    const sessions = list(summary('one', 1), summary('two', 2))
    const workspaces = [workspace('first', ['one', 'two'])]
    const groups = deriveArchivedGroups(sessions, workspaces, NO_ARCHIVE, 'Ungrouped')
    expect(groups).toEqual([])
  })

  it('groups archived sessions by workspace in stable Host order', () => {
    const sessions = list(summary('a', 1), summary('b', 2), summary('c', 3))
    const workspaces = [workspace('first', ['a']), workspace('second', ['b', 'c'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('a', 'b', 'c'), 'Ungrouped')
    expect(groups.map(g => g.key)).toEqual(['first', 'second'])
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('a')])
    expect(groups[1]!.sessions.map(s => s.id)).toEqual([sid('b'), sid('c')])
  })

  it('preserves the workspace sessionIds accounting order, not recency', () => {
    const sessions = list(summary('newer', 20), summary('older', 10))
    const workspaces = [workspace('first', ['older', 'newer'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('older', 'newer'), 'Ungrouped')
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('older'), sid('newer')])
  })

  it('drops workspaces with no archived members but keeps the order', () => {
    const sessions = list(summary('kept', 1), summary('open', 2))
    const workspaces = [workspace('first', ['kept']), workspace('second', ['open'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('kept'), 'Ungrouped')
    expect(groups.map(g => g.key)).toEqual(['first'])
  })

  it('places archived sessions outside every workspace in the trailing ungrouped bucket', () => {
    const sessions = list(summary('owned', 1), summary('loose', 2))
    const workspaces = [workspace('first', ['owned'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('owned', 'loose'), 'Ungrouped')
    expect(groups.map(g => g.key)).toEqual(['first', UNGROUPED_KEY])
    expect(groups[1]!.workspaceId).toBeUndefined()
    expect(groups[1]!.label).toBe('Ungrouped')
    expect(groups[1]!.sessions.map(s => s.id)).toEqual([sid('loose')])
  })

  it('omits the ungrouped bucket when no stray archived sessions exist', () => {
    const sessions = list(summary('owned', 1))
    const workspaces = [workspace('first', ['owned'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('owned'), 'Ungrouped')
    expect(groups.map(g => g.key)).toEqual(['first'])
    expect(groups.find(g => g.key === UNGROUPED_KEY)).toBeUndefined()
  })

  it('excludes subagent children from archived rows', () => {
    const subagent = summary('child', 1, { origin: 'subagent' })
    const real = summary('real', 2)
    const sessions = list(real, subagent)
    const workspaces = [workspace('first', ['real', 'child'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('real', 'child'), 'Ungrouped')
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('real')])
  })

  it('excludes blank placeholder rows even when their id is in the archive set', () => {
    const blank = summary('blank', 1, { blank: true })
    const real = summary('real', 2)
    const sessions = list(real, blank)
    const workspaces = [workspace('first', ['real', 'blank'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('real', 'blank'), 'Ungrouped')
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('real')])
  })

  it('ignores archived ids whose summary is missing from the list snapshot', () => {
    const real = summary('real', 1)
    const sessions = { ...list(real), byId: { [real.id]: real } }
    const workspaces = [workspace('first', ['real', 'ghost'])]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('real', 'ghost'), 'Ungrouped')
    expect(groups[0]!.sessions.map(s => s.id)).toEqual([sid('real')])
  })

  it('labels a workspace group by its title, not its id', () => {
    const sessions = list(summary('a', 1))
    const workspaces = [workspace('first', ['a'], 'Project Phoenix')]
    const groups = deriveArchivedGroups(sessions, workspaces, archive('a'), 'Ungrouped')
    expect(groups[0]!.label).toBe('Project Phoenix')
    expect(groups[0]!.workspaceId).toBe('first')
    expect(groups[0]!.key).toBe('first')
  })
})