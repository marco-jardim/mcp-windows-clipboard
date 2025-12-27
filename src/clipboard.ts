/**
 * Windows Clipboard Access Module
 * 
 * Uses PowerShell to access the native Windows clipboard API
 * for both text and image content.
 * 
 * @license GPL-3.0
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface ClipboardContent {
  type: 'text' | 'image' | 'empty';
  text?: string;
  base64?: string;
  format?: 'png' | 'bmp' | 'unknown';
  filePath?: string;
  hasImage?: boolean;
}

export interface ReadClipboardOptions {
  format?: 'auto' | 'text' | 'image';
  saveToFile?: boolean;
  outputPath?: string;
  checkOnly?: boolean;
}

/**
 * Execute a PowerShell script and return its output
 */
async function executePowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', script
    ], {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `PowerShell exited with code ${code}`));
      }
    });

    ps.on('error', (err) => {
      reject(new Error(`Failed to start PowerShell: ${err.message}`));
    });
  });
}

/**
 * Check if clipboard contains an image
 */
async function clipboardHasImage(): Promise<boolean> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $cb = [System.Windows.Forms.Clipboard]::ContainsImage()
    Write-Output $cb
  `;
  
  const result = await executePowerShell(script);
  return result.toLowerCase() === 'true';
}

/**
 * Check if clipboard contains text
 */
async function clipboardHasText(): Promise<boolean> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $cb = [System.Windows.Forms.Clipboard]::ContainsText()
    Write-Output $cb
  `;
  
  const result = await executePowerShell(script);
  return result.toLowerCase() === 'true';
}

/**
 * Read text from clipboard
 */
async function readClipboardText(): Promise<string | null> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $text = [System.Windows.Forms.Clipboard]::GetText()
    if ($text) { Write-Output $text } else { Write-Output "" }
  `;
  
  const result = await executePowerShell(script);
  return result || null;
}

/**
 * Read image from clipboard and return as base64
 */
async function readClipboardImageBase64(): Promise<{ base64: string; format: 'png' } | null> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($image -eq $null) {
      Write-Output "NO_IMAGE"
      exit 0
    }
    
    $ms = New-Object System.IO.MemoryStream
    $image.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $base64 = [Convert]::ToBase64String($bytes)
    $ms.Dispose()
    $image.Dispose()
    
    Write-Output $base64
  `;
  
  const result = await executePowerShell(script);
  
  if (result === 'NO_IMAGE' || !result) {
    return null;
  }
  
  return { base64: result, format: 'png' };
}

/**
 * Read image from clipboard and save to file
 */
async function readClipboardImageToFile(outputPath?: string): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = join(tmpdir(), `clipboard_${timestamp}.png`);
  const filePath = outputPath || defaultPath;
  
  // Escape backslashes for PowerShell
  const escapedPath = filePath.replace(/\\/g, '\\\\');
  
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($image -eq $null) {
      Write-Output "NO_IMAGE"
      exit 0
    }
    
    $image.Save("${escapedPath}", [System.Drawing.Imaging.ImageFormat]::Png)
    $image.Dispose()
    
    Write-Output "${escapedPath}"
  `;
  
  const result = await executePowerShell(script);
  
  if (result === 'NO_IMAGE' || !result) {
    return null;
  }
  
  // Verify file exists
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Read clipboard content with specified options
 */
export async function readClipboard(options: ReadClipboardOptions = {}): Promise<ClipboardContent> {
  const { format = 'auto', saveToFile = false, outputPath, checkOnly = false } = options;

  // Check what's in clipboard
  const [hasImage, hasText] = await Promise.all([
    clipboardHasImage(),
    clipboardHasText()
  ]);

  // If just checking, return status
  if (checkOnly) {
    return {
      type: hasImage ? 'image' : hasText ? 'text' : 'empty',
      hasImage
    };
  }

  // Handle format preference
  if (format === 'image' || (format === 'auto' && hasImage)) {
    if (!hasImage) {
      return { type: 'empty' };
    }

    if (saveToFile) {
      const filePath = await readClipboardImageToFile(outputPath);
      if (filePath) {
        return { type: 'image', filePath, format: 'png' };
      }
      return { type: 'empty' };
    }

    const imageData = await readClipboardImageBase64();
    if (imageData) {
      return { type: 'image', base64: imageData.base64, format: imageData.format };
    }
    return { type: 'empty' };
  }

  if (format === 'text' || (format === 'auto' && hasText)) {
    if (!hasText) {
      return { type: 'empty' };
    }

    const text = await readClipboardText();
    if (text) {
      return { type: 'text', text };
    }
    return { type: 'empty' };
  }

  return { type: 'empty' };
}

/**
 * Write text to clipboard
 */
export async function writeClipboardText(text: string): Promise<void> {
  const escapedText = text.replace(/'/g, "''");
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText('${escapedText}')
  `;
  
  await executePowerShell(script);
}
