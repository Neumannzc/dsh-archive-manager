/**
 * Registration: one settings section (`settings.section` id `archives`),
 * ordered below the agent-presets page, whose nav label follows the locale.
 * The registration defers until the slot it fills has been declared.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-archive-manager/client'
import { ArchiveManagerSection } from '../src/client/ArchiveManagerSection.tsx'

// The service reads its initial locale from the browser; these specs assert
// the shipped Chinese copy, so they state the browser they assume.
const { usePinnedBrowserLanguages } = await import('@deepseek-ai/dsh-client-test-runtime')
usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  // The plugin injects `workspaces`; only the unarchive face is read here.
  const unarchiveCalls: string[] = []
  ctx.provide('workspaces', {
    unarchiveSession: async (sessionId: string) => { unarchiveCalls.push(sessionId) },
  } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, unarchiveCalls }
}

function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('ui-archive-manager apply', () => {
  it('registers the 归档管理 section below agent-presets with a locale-following label', async () => {
    const { ctx, slots } = await bench()
    const disposeRoot = declareRoot(slots)
    try {
      ctx.plugin({ inject, apply })
      await new Promise(resolve => setTimeout(resolve, 0))

      const entries = slots.entries('settings.section')
      const archives = entries.find(entry => entry.options.id === 'archives')
      expect(archives).toBeDefined()
      expect(archives?.options.order).toBe(25)
      expect(resolveSlotLabel(archives?.options.label)).toBe('归档管理')
      expect(archives?.component).toBe(ArchiveManagerSection)
    } finally {
      disposeRoot()
    }
  })

  it('waits for the settings.section declaration and contributes nothing before it', async () => {
    const { ctx, slots } = await bench()
    ctx.plugin({ inject, apply })
    await new Promise(resolve => setTimeout(resolve, 0))
    // No declaration yet: the injection is parked, not registered.
    expect(slots.entries('settings.section')).toEqual([])

    const disposeRoot = declareRoot(slots)
    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(slots.entries('settings.section').map(entry => entry.options.id)).toContain('archives')
    } finally {
      disposeRoot()
    }
  })
})
