import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  screen: { getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })) },
  webContents: { fromId: vi.fn() }
}))

import {
  findKeybindingConflicts,
  isKeybindingInterceptedByMainProcess,
  KEYBINDING_DEFINITIONS,
  type KeybindingOverrides
} from '../../shared/keybindings'
import { setupGuestShortcutForwarding } from './browser-guest-shortcut-forwarding'

const CHORD = 'Mod+Alt+Shift+1'

function rendererMessagesForGuestChord(keybindings: KeybindingOverrides): unknown[][] {
  const guestOn = vi.fn()
  const rendererSend = vi.fn()
  setupGuestShortcutForwarding({
    browserTabId: 'tab-1',
    guest: { on: guestOn, off: vi.fn() } as unknown as Electron.WebContents,
    resolveRenderer: () =>
      ({
        send: rendererSend,
        reloadIgnoringCache: () => rendererSend('reloadIgnoringCache')
      }) as unknown as Electron.WebContents,
    resolveWorkspaceId: () => 'workspace-1',
    shouldForwardDictationShortcut: () => true,
    getKeybindings: () => keybindings
  })
  const handler = guestOn.mock.calls.find(([event]) => event === 'before-input-event')?.[1] as (
    event: Electron.Event,
    input: Electron.Input
  ) => void
  const isMac = process.platform === 'darwin'
  handler(
    { preventDefault: vi.fn() } as unknown as Electron.Event,
    {
      type: 'keyDown',
      code: 'Digit1',
      key: '1',
      meta: isMac,
      control: !isMac,
      alt: true,
      shift: true
    } as Electron.Input
  )
  return rendererSend.mock.calls
}

describe('browser guest precedence for main-process shortcuts', () => {
  it('reports a browser binding as conflicting exactly when the guest lets the intercepted action win', () => {
    const guestDispatchedBrowserActions = KEYBINDING_DEFINITIONS.filter(
      (definition) =>
        definition.scope === 'browser' &&
        rendererMessagesForGuestChord({ [definition.id]: [CHORD] }).length > 0
    )
    expect(guestDispatchedBrowserActions.length).toBeGreaterThan(0)

    const mismatches: string[] = []
    for (const browser of guestDispatchedBrowserActions) {
      const alone = rendererMessagesForGuestChord({ [browser.id]: [CHORD] })
      for (const intercepted of KEYBINDING_DEFINITIONS.filter(
        isKeybindingInterceptedByMainProcess
      )) {
        const shared = { [browser.id]: [CHORD], [intercepted.id]: [CHORD] }
        const browserWins =
          JSON.stringify(rendererMessagesForGuestChord(shared)) === JSON.stringify(alone)
        const reported = findKeybindingConflicts(process.platform, shared).length > 0
        if (reported === browserWins) {
          mismatches.push(`${browser.id} vs ${intercepted.id}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})
