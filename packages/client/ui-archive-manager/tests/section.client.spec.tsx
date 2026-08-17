// @vitest-environment jsdom
/**
 * The 归档管理 section's rendering rules: archived sessions appear grouped by
 * workspace exactly like the unarchived tree, each group collapses and
 * expands from its header row (rows render only while expanded), the empty
 * archive set shows the empty state, and the unarchive button reaches the
 * injected action with the row's session id.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { ArchiveManagerSection } from '../src/client/ArchiveManagerSection.tsx'
import type { ArchiveManagerSectionProps } from '../src/client/ArchiveManagerSection.tsx'
import { en } from '../src/client/locales.ts'
import { createArchiveViewStore } from '../src/client/view-store.ts'

afterEach(cleanup)
beforeEach(() => { localStorage.clear() })

const sid = (id: string): SessionId => id as SessionId

function summary(id: string, title = id): SessionSummary {
  return { id: sid(id), displayTitle: title, blank: false, running: false, updatedAt: 100 }
}

function listState(rows: SessionSummary[]): SessionListState {
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

function workspaceState(items: WorkspaceView[], archivedSessionIds: SessionId[]): WorkspaceListState {
  return {
    items, archivedSessionIds, state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }
}

/**
 * Render the section over fixed session/workspace snapshots with a fresh
 * viewing store.
 * @param sessions - session list rows.
 * @param workspaces - workspace list state.
 * @returns the unarchive spy and the store instance.
 */
function renderSection(
  sessions: SessionSummary[],
  workspaces: WorkspaceListState,
): { unarchive: ReturnType<typeof vi.fn>; store: ReturnType<ReturnType<typeof createArchiveViewStore>['create']> } {
  const sessionsStore = createSnapshotStore<SessionListState>(listState(sessions))
  const workspacesStore = createSnapshotStore<WorkspaceListState>(workspaces)
  const viewStore = createArchiveViewStore().create()
  const unarchive = vi.fn(() => Promise.resolve())
  // The locale seat substitutes {n} placeholders like the real TranslateNS.
  const t = (key: keyof typeof en, params?: Record<string, string | number>): string => {
    let text = en[key]
    if (params !== undefined) {
      for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value))
    }
    return text
  }
  const props = {
    unarchive,
    useSessions: bindSnapshotSelector(sessionsStore),
    useWorkspaces: bindSnapshotSelector(workspacesStore),
    useStore: bindSnapshotSelector(viewStore),
    actions: viewStore.actions,
    t,
  } as unknown as ArchiveManagerSectionProps
  render(<ArchiveManagerSection {...props} />)
  return { unarchive, store: viewStore }
}

/** The collapsible header button of one group, found by its workspace title. */
function groupHead(title: string): HTMLElement {
  const button = screen.getAllByRole('button').find(node => node.textContent?.includes(title))
  if (button === undefined) throw new Error(`no group header for ${title}`)
  return button
}

describe('the archive-manager section', () => {
  it('shows the empty state when nothing is archived', () => {
    renderSection([summary('plain')], workspaceState([workspace('w1', 'Alpha', [sid('plain')])], []))

    expect(screen.getByText('No archived sessions')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unarchive: First' })).toBeNull()
  })

  it('renders collapsed groups by default: header rows only, no session rows', () => {
    renderSection(
      [summary('arch-1', 'First'), summary('arch-2', 'Second')],
      workspaceState(
        [
          workspace('w1', 'Alpha', [sid('arch-1')]),
          workspace('w2', 'Beta', [sid('arch-2')]),
        ],
        [sid('arch-1'), sid('arch-2')],
      ),
    )

    const alphaHead = groupHead('Alpha')
    const betaHead = groupHead('Beta')
    expect(alphaHead.getAttribute('aria-expanded')).toBe('false')
    expect(betaHead.getAttribute('aria-expanded')).toBe('false')
    // Group headers carry the workspace title and the session count.
    expect(alphaHead.textContent).toContain('1 session')
    // Rows stay hidden until their group expands.
    expect(screen.queryByText('First')).toBeNull()
    expect(screen.queryByText('Second')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unarchive: First' })).toBeNull()
  })

  it('expands and collapses a group from its header, showing only its own rows', () => {
    renderSection(
      [summary('arch-1', 'First'), summary('arch-2', 'Second')],
      workspaceState(
        [
          workspace('w1', 'Alpha', [sid('arch-1')]),
          workspace('w2', 'Beta', [sid('arch-2')]),
        ],
        [sid('arch-1'), sid('arch-2')],
      ),
    )

    const alphaHead = groupHead('Alpha')
    act(() => { fireEvent.click(alphaHead) })
    expect(alphaHead.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unarchive: First', hidden: true })).toBeTruthy()
    // The other group stays collapsed.
    expect(screen.queryByText('Second')).toBeNull()

    act(() => { fireEvent.click(groupHead('Alpha')) })
    expect(alphaHead.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('First')).toBeNull()
  })

  it('reaches the injected action with the row session id', async () => {
    const { unarchive } = renderSection(
      [summary('arch-1', 'First')],
      workspaceState([workspace('w1', 'Alpha', [sid('arch-1')])], [sid('arch-1')]),
    )

    act(() => { fireEvent.click(groupHead('Alpha')) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unarchive: First', hidden: true }))
    })
    expect(unarchive).toHaveBeenCalledWith(sid('arch-1'))
  })

  it('trails unaccounted archived sessions under the collapsible ungrouped bucket', () => {
    renderSection(
      [summary('stray', 'Stray')],
      workspaceState([], [sid('stray')]),
    )

    const ungroupedHead = groupHead('Ungrouped')
    expect(ungroupedHead.getAttribute('aria-expanded')).toBe('false')
    act(() => { fireEvent.click(ungroupedHead) })
    expect(screen.getByRole('button', { name: 'Unarchive: Stray', hidden: true })).toBeTruthy()
  })
})
