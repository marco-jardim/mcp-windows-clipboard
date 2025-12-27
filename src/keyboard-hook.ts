/**
 * Keyboard Hook Module
 * 
 * Uses uiohook-napi for non-blocking global keyboard hook.
 * Detects Ctrl+V (paste) without interfering with normal paste operation.
 * 
 * @license GPL-3.0
 */

import { uIOhook, UiohookKey } from 'uiohook-napi';
import type { UiohookKeyboardEvent } from 'uiohook-napi';

/** Callback type for paste detection */
export type PasteCallback = () => Promise<void>;

/** Debounce interval in milliseconds */
const DEBOUNCE_MS = 150;

/** State tracking */
let isRunning = false;
let lastPasteTime = 0;
let pasteCallback: PasteCallback | null = null;

/**
 * Handle keydown events, detecting Ctrl+V
 */
function handleKeyDown(event: UiohookKeyboardEvent): void {
  // Check for Ctrl+V (Windows/Linux) or Cmd+V (macOS)
  const isModifierPressed = process.platform === 'darwin'
    ? event.metaKey
    : event.ctrlKey;

  if (isModifierPressed && event.keycode === UiohookKey.V) {
    const now = Date.now();

    // Debounce to prevent duplicate events
    if (now - lastPasteTime < DEBOUNCE_MS) {
      return;
    }

    lastPasteTime = now;

    // Trigger callback asynchronously (non-blocking)
    if (pasteCallback) {
      pasteCallback().catch((err) => {
        // Log error but don't crash - paste should still work
        console.error('[keyboard-hook] Paste callback error:', err);
      });
    }
  }
}

/**
 * Start the paste monitor
 * @param onPaste Callback to invoke when Ctrl+V is detected
 */
export function startPasteMonitor(onPaste: PasteCallback): void {
  if (isRunning) {
    console.warn('[keyboard-hook] Monitor already running');
    return;
  }

  pasteCallback = onPaste;
  
  // Register event handler
  uIOhook.on('keydown', handleKeyDown);
  
  // Start the hook
  uIOhook.start();
  isRunning = true;
}

/**
 * Stop the paste monitor
 */
export function stopPasteMonitor(): void {
  if (!isRunning) {
    return;
  }

  uIOhook.stop();
  uIOhook.removeAllListeners();
  isRunning = false;
  pasteCallback = null;
}

/**
 * Check if the monitor is currently running
 */
export function isMonitorRunning(): boolean {
  return isRunning;
}

/**
 * Get the timestamp of the last detected paste
 * @returns Unix timestamp or 0 if no paste detected yet
 */
export function getLastPasteTime(): number {
  return lastPasteTime;
}
