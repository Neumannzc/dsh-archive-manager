// Web e2e scenarios: the 归档管理 archive-manager settings section — two
// titled sessions in a real workspace, archived from the sidebar row menus,
// reviewed grouped by workspace in the settings section, unarchived from
// there, and the archive set verified durable across reload. Zero model
// calls: the two sessions are seeded through the shipped JSONL persistence
// (header cwd = the workspace directory, so the real registry groups them
// there), and archive/unarchive are host RPCs with no model involvement.
//
// The test workspace defaults to a scaffold-owned directory so the spec stays
// hermetic; set DSH_E2E_ARCHIVE_WORKSPACE to an existing directory to run the
// same flow against a fixed path (the harness registers it through the real
// UI, so any empty directory works).
import { mkdir, realpath } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Browser, Locator, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  acknowledgeReloadConnectionLoss, launchWebScaffold, watchConsole, type WebScaffold,
} from './scaffold.ts'
import { saveFailureShot, ZH_BROWSER_LOCALE } from './support.ts'

const ARCHIVE_WORKSPACE = process.env.DSH_E2E_ARCHIVE_WORKSPACE
const SESSION_A = SessionId('archive-manager-session-a')
const SESSION_B = SessionId('archive-manager-session-b')

describe('web e2e: archive manager (archive → 归档管理 review → unarchive)', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let workspacePath: string
  let workspaceTitle: string

  /** Seed one titled, non-blank LIVE session whose header cwd is the workspace. */
  async function seedTitledSession(id: SessionId, title: string): Promise<void> {
    const session = scaffold.ctx.sessions.create(id, { meta: { cwd: workspacePath } })
    const rpcId = RpcId(`rpc-${id}`)
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: `prompt ${id}` }],
      source: { kind: 'user', rpcId },
    }), { surfaceOp: 'append' })
    // The real rename service appends the title event through the live log,
    // so the host's live projection fold serves it on list rows.
    scaffold.ctx.sessionTitle.rename(session, title)
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await scaffold.ctx.sessions.flush(session)
  }

  /** Adopt the test workspace directory through the real add-workspace dialog. */
  async function adoptWorkspace(path: string): Promise<void> {
    await page.getByRole('button', { name: '添加工作区' }).click()
    const dialog = page.getByRole('dialog', { name: '选择工作区目录' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '编辑路径' }).click()
    await dialog.getByLabel('编辑路径').fill(path)
    await dialog.getByLabel('编辑路径').press('Enter')
    await dialog.getByRole('button', { name: '打开', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
    await expect.poll(
      () => scaffold.ctx.workspaceRegistry.resolveByPath(path),
      { timeout: 10_000 },
    ).not.toBeUndefined()
  }

  /** Reveal and click a row action, re-hovering if the row is replaced. */
  async function clickHoverAction(row: Locator, name: string): Promise<void> {
    const button = row.getByRole('button', { name })
    await expect.poll(async () => {
      await row.hover()
      return await button.isVisible()
    }, { timeout: 10_000 }).toBe(true)
    await button.click()
  }

  /** Archive one session row through its row menu (no confirmation dialog). */
  async function archiveSessionRow(row: Locator, title: string): Promise<void> {
    await clickHoverAction(row, `会话“${title}”的操作`)
    await page.getByRole('menuitem', { name: '归档会话' }).click()
    await expect.poll(() => page.getByText(title, { exact: true }).count(), { timeout: 10_000 }).toBe(0)
  }

  /** The workspace group header row in the sidebar. */
  function groupRow(): Locator {
    return page.locator('[role="treeitem"]').filter({ hasText: workspaceTitle }).first()
  }

  /** The sidebar group's session-row container. */
  function groupSection(): Locator {
    return groupRow().locator('xpath=ancestor::*[contains(@class, "groupSection")][1]')
  }

  /** Expand the workspace group so its session rows render. */
  async function expandGroup(): Promise<void> {
    const row = groupRow()
    await expect.poll(async () => {
      if (await row.getAttribute('aria-expanded') !== 'true') {
        await row.click()
        await page.waitForTimeout(50)
      }
      return await row.getAttribute('aria-expanded')
    }, { timeout: 10_000 }).toBe('true')
  }

  /** Open the settings dialog and switch to the 归档管理 section. */
  async function openArchiveManager(): Promise<void> {
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '归档管理' }).click()
    await expect.poll(
      () => dialog.getByRole('button', { name: '归档管理' }).getAttribute('aria-current'),
      { timeout: 5_000 },
    ).toBe('true')
    await dialog.getByRole('heading', { name: '归档管理', exact: true }).waitFor({ timeout: 10_000 })
  }

  /**
   * Expand the archive section's workspace group from its collapsible header
   * row (groups start collapsed, like the sidebar's).
   * @param dialog - the open settings dialog.
   */
  async function expandArchiveGroup(dialog: Locator): Promise<void> {
    const head = dialog.locator('[data-archive-group] button[aria-expanded]').first()
    await head.waitFor({ timeout: 10_000 })
    await expect.poll(async () => {
      if (await head.getAttribute('aria-expanded') !== 'true') {
        await head.click()
        await page.waitForTimeout(50)
      }
      return await head.getAttribute('aria-expanded')
    }, { timeout: 10_000 }).toBe('true')
  }

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    const candidate = ARCHIVE_WORKSPACE ?? join(scaffold.workspaceCwd, 'archive-e2e')
    await mkdir(candidate, { recursive: true })
    workspacePath = await realpath(candidate)
    workspaceTitle = basename(workspacePath)
    // Seed BEFORE the browser loads: the client's session.list baseline then
    // carries both sessions, exactly like a pre-existing history would.
    await seedTitledSession(SESSION_A, '归档会话 A')
    await seedTitledSession(SESSION_B, '归档会话 B')
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('adopts the workspace, accounts the seeded sessions, and archives both from their row menus', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-archive-create-archive'))
    await adoptWorkspace(workspacePath)
    const workspace = await scaffold.ctx.workspaceRegistry.resolveByPath(workspacePath)
    if (workspace === undefined) throw new Error('test workspace disappeared from the registry')
    await workspace.attachSession(SESSION_A)
    await workspace.attachSession(SESSION_B)

    // Both titled sessions render as ordinary rows under the group.
    await expandGroup()
    const group = groupSection()
    const rowA = group.locator('[role="treeitem"]').filter({ hasText: '归档会话 A' }).first()
    await rowA.waitFor({ timeout: 10_000 })
    const rowB = group.locator('[role="treeitem"]').filter({ hasText: '归档会话 B' }).first()
    await rowB.waitFor({ timeout: 10_000 })

    // Archive A, then B; each row disappears on the archive-set echo.
    await archiveSessionRow(rowA, '归档会话 A')
    await expandGroup()
    const rowBAfter = group.locator('[role="treeitem"]').filter({ hasText: '归档会话 B' }).first()
    await rowBAfter.waitFor({ timeout: 10_000 })
    await archiveSessionRow(rowBAfter, '归档会话 B')

    // Durable on the host: the registry-global set carries exactly the two
    // seeded ids in archive order; the workspace account keeps them.
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toEqual([SESSION_A, SESSION_B])
    expect(workspace.sessionIds).toEqual(expect.arrayContaining([SESSION_A, SESSION_B]))
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it('lists the archived sessions in 归档管理 grouped by the workspace', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-archive-review'))
    await openArchiveManager()
    const dialog = page.getByRole('dialog', { name: '设置' })
    // Groups start collapsed like the sidebar's: the header row carries the
    // workspace title and its session count, rows stay hidden until expanded.
    const head = dialog.locator('[data-archive-group] button[aria-expanded]').first()
    await head.waitFor({ timeout: 10_000 })
    expect(await head.getAttribute('aria-expanded')).toBe('false')
    expect(await head.textContent()).toContain('2 个会话')
    await expandArchiveGroup(dialog)
    // Both archived rows render under the workspace group with an unarchive
    // action each.
    await expect.poll(() => dialog.getByText('归档会话 A', { exact: true }).count(), { timeout: 10_000 }).toBe(1)
    expect(await dialog.getByText('归档会话 B', { exact: true }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: '取消归档：归档会话 A' }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: '取消归档：归档会话 B' }).count()).toBe(1)
    // The ungrouped bucket is absent: every archived session is accounted.
    expect(await dialog.getByText('未分组', { exact: true }).count()).toBe(0)
    await page.keyboard.press('Escape')
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('unarchives one session from the section: the row leaves and the sidebar shows it again', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-archive-unarchive'))
    await openArchiveManager()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await expandArchiveGroup(dialog)
    await dialog.getByRole('button', { name: '取消归档：归档会话 A' }).click()
    // The row leaves on the unary echo; the remaining row stays.
    await expect.poll(
      () => dialog.getByRole('button', { name: '取消归档：归档会话 A' }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    expect(await dialog.getByRole('button', { name: '取消归档：归档会话 B' }).count()).toBe(1)
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toEqual([SESSION_B])
    await page.keyboard.press('Escape')

    // The unarchived session is visible in the sidebar group again.
    await expandGroup()
    await expect.poll(
      () => groupSection().locator('[role="treeitem"]').filter({ hasText: '归档会话 A' }).count(),
      { timeout: 10_000 },
    ).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps the archive set durable across reload and unarchives the rest to the empty state', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-archive-reload'))
    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    // After reload the section still shows exactly the one archived session
    // (the expanded state itself survives via the persisted viewing store).
    await openArchiveManager()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await expandArchiveGroup(dialog)
    expect(await dialog.getByRole('button', { name: '取消归档：归档会话 B' }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: '取消归档：归档会话 A' }).count()).toBe(0)
    await dialog.getByRole('button', { name: '取消归档：归档会话 B' }).click()
    await expect.poll(() => dialog.getByText('暂无归档会话', { exact: true }).count(), { timeout: 10_000 })
      .toBe(1)
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toEqual([])
    await page.keyboard.press('Escape')

    // Both sessions are ordinary sidebar rows again.
    await expandGroup()
    await expect.poll(
      () => groupSection().locator('[role="treeitem"]').count(),
      { timeout: 10_000 },
    ).toBeGreaterThanOrEqual(2)
    expect(await page.getByText('归档会话 A', { exact: true }).count()).toBeGreaterThanOrEqual(1)
    expect(await page.getByText('归档会话 B', { exact: true }).count()).toBeGreaterThanOrEqual(1)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 90_000)
})
