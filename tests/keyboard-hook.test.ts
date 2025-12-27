/**
 * Tests for Keyboard Hook Module
 * 
 * Note: These tests mock uiohook-napi since actual keyboard hooks
 * require elevated permissions and interactive testing.
 * 
 * @license GPL-3.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock uiohook-napi before importing the module
type EventCallback = (data: unknown) => void;

vi.mock('uiohook-napi', () => {
  const mockListeners: Map<string, EventCallback[]> = new Map();
  
  return {
    uIOhook: {
      on: vi.fn((event: string, callback: EventCallback) => {
        if (!mockListeners.has(event)) {
          mockListeners.set(event, []);
        }
        const listeners = mockListeners.get(event);
        if (listeners) {
          listeners.push(callback);
        }
      }),
      start: vi.fn(),
      stop: vi.fn(),
      removeAllListeners: vi.fn(() => {
        mockListeners.clear();
      }),
      // Expose for testing
      _emit: (event: string, data: unknown) => {
        const listeners = mockListeners.get(event) || [];
        for (const cb of listeners) {
          cb(data);
        }
      },
      _getListeners: () => mockListeners,
    },
    UiohookKey: {
      V: 47, // V key code
      C: 46, // C key code
      Escape: 1,
    },
  };
});

describe('Keyboard Hook Module', () => {
  let keyboardHook: typeof import('../src/keyboard-hook.js');
  let mockUiohook: typeof import('uiohook-napi');

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset module state by re-importing
    vi.resetModules();
    keyboardHook = await import('../src/keyboard-hook.js');
    mockUiohook = await import('uiohook-napi');
  });

  afterEach(() => {
    // Clean up any running monitor
    if (keyboardHook.isMonitorRunning()) {
      keyboardHook.stopPasteMonitor();
    }
  });

  describe('startPasteMonitor', () => {
    it('should start the monitor and register keydown listener', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      
      keyboardHook.startPasteMonitor(callback);
      
      expect(mockUiohook.uIOhook.on).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockUiohook.uIOhook.start).toHaveBeenCalled();
      expect(keyboardHook.isMonitorRunning()).toBe(true);
    });

    it('should warn if monitor is already running', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const callback = vi.fn().mockResolvedValue(undefined);
      
      keyboardHook.startPasteMonitor(callback);
      keyboardHook.startPasteMonitor(callback); // Second call
      
      expect(consoleSpy).toHaveBeenCalledWith('[keyboard-hook] Monitor already running');
      consoleSpy.mockRestore();
    });
  });

  describe('stopPasteMonitor', () => {
    it('should stop the monitor', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      
      keyboardHook.startPasteMonitor(callback);
      keyboardHook.stopPasteMonitor();
      
      expect(mockUiohook.uIOhook.stop).toHaveBeenCalled();
      expect(mockUiohook.uIOhook.removeAllListeners).toHaveBeenCalled();
      expect(keyboardHook.isMonitorRunning()).toBe(false);
    });

    it('should be safe to call when not running', () => {
      expect(() => keyboardHook.stopPasteMonitor()).not.toThrow();
    });
  });

  describe('isMonitorRunning', () => {
    it('should return false initially', () => {
      expect(keyboardHook.isMonitorRunning()).toBe(false);
    });

    it('should return true after starting', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      
      expect(keyboardHook.isMonitorRunning()).toBe(true);
    });

    it('should return false after stopping', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      keyboardHook.stopPasteMonitor();
      
      expect(keyboardHook.isMonitorRunning()).toBe(false);
    });
  });

  describe('getLastPasteTime', () => {
    it('should return 0 initially', () => {
      expect(keyboardHook.getLastPasteTime()).toBe(0);
    });
  });

  describe('Ctrl+V Detection', () => {
    it('should detect Ctrl+V keypress on Windows/Linux', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      
      // Get the registered handler
      const onCall = (mockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      // Simulate Ctrl+V
      handler({
        keycode: 47, // V
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      });
      
      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should NOT trigger callback for V without Ctrl', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      
      const onCall = (mockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      // Simulate just V (no Ctrl)
      handler({
        keycode: 47,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT trigger callback for Ctrl+C', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      
      const onCall = (mockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      // Simulate Ctrl+C
      handler({
        keycode: 46, // C
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should debounce rapid Ctrl+V presses', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      keyboardHook.startPasteMonitor(callback);
      
      const onCall = (mockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      const ctrlVEvent = {
        keycode: 47,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      };
      
      // Rapid fire Ctrl+V
      handler(ctrlVEvent);
      handler(ctrlVEvent);
      handler(ctrlVEvent);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should only trigger once due to debouncing
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn().mockRejectedValue(new Error('Test error'));
      
      keyboardHook.startPasteMonitor(callback);
      
      const onCall = (mockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      handler({
        keycode: 47,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[keyboard-hook] Paste callback error:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('macOS Support', () => {
    it('should detect Cmd+V on macOS', async () => {
      // Temporarily mock platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      // Re-import to get fresh module with new platform
      vi.resetModules();
      const macKeyboardHook = await import('../src/keyboard-hook.js');
      const macMockUiohook = await import('uiohook-napi');
      
      const callback = vi.fn().mockResolvedValue(undefined);
      macKeyboardHook.startPasteMonitor(callback);
      
      const onCall = (macMockUiohook.uIOhook.on as ReturnType<typeof vi.fn>).mock.calls[0];
      const handler = onCall[1];
      
      // Simulate Cmd+V (metaKey on macOS)
      handler({
        keycode: 47,
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalled();
      
      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      macKeyboardHook.stopPasteMonitor();
    });
  });
});
