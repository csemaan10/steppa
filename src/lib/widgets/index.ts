// The widgets' entry points for the rest of the app: save what changed, then redraw them.

import { clearWidgetState, saveWidgetState, type WidgetState } from '@/lib/widgets/data';
import { refreshWidgets } from '@/lib/widgets/publish';

export { refreshWidgets };

export function updateWidgets(patch: Partial<WidgetState>): void {
  saveWidgetState(patch);
  refreshWidgets();
}

/** Signed out: the widgets ask you to open Steppa again. */
export function resetWidgets(): void {
  clearWidgetState();
  refreshWidgets();
}
