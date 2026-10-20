import {
  findKeybindingConflicts,
  formatKeybindingList,
  getKeybindingDefinition,
  isKeybindingActionId,
  type KeybindingActionId,
  type KeybindingConflict,
  type KeybindingFileSnapshot
} from '../../../../shared/keybindings'
import { getFileBindingOverrides, hasOwnBindingOverride } from './keybinding-override-edits'

// Why: judges the file's bindings because the loader strips conflicting overrides before they reach the active map.
export function buildKeybindingConflictWarnings(
  snapshot: KeybindingFileSnapshot | null,
  platform: NodeJS.Platform,
  ignoredActionIds: readonly KeybindingActionId[]
): Map<KeybindingActionId, string[]> {
  const warnings = new Map<KeybindingActionId, string[]>()
  const fileOverrides = getFileBindingOverrides(snapshot, platform)
  const activeOverrides = snapshot?.overrides ?? {}
  const droppedByLoader = (actionId: KeybindingActionId): boolean =>
    hasOwnBindingOverride(fileOverrides, actionId) &&
    !hasOwnBindingOverride(activeOverrides, actionId)
  const warn = (actionId: KeybindingActionId, conflict: KeybindingConflict): void => {
    const others = conflict.actionIds
      .filter((id) => id !== actionId)
      .map((id) => getKeybindingDefinition(id)?.title ?? id)
      .join(', ')
    warnings.set(actionId, [
      ...(warnings.get(actionId) ?? []),
      `${formatKeybindingList([conflict.binding], platform)} was ignored — it conflicts with ${others}.`
    ])
  }

  for (const conflict of findKeybindingConflicts(platform, fileOverrides, { ignoredActionIds })) {
    for (const actionId of conflict.actionIds) {
      if (droppedByLoader(actionId)) {
        warn(actionId, conflict)
      }
    }
  }
  // Why: the loader repeats its pass, so an override can be dropped only because an earlier drop restored a default onto its chord.
  for (const actionId of Object.keys(fileOverrides)) {
    if (!isKeybindingActionId(actionId) || warnings.has(actionId) || !droppedByLoader(actionId)) {
      continue
    }
    const keptPlusThisOne = { ...activeOverrides, [actionId]: fileOverrides[actionId] }
    for (const conflict of findKeybindingConflicts(platform, keptPlusThisOne, {
      ignoredActionIds
    })) {
      if (conflict.actionIds.includes(actionId)) {
        warn(actionId, conflict)
      }
    }
  }
  return warnings
}
