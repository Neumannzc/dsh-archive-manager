/** Bilingual parity: the English dictionary covers exactly the zh key set. */

import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'

describe('archive-manager dictionaries', () => {
  it('keeps the English key set complete against the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('localizes the section identity and the unarchive action', () => {
    expect(zh.nav).toBe('归档管理')
    expect(en.nav).toBe('Archive manager')
    expect(zh.unarchive).toBe('取消归档')
    expect(en.unarchive).toBe('Unarchive')
  })
})
