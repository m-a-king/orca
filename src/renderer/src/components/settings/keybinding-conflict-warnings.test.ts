import { describe, expect, it } from 'vitest'
import type { KeybindingFileSnapshot, KeybindingOverrides } from '../../../../shared/keybindings'
import { buildKeybindingConflictWarnings } from './keybinding-conflict-warnings'

function snapshotWith(options: {
  common?: KeybindingOverrides
  darwin?: KeybindingOverrides
  active?: KeybindingOverrides
}): KeybindingFileSnapshot {
  return {
    path: '/tmp/keybindings.json',
    platform: 'darwin',
    exists: true,
    overrides: options.active ?? {},
    commonOverrides: options.common ?? {},
    platformOverrides: { darwin: options.darwin ?? {}, linux: {}, win32: {} },
    diagnostics: []
  }
}

describe('buildKeybindingConflictWarnings', () => {
  it('reports a binding the loader dropped from the active map', () => {
    const warnings = buildKeybindingConflictWarnings(
      snapshotWith({ common: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] }, active: {} }),
      'darwin',
      []
    )

    expect(warnings.get('terminal.splitRight')).toEqual([
      '⌘⌥→ was ignored — it conflicts with Worktree History Forward.'
    ])
  })

  it('leaves the other claimant alone when only the custom binding is dropped', () => {
    const warnings = buildKeybindingConflictWarnings(
      snapshotWith({ common: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] } }),
      'darwin',
      []
    )

    expect([...warnings.keys()]).toEqual(['terminal.splitRight'])
  })

  it('explains an override the loader dropped only after restoring a default onto its chord', () => {
    const warnings = buildKeybindingConflictWarnings(
      snapshotWith({
        common: {
          'terminal.splitRight': ['Mod+Alt+ArrowRight'],
          'terminal.splitDown': ['Mod+D']
        },
        active: {}
      }),
      'darwin',
      []
    )

    expect(warnings.get('terminal.splitDown')).toEqual([
      '⌘D was ignored — it conflicts with Split terminal right.'
    ])
  })

  it('prefers the platform layer over the common layer', () => {
    const warnings = buildKeybindingConflictWarnings(
      snapshotWith({
        common: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] },
        darwin: { 'terminal.splitRight': ['Mod+Shift+F19'] }
      }),
      'darwin',
      []
    )

    expect(warnings.size).toBe(0)
  })

  it('stays empty for a file with no conflicting bindings', () => {
    expect(
      buildKeybindingConflictWarnings(
        snapshotWith({ common: { 'terminal.splitRight': ['Mod+Shift+F19'] } }),
        'darwin',
        []
      ).size
    ).toBe(0)
    expect(buildKeybindingConflictWarnings(null, 'darwin', []).size).toBe(0)
  })

  it('honors ignored actions', () => {
    expect(
      buildKeybindingConflictWarnings(
        snapshotWith({ common: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] } }),
        'darwin',
        ['terminal.splitRight']
      ).size
    ).toBe(0)
  })

  it('stays silent for an override the loader kept in the active map', () => {
    const warnings = buildKeybindingConflictWarnings(
      snapshotWith({
        common: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] },
        active: { 'terminal.splitRight': ['Mod+Alt+ArrowRight'] }
      }),
      'darwin',
      []
    )

    expect(warnings.size).toBe(0)
  })
})
