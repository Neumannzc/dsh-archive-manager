// @vitest-environment jsdom
/** The viewing store: per-group expansion persisted to localStorage, stale keys retained away. */

import { beforeEach, describe, expect, it } from 'vitest'
import { createArchiveViewStore } from '../src/client/view-store.ts'

const KEY = 'dsh.archiveManager.expanded.v1'

beforeEach(() => { localStorage.clear() })

describe('createArchiveViewStore', () => {
  it('toggles per-group expansion and persists the record', () => {
    const store = createArchiveViewStore().create()

    expect(store.getSnapshot().groupExpansion).toEqual({})
    store.actions.setGroupExpanded('w1', true)
    expect(store.getSnapshot().groupExpansion).toEqual({ w1: true })
    store.actions.setGroupExpanded('w1', false)
    expect(store.getSnapshot().groupExpansion).toEqual({ w1: false })
    store.actions.setGroupExpanded('w2', true)
    expect(store.getSnapshot().groupExpansion).toEqual({ w1: false, w2: true })
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ groupExpansion: { w1: false, w2: true } })
  })

  it('restores persisted expansion on a fresh instance', () => {
    localStorage.setItem(KEY, JSON.stringify({ groupExpansion: { w1: true } }))
    const store = createArchiveViewStore().create()

    expect(store.getSnapshot().groupExpansion).toEqual({ w1: true })
  })

  it('retains only the keys of groups that still exist', () => {
    const store = createArchiveViewStore().create()
    store.actions.setGroupExpanded('w1', true)
    store.actions.setGroupExpanded('w2', true)

    store.actions.retainGroupKeys(['w2'])
    expect(store.getSnapshot().groupExpansion).toEqual({ w2: true })
    store.actions.retainGroupKeys([])
    expect(store.getSnapshot().groupExpansion).toEqual({})
  })
})
