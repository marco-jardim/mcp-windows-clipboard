# mcp-windows-clipboard

> Native Windows clipboard access for AI coding assistants via Model Context Protocol

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows-blue)](https://www.microsoft.com/windows)

## Problem Solved

**Clipboard image pasting doesn't work** in many AI coding assistants on Windows. This MCP server provides a reliable bridge to access Windows clipboard content (including images) from Claude Code, OpenCode, Cursor, and other MCP-compatible tools.

## Features

- **Image Support** - Read PNG, BMP, and DIB images from clipboard
- **Text Support** - Read text content from clipboard
- **Auto-Detection** - Automatically detects content type
- **Autopaste** - Automatically captures clipboard content when you press Ctrl+V
- **AI Analysis Ready** - Cached pastes ready for AI to analyze on demand
- **File Output** - Save images directly to files for use with other tools
- **Base64 Output** - Get image data as base64 for inline use
- **Non-Blocking** - Autopaste monitoring doesn't interfere with normal paste operations

## Quick Start

### Installation

```bash
npm install -g mcp-windows-clipboard
```

Or install from source:

```bash
git clone https://github.com/marco-jardim/mcp-windows-clipboard.git
cd mcp-windows-clipboard
npm install
npm run build
```

### Configuration

Add to your MCP client configuration:

#### OpenCode (`~/.config/opencode/opencode.json`)

```json
{
  "mcp": {
    "windows-clipboard": {
      "type": "local",
      "command": ["node", "C:/path/to/mcp-windows-clipboard/dist/index.js"],
      "environment": {},
      "enabled": true
    }
  }
}
```

#### Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "windows-clipboard": {
      "command": "mcp-windows-clipboard"
    }
  }
}
```

#### Cursor / VS Code

Add to your MCP extension settings:

```json
{
  "mcp.servers": {
    "windows-clipboard": {
      "command": "mcp-windows-clipboard"
    }
  }
}
```

## Available Tools

### `read_clipboard`

Read the current clipboard contents. Returns text directly or base64-encoded image data.

**Parameters:**
- `format` (optional): `"auto"` | `"text"` | `"image"` - Force specific format detection

**Example usage:**
```
Read my clipboard and tell me what's there
```

### `read_clipboard_image`

Read an image from clipboard and save it to a file. Returns the file path for use with image analysis tools.

**Parameters:**
- `outputPath` (optional): Custom path to save the image

**Example usage:**
```
Save my clipboard image to a file and analyze it
```

### `clipboard_has_image`

Check if the clipboard currently contains an image.

**Example usage:**
```
Do I have an image in my clipboard?
```

### `get_last_paste`

Get the most recently pasted content (captured automatically when you pressed Ctrl+V). Returns text content directly or file path for images. This is the key tool for the autopaste feature.

**Example usage:**
```
What did I just paste?
Analyze my last paste
```

### `autopaste_status`

Check if autopaste monitoring is active and get information about the last captured paste.

**Example usage:**
```
Is autopaste working?
```

### `clear_paste_cache`

Clear the cached paste content. Useful for privacy or to reset state.

**Example usage:**
```
Clear my paste history
```

## Usage Examples

### Basic Image Paste Workflow

1. Take a screenshot (`Win+Shift+S`)
2. Ask your AI assistant: *"What's in my clipboard?"*
3. The assistant will read and describe the image

### Save and Analyze

1. Copy an image or screenshot
2. Ask: *"Save my clipboard image and analyze it"*
3. The image is saved to temp folder and analyzed

### Text Content

1. Copy some text (`Ctrl+C`)
2. Ask: *"Read my clipboard"*
3. Returns the text content directly

### Autopaste Workflow (NEW!)

The autopaste feature automatically captures whatever you paste, so the AI can analyze it without you having to explicitly request a clipboard read:

1. Copy something (text or image)
2. Press `Ctrl+V` to paste it anywhere (your normal paste works as expected)
3. Ask your AI assistant: *"What did I just paste?"* or *"Analyze my last paste"*
4. The AI uses `get_last_paste` to retrieve and analyze the content

This is especially useful for:
- Quick image analysis after pasting a screenshot
- Reviewing what you just pasted
- Seamless workflow without explicit clipboard commands

## How It Works

This MCP server uses PowerShell to access the native Windows clipboard API:

1. **Image Detection**: Checks `[System.Windows.Forms.Clipboard]::ContainsImage()`
2. **Image Reading**: Uses `[System.Windows.Forms.Clipboard]::GetImage()` and saves as PNG
3. **Text Reading**: Uses `[System.Windows.Forms.Clipboard]::GetText()`

### Autopaste Technology

The autopaste feature uses [uiohook-napi](https://github.com/SnosMe/uiohook-napi) for non-blocking global keyboard monitoring:

- **Non-blocking**: Keyboard events are observed, not intercepted - your normal Ctrl+V paste always works
- **Automatic caching**: When Ctrl+V is detected, clipboard content is automatically read and cached
- **Graceful degradation**: If the keyboard hook fails to initialize, all other clipboard tools continue to work normally

No external dependencies or native binaries required for core functionality - just Node.js and PowerShell (included with Windows).

## Requirements

- **Windows 10/11** - Uses Windows-specific clipboard APIs
- **Node.js 18+** - Required for ES modules support
- **PowerShell** - Included with Windows, no additional setup needed

## Troubleshooting

### "Clipboard is empty" when it's not

1. Ensure the content was copied properly (try `Ctrl+C` again)
2. Some applications use custom clipboard formats not supported
3. Try copying from a different application

### PowerShell errors

1. Ensure PowerShell execution policy allows scripts:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### MCP connection issues

1. Verify the path in your config is correct
2. Check that Node.js is in your PATH
3. Try running `mcp-windows-clipboard` directly to test

### Image not saving

1. Check write permissions in the output directory
2. Try specifying a custom `outputPath`
3. Ensure enough disk space is available

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Inspired by the WSL clipboard challenges faced by the community

## Related Projects

- [mcp-clip](https://github.com/standardbeagle/mcp-clip) - Go-based MCP clipboard for WSL2
- [mcp-clipboard](https://github.com/erik-balfe/mcp-clipboard) - Persistent clipboard manager

---

**Made with frustration and determination** - because pasting images shouldn't be this hard.
