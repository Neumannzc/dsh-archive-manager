/**
 * The archive-manager section's viewing store: per-group expanded state,
 * persisted across settings remounts and reloads like the workspace browser's
 * expansion records. Module level exports the factory only (a module-level
 * handle would pin the store identity across plugin reloads); register()
 * receives the factory and the section derives its PropsStore share from the
 * return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Archive-manager viewing state persisted across surface remounts and reloads. */
type ArchiveViewState = {
  /** Explicit expanded state keyed by group key; absent = collapsed. */
  groupExpansion: Record<string, boolean>
}

/** Annotation twin of the actions literal below (the export needs a declared return type). */
type ArchiveViewActions = {
  setGroupExpanded: (draft: ArchiveViewState, key: string, expanded: boolean) => void
  retainGroupKeys: (draft: ArchiveViewState, keys: readonly string[]) => void
}

/**
 * Create the archive-manager viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createArchiveViewStore(): EngineStoreHandle<ArchiveViewState, ArchiveViewActions> {
  return defineStore({
    init: (): ArchiveViewState => ({ groupExpansion: {} }),
    persist: 'dsh.archiveManager.expanded.v1',
    actions: {
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainGroupKeys: (d, keys: readonly string[]) => {
        const retained = new Set(keys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
      },
    },
  })
}
