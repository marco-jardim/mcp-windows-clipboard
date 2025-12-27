#!/usr/bin/env node
/**
 * MCP Windows Clipboard Server
 * 
 * A Model Context Protocol server that provides native Windows clipboard access
 * with full support for images and text content.
 * 
 * @license GPL-3.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { readClipboard, ClipboardContent } from './clipboard.js';

const SERVER_NAME = 'mcp-windows-clipboard';
const SERVER_VERSION = '1.0.0';

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
        }
      ]
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
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
      content: [{ type: 'text', text: content.text! }]
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
 * Main entry point
 */
async function main(): Promise<void> {
  // Check platform
  if (process.platform !== 'win32') {
    console.error('Error: mcp-windows-clipboard only works on Windows');
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
