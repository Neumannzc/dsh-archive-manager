/**
 * Archive-manager plugin, browser half: one settings section (`settings.section`
 * id `archives`, ordered after the agent-presets page) listing archived
 * sessions grouped by workspace, each row with an unarchive action. The
 * section reads the framework's global useSessions/useWorkspaces feeds, so no
 * store or Host RPC beyond the workspaces service is needed. Export
 * discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ArchiveManagerSection } from './ArchiveManagerSection.tsx'
import type { ArchiveManagerSectionInjected } from './ArchiveManagerSection.tsx'
import { en, zh, type ArchiveManagerKey } from './locales.ts'
import { createArchiveViewStore } from './view-store.ts'

export type { ArchiveManagerSectionInjected, ArchiveManagerSectionProps } from './ArchiveManagerSection.tsx'
export type { ArchiveManagerKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 归档管理 settings section copy. */
    settingsArchiveManager: ArchiveManagerKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settingsArchiveManager'

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; the registration depends on it through `slots.inject()`.
 */
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Register the dictionaries and the settings section once the slot
 * declaration is on the ledger. The nav label is a thunk the owner resolves
 * per render, so localized text follows the active locale without
 * re-registering.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-archive-manager: dictionaries')

  const injected = (): ArchiveManagerSectionInjected => ({
    unarchive: async (sessionId) => { await ctx.workspaces.unarchiveSession(sessionId) },
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'archives',
    // Below the agent-presets page (order 20): archiving is a session-lifecycle
    // housekeeping act, not a shaping preference.
    order: 25,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    store: createArchiveViewStore(),
    inject: injected,
  }, ArchiveManagerSection))
}
