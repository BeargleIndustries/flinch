// Root-layout UI state (brief 4.2: Settings, Export, New session and the
// shortcuts overlay are state in the root layout, not routes). The header,
// the rail frame and the screens read and set it.
//
// Mount points for later tasks: T16's NewSessionDialog binds to
// `newSessionOpen`, T20's ExportDialog to `exportOpen`, T33's tour calls
// `onTour` (set by the tour when it mounts).
import { readBool, writeBool } from '$lib/prefs';

class ShellUi {
  /** The probe rail is open (D15: open by default; `flinch:rail_open`). */
  railOpen = $state(readBool('rail_open', true));
  settingsOpen = $state(false);
  /** The drawer was opened since launch (hides the Settings dot, brief 6.1). */
  settingsSeen = $state(false);
  shortcutsOpen = $state(false);
  newSessionOpen = $state(false);
  exportOpen = $state(false);
  /** Starts the tour; T33 sets it. Until then "Take the tour" does nothing. */
  onTour: (() => void) | null = null;

  setRail(open: boolean): void {
    this.railOpen = open;
    writeBool('rail_open', open);
  }

  openSettings(): void {
    this.settingsOpen = true;
    this.settingsSeen = true;
  }

  closeSettings(): void {
    this.settingsOpen = false;
  }

  toggleShortcuts(): void {
    this.shortcutsOpen = !this.shortcutsOpen;
  }

  /** "New session…" in the switcher and in the "No session yet" panel. */
  openNewSession(): void {
    this.newSessionOpen = true;
  }

  openExport(): void {
    this.exportOpen = true;
  }

  startTour(): void {
    this.onTour?.();
  }
}

export const shell = new ShellUi();
