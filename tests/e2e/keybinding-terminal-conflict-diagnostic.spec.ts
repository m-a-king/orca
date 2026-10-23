import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const CONFLICTING_FILE = `${JSON.stringify(
  { version: 1, keybindings: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] } },
  null,
  2
)}\n`

const shotDir = process.env.ORCA_SHOT_DIR
const shotLabel = process.env.ORCA_SHOT_LABEL ?? 'after'

test.describe('Terminal shortcut conflicting with a chord that fires in terminals', () => {
  test('surfaces the binding as ignored instead of dropping it silently', async ({
    orcaPage,
    electronApp
  }) => {
    await waitForSessionReady(orcaPage)

    const isolatedHome = await electronApp.evaluate(({ app }) => app.getPath('home'))
    mkdirSync(path.join(isolatedHome, '.orca'), { recursive: true })
    writeFileSync(path.join(isolatedHome, '.orca', 'keybindings.json'), CONFLICTING_FILE)

    await orcaPage.evaluate(async () => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      await store.getState().updateSettings({ uiLanguage: 'en' })
      await store.getState().reloadKeybindings()
      store.getState().openSettingsPage()
    })

    const searchInput = orcaPage.getByPlaceholder('Search settings')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('shortcuts')
    await expect(orcaPage.getByRole('heading', { name: 'Shortcuts', exact: true })).toBeVisible()

    const capture = async (name: string): Promise<void> => {
      if (shotDir) {
        await orcaPage.screenshot({ path: path.join(shotDir, `${shotLabel}-${name}.png`) })
      }
    }

    await capture('1-pane')

    const localSearch = orcaPage.getByPlaceholder('Search command or keys')
    await localSearch.fill('split terminal')
    await expect(orcaPage.getByText('Split terminal right', { exact: true })).toBeVisible()
    await capture('2-affected-row')

    await localSearch.clear()
    await expect(orcaPage.getByText('Worktree History Forward', { exact: true })).toHaveCount(1)
    await orcaPage.getByRole('button', { name: /Conflicts/ }).click()
    await expect(orcaPage.getByText('Split terminal right', { exact: true })).toBeVisible()
    await expect(orcaPage.getByText('Worktree History Forward', { exact: true })).toHaveCount(0)
    await capture('3-conflicts-filter')

    await orcaPage.getByRole('button', { name: /^All/ }).click()
    await localSearch.fill('worktree history')
    await expect(orcaPage.getByText('Worktree History Forward', { exact: true })).toBeVisible()
    await expect(
      orcaPage.getByText('was ignored — it conflicts with Split terminal right', { exact: false })
    ).toHaveCount(0)
    await capture('4-other-action-untouched')

    await localSearch.fill('split terminal')
    await expect(orcaPage.getByText('Split terminal right', { exact: true })).toBeVisible()

    await expect(
      orcaPage.getByText('was ignored — it conflicts with Worktree History Forward', {
        exact: false
      })
    ).toBeVisible()
    await expect(
      orcaPage.getByText('Conflicting custom shortcuts were ignored', { exact: false })
    ).toBeVisible()
  })
})
