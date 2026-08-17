/** Derivation: archived sessions grouped by workspace, mirroring the browser tree. */

import { describe, expect, it } from 'vitest'
import type { SessionId, SessionListState, SessionSummary, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveArchivedGroups, UNGROUPED_KEY } from '../src/client/derive.ts'

const sid = (id: string): SessionId => id as SessionId

function summary(id: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    blank: false,
    running: false,
    updatedAt: 100,
    ...overrides,
  }
}

function list(rows: SessionSummary[]): SessionListState {
  const ids = rows.map(row => row.id)
  const byId: SessionListState['byId'] = {}
  for (const row of rows) byId[row.id] = row
  return {
    ids, byId, current: undefined, phase: 'ready',
    subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }
}

function workspace(id: string, title: string, sessionIds: SessionId[]): WorkspaceView {
  return {
    workspaceId: id as never, path: `/w/${id}`, title, sessionIds,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('deriveArchivedGroups', () => {
  it('groups archived sessions under their workspace in registry order', () => {
    const rows = [summary('arch-1'), summary('arch-2'), summary('plain')]
    const workspaces = [
      workspace('w1', 'Alpha', [sid('plain'), sid('arch-1')]),
      workspace('w2', 'Beta', [sid('arch-2')]),
    ]
    const groups = deriveArchivedGroups(list(rows), workspaces, [sid('arch-1'), sid('arch-2')], 'Ungrouped')

    expect(groups.map(group => [group.label, group.sessions.map(session => session.id)]))
      .toEqual([
        ['Alpha', ['arch-1']],
        ['Beta', ['arch-2']],
      ])
  })

  it('trails unaccounted archived sessions in the ungrouped bucket with the localized label', () => {
    const rows = [summary('stray-arch')]
    const groups = deriveArchivedGroups(list(rows), [], [sid('stray-arch')], '未分组')

    expect(groups).toEqual([
      { key: UNGROUPED_KEY, workspaceId: undefined, label: '未分组', sessions: [{ id: sid('stray-arch'), title: 'stray-arch', updatedAt: 100 }] },
    ])
  })

  it('excludes blank and subagent sessions, mirroring the browser visibility rule', () => {
    const rows = [
      summary('blank-arch', { blank: true }),
      summary('sub-arch', { origin: 'subagent' }),
      summary('real-arch'),
    ]
    const groups = deriveArchivedGroups(list(rows), [], [sid('blank-arch'), sid('sub-arch'), sid('real-arch')], 'Ungrouped')

    expect(groups).toHaveLength(1)
    expect(groups[0]?.sessions.map(session => session.id)).toEqual(['real-arch'])
  })

  it('omits workspaces with nothing archived and returns no groups for an empty set', () => {
    const rows = [summary('plain')]
    const workspaces = [workspace('w1', 'Alpha', [sid('plain')])]

    expect(deriveArchivedGroups(list(rows), workspaces, [], 'Ungrouped')).toEqual([])
    expect(deriveArchivedGroups(list(rows), workspaces, [sid('ghost')], 'Ungrouped')).toEqual([])
  })
})
