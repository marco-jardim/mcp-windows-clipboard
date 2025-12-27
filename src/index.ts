#!/usr/bin/env node
/**
 * MCP Windows Clipboard Server
 * 
 * A Model Context Protocol server that provides native Windows clipboard access
 * with full support for images and text content.
 * 
 * Features:
 * - Read text and images from clipboard
 * - Autopaste: Automatically captures clipboard on Ctrl+V
 * - Cache last paste for AI analysis
 * 
 * @license GPL-3.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { readClipboard } from './clipboard.js';
import type { ClipboardContent } from './clipboard.js';
import {
  cacheLastPaste,
  getLastPaste,
  getTimeSinceLastPaste,
  clearCache,
} from './paste-cache.js';
import {
  startPasteMonitor,
  stopPasteMonitor,
  isMonitorRunning,
} from './keyboard-hook.js';

const SERVER_NAME = 'mcp-windows-clipboard';
const SERVER_VERSION = '1.1.0';

/** Whether autopaste is enabled */
let autopastEnabled = true;

/**
 * Handle paste event: read clipboard and cache content
 */
async function handlePasteEvent(): Promise<void> {
  try {
    const content = await readClipboard({ format: 'auto' });
    
    if (content.type === 'empty') {
      return;
    }

    if (content.type === 'text' && content.text) {
      cacheLastPaste({
        type: 'text',
        content: content.text,
        timestamp: Date.now(),
        size: content.text.length,
      });
    } else if (content.type === 'image') {
      // For images, save to file and cache the path
      const imageContent = await readClipboard({ format: 'image', saveToFile: true });
      if (imageContent.filePath) {
        cacheLastPaste({
          type: 'image',
          content: imageContent.filePath,
          timestamp: Date.now(),
          format: 'png',
        });
      }
    }
  } catch (error) {
    // Silently fail - don't interrupt user's paste operation
    console.error('[autopaste] Error caching paste:', error);
  }
}

/**
 * Initialize the paste monitor with graceful degradation
 */
function initializeAutopaste(): void {
  try {
    startPasteMonitor(handlePasteEvent);
    console.error('[autopaste] Paste monitor started successfully');
  } catch (error) {
    // Graceful degradation: autopaste fails but existing tools still work
    autopastEnabled = false;
    console.error('[autopaste] Failed to start paste monitor:', error);
    console.error('[autopaste] Autopaste disabled, but clipboard tools remain functional');
  }
}

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Existing tools
        {
          name: 'read_clipboard',
          description: 'Read the current contents of the Windows clipboard. Returns text content directly, or base64-encoded image data if an image is present. Supports PNG, BMP, and DIB image formats.',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['auto', 'text', 'image'],
                description: 'Force reading as specific format. "auto" (default) detects automatically, "text" forces text, "image" forces image.',
                default: 'auto'
              }
            },
            required: []
          }
        },
        {
          name: 'read_clipboard_image',
          description: 'Read an image from the Windows clipboard and save it to a temporary file. Returns the file path for use with image analysis tools. This is the recommended way to handle clipboard images.',
          inputSchema: {
            type: 'object',
            properties: {
              outputPath: {
                type: 'string',
                description: 'Optional custom output path for the image file. If not provided, saves to a temp directory with timestamp.'
              }
            },
            required: []
          }
        },
        {
          name: 'clipboard_has_image',
          description: 'Check if the Windows clipboard currently contains an image.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        // New autopaste tools
        {
          name: 'get_last_paste',
          description: 'Get the most recently pasted content (captured when user pressed Ctrl+V). Returns text content directly or file path for images. Useful for analyzing what the user just pasted without them having to explicitly request clipboard read.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'autopaste_status',
          description: 'Check if autopaste monitoring is active and get information about the last captured paste.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'clear_paste_cache',
          description: 'Clear the cached paste content. Useful for privacy or to reset state.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // Existing tools
        case 'read_clipboard': {
          const format = (args?.format as string) || 'auto';
          const content = await readClipboard({ format: format as 'auto' | 'text' | 'image' });
          return formatClipboardResult(content);
        }

        case 'read_clipboard_image': {
          const outputPath = args?.outputPath as string | undefined;
          const content = await readClipboard({ format: 'image', saveToFile: true, outputPath });
          return formatClipboardResult(content);
        }

        case 'clipboard_has_image': {
          const content = await readClipboard({ format: 'auto', checkOnly: true });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ hasImage: content.type === 'image' || content.hasImage })
            }]
          };
        }

        // New autopaste tools
        case 'get_last_paste': {
          return handleGetLastPaste();
        }

        case 'autopaste_status': {
          return handleAutopasteStatus();
        }

        case 'clear_paste_cache': {
          clearCache();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Paste cache cleared' })
            }]
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Handle get_last_paste tool
 */
function handleGetLastPaste(): CallToolResult {
  const lastPaste = getLastPaste();
  
  if (!lastPaste) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          hasPaste: false,
          message: 'No paste captured yet. Press Ctrl+V to paste something first.'
        })
      }]
    };
  }

  const timeSince = getTimeSinceLastPaste();

  if (lastPaste.type === 'text') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          hasPaste: true,
          type: 'text',
          content: lastPaste.content,
          characterCount: lastPaste.size,
          capturedAt: timeSince
        })
      }]
    };
  }

  if (lastPaste.type === 'image') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          hasPaste: true,
          type: 'image',
          filePath: lastPaste.content,
          format: lastPaste.format,
          capturedAt: timeSince,
          message: `Image saved to: ${lastPaste.content}`
        })
      }]
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ hasPaste: false, message: 'Unknown paste type' })
    }]
  };
}

/**
 * Handle autopaste_status tool
 */
function handleAutopasteStatus(): CallToolResult {
  const lastPaste = getLastPaste();
  const timeSince = getTimeSinceLastPaste();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        autopastEnabled: autopastEnabled,
        monitorRunning: isMonitorRunning(),
        hasCachedPaste: lastPaste !== null,
        lastPasteType: lastPaste?.type || null,
        lastPasteAt: timeSince
      })
    }]
  };
}

/**
 * Format clipboard content as MCP tool result
 */
function formatClipboardResult(content: ClipboardContent): CallToolResult {
  if (content.type === 'empty') {
    return {
      content: [{ type: 'text', text: 'Clipboard is empty' }]
    };
  }

  if (content.type === 'text') {
    return {
      content: [{ type: 'text', text: content.text ?? '' }]
    };
  }

  if (content.type === 'image') {
    if (content.filePath) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'image',
            filePath: content.filePath,
            format: content.format,
            message: `Image saved to: ${content.filePath}`
          })
        }]
      };
    }

    // Return base64 encoded image
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          type: 'image',
          format: content.format,
          base64: content.base64,
          size: content.base64?.length
        })
      }]
    };
  }

  return {
    content: [{ type: 'text', text: 'Unknown clipboard content type' }]
  };
}

/**
 * Cleanup function for graceful shutdown
 */
function cleanup(): void {
  try {
    stopPasteMonitor();
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check platform
  if (process.platform !== 'win32') {
    console.error('Error: mcp-windows-clipboard only works on Windows');
    process.exit(1);
  }

  // Initialize autopaste monitoring
  initializeAutopaste();

  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    cleanup();
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    cleanup();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  cleanup();
  process.exit(1);
});
