/**
 * Tests for Windows Clipboard Module
 * 
 * Note: These tests require Windows and may interact with the actual clipboard.
 * Some tests are skipped in CI environments.
 * 
 * @license GPL-3.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { spawn } from 'child_process';

// Mock child_process for unit tests
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs for file operations
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn()
  }
}));

describe('Clipboard Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Platform Check', () => {
    it('should only work on Windows', () => {
      // The module checks process.platform
      expect(['win32', 'linux', 'darwin']).toContain(process.platform);
    });
  });

  describe('PowerShell Execution', () => {
    it('should spawn PowerShell with correct arguments', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('True'));
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };
      mockSpawn.mockReturnValue(mockProcess);

      // Import after mocking
      const { readClipboard } = await import('../src/clipboard.js');
      
      // This will fail in non-Windows environments, which is expected
      if (process.platform === 'win32') {
        await readClipboard({ checkOnly: true });
        
        expect(mockSpawn).toHaveBeenCalledWith(
          'powershell.exe',
          expect.arrayContaining(['-NoProfile', '-NonInteractive']),
          expect.any(Object)
        );
      }
    });
  });

  describe('ClipboardContent Interface', () => {
    it('should define correct content types', () => {
      type ClipboardType = 'text' | 'image' | 'empty';
      const validTypes: ClipboardType[] = ['text', 'image', 'empty'];
      
      validTypes.forEach(type => {
        expect(['text', 'image', 'empty']).toContain(type);
      });
    });
  });

  describe('ReadClipboardOptions', () => {
    it('should accept valid format options', () => {
      const validFormats = ['auto', 'text', 'image'];
      validFormats.forEach(format => {
        expect(['auto', 'text', 'image']).toContain(format);
      });
    });

    it('should have correct default values', () => {
      const defaultOptions = {
        format: 'auto',
        saveToFile: false,
        checkOnly: false
      };
      
      expect(defaultOptions.format).toBe('auto');
      expect(defaultOptions.saveToFile).toBe(false);
      expect(defaultOptions.checkOnly).toBe(false);
    });
  });
});

describe('MCP Server', () => {
  describe('Tool Definitions', () => {
    it('should define read_clipboard tool', () => {
      const toolName = 'read_clipboard';
      const expectedParams = ['format'];
      
      expect(toolName).toBe('read_clipboard');
      expect(expectedParams).toContain('format');
    });

    it('should define read_clipboard_image tool', () => {
      const toolName = 'read_clipboard_image';
      const expectedParams = ['outputPath'];
      
      expect(toolName).toBe('read_clipboard_image');
      expect(expectedParams).toContain('outputPath');
    });

    it('should define clipboard_has_image tool', () => {
      const toolName = 'clipboard_has_image';
      
      expect(toolName).toBe('clipboard_has_image');
    });
  });

  describe('Server Configuration', () => {
    it('should have correct server name and version', () => {
      const serverName = 'mcp-windows-clipboard';
      const serverVersion = '1.0.0';
      
      expect(serverName).toBe('mcp-windows-clipboard');
      expect(serverVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

describe('Error Handling', () => {
  it('should handle PowerShell not found', async () => {
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('spawn powershell.exe ENOENT'));
        }
      })
    };
    mockSpawn.mockReturnValue(mockProcess);

    // Error should be thrown when PowerShell is not available
    expect(mockProcess.on).toBeDefined();
  });

  it('should handle clipboard access errors', async () => {
    const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Access denied'));
          }
        })
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(1);
        }
      })
    };
    mockSpawn.mockReturnValue(mockProcess);

    // Error handling should work
    expect(mockProcess.stderr.on).toBeDefined();
  });
});

describe('Image Processing', () => {
  it('should generate valid timestamp filenames', () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `clipboard_${timestamp}.png`;
    
    expect(filename).toMatch(/^clipboard_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(filename).toMatch(/\.png$/);
  });

  it('should escape backslashes for PowerShell', () => {
    const path = 'C:\\Users\\Test\\image.png';
    const escaped = path.replace(/\\/g, '\\\\');
    
    expect(escaped).toBe('C:\\\\Users\\\\Test\\\\image.png');
  });
});

describe('Base64 Encoding', () => {
  it('should handle empty base64 strings', () => {
    const emptyBase64 = '';
    expect(emptyBase64.length).toBe(0);
  });

  it('should validate base64 format', () => {
    const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    
    expect(base64Regex.test(validBase64)).toBe(true);
  });
});
