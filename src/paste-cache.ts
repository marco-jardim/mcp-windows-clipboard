/**
 * Paste Cache Module
 * 
 * Simple in-memory cache for storing the last paste event.
 * Used by the autopaste feature to cache clipboard content
 * when Ctrl+V is detected.
 * 
 * @license GPL-3.0
 */

export interface PasteEvent {
  /** Content type */
  type: 'text' | 'image' | 'empty';
  /** Text content or file path for images */
  content: string;
  /** Unix timestamp when paste was captured */
  timestamp: number;
  /** Image format (only for images) */
  format?: 'png';
  /** Size in bytes (for images) or character count (for text) */
  size?: number;
}

/** The cached paste event */
let lastPaste: PasteEvent | null = null;

/**
 * Cache a new paste event, replacing any previous one
 */
export function cacheLastPaste(event: PasteEvent): void {
  lastPaste = {
    ...event,
    timestamp: event.timestamp || Date.now()
  };
}

/**
 * Retrieve the last cached paste event
 * @returns The last paste event or null if none cached
 */
export function getLastPaste(): PasteEvent | null {
  return lastPaste;
}

/**
 * Clear the paste cache
 */
export function clearCache(): void {
  lastPaste = null;
}

/**
 * Check if there's a cached paste
 */
export function hasCachedPaste(): boolean {
  return lastPaste !== null;
}

/**
 * Get human-readable time since last paste
 * @returns String like "5s ago", "2m ago", or null if no paste
 */
export function getTimeSinceLastPaste(): string | null {
  if (!lastPaste) return null;
  
  const elapsed = Date.now() - lastPaste.timestamp;
  const seconds = Math.floor(elapsed / 1000);
  
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
