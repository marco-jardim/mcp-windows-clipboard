/**
 * Tests for Paste Cache Module
 * 
 * @license GPL-3.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheLastPaste,
  getLastPaste,
  clearCache,
  hasCachedPaste,
  getTimeSinceLastPaste,
} from '../src/paste-cache.js';
import type { PasteEvent } from '../src/paste-cache.js';

describe('Paste Cache Module', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('cacheLastPaste', () => {
    it('should cache a text paste event', () => {
      const event: PasteEvent = {
        type: 'text',
        content: 'Hello, world!',
        timestamp: Date.now(),
        size: 13,
      };

      cacheLastPaste(event);
      const cached = getLastPaste();

      expect(cached).not.toBeNull();
      expect(cached?.type).toBe('text');
      expect(cached?.content).toBe('Hello, world!');
      expect(cached?.size).toBe(13);
    });

    it('should cache an image paste event', () => {
      const event: PasteEvent = {
        type: 'image',
        content: 'C:\\temp\\image.png',
        timestamp: Date.now(),
        format: 'png',
      };

      cacheLastPaste(event);
      const cached = getLastPaste();

      expect(cached).not.toBeNull();
      expect(cached?.type).toBe('image');
      expect(cached?.content).toBe('C:\\temp\\image.png');
      expect(cached?.format).toBe('png');
    });

    it('should replace previous cache on new paste', () => {
      const firstEvent: PasteEvent = {
        type: 'text',
        content: 'First paste',
        timestamp: Date.now(),
      };

      const secondEvent: PasteEvent = {
        type: 'text',
        content: 'Second paste',
        timestamp: Date.now() + 1000,
      };

      cacheLastPaste(firstEvent);
      cacheLastPaste(secondEvent);
      
      const cached = getLastPaste();
      expect(cached?.content).toBe('Second paste');
    });

    it('should use provided timestamp', () => {
      const specificTime = 1234567890000;
      const event: PasteEvent = {
        type: 'text',
        content: 'Test',
        timestamp: specificTime,
      };

      cacheLastPaste(event);
      const cached = getLastPaste();

      expect(cached?.timestamp).toBe(specificTime);
    });
  });

  describe('getLastPaste', () => {
    it('should return null when cache is empty', () => {
      expect(getLastPaste()).toBeNull();
    });

    it('should return cached event after caching', () => {
      cacheLastPaste({
        type: 'text',
        content: 'Test content',
        timestamp: Date.now(),
      });

      expect(getLastPaste()).not.toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear cached paste', () => {
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: Date.now(),
      });

      expect(getLastPaste()).not.toBeNull();
      clearCache();
      expect(getLastPaste()).toBeNull();
    });

    it('should be safe to call when cache is already empty', () => {
      expect(() => clearCache()).not.toThrow();
      expect(getLastPaste()).toBeNull();
    });
  });

  describe('hasCachedPaste', () => {
    it('should return false when cache is empty', () => {
      expect(hasCachedPaste()).toBe(false);
    });

    it('should return true when cache has content', () => {
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: Date.now(),
      });

      expect(hasCachedPaste()).toBe(true);
    });

    it('should return false after cache is cleared', () => {
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: Date.now(),
      });
      clearCache();

      expect(hasCachedPaste()).toBe(false);
    });
  });

  describe('getTimeSinceLastPaste', () => {
    it('should return null when cache is empty', () => {
      expect(getTimeSinceLastPaste()).toBeNull();
    });

    it('should return "0s ago" for very recent paste', () => {
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: Date.now(),
      });

      const timeSince = getTimeSinceLastPaste();
      expect(timeSince).toMatch(/^\d+s ago$/);
    });

    it('should return minutes for older paste', () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: twoMinutesAgo,
      });

      const timeSince = getTimeSinceLastPaste();
      expect(timeSince).toMatch(/^\d+m ago$/);
    });

    it('should return hours for much older paste', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      cacheLastPaste({
        type: 'text',
        content: 'Test',
        timestamp: twoHoursAgo,
      });

      const timeSince = getTimeSinceLastPaste();
      expect(timeSince).toMatch(/^\d+h ago$/);
    });
  });

  describe('PasteEvent interface', () => {
    it('should support all required fields', () => {
      const textEvent: PasteEvent = {
        type: 'text',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const imageEvent: PasteEvent = {
        type: 'image',
        content: '/path/to/image.png',
        timestamp: Date.now(),
        format: 'png',
        size: 1024,
      };

      const emptyEvent: PasteEvent = {
        type: 'empty',
        content: '',
        timestamp: Date.now(),
      };

      expect(textEvent.type).toBe('text');
      expect(imageEvent.type).toBe('image');
      expect(emptyEvent.type).toBe('empty');
    });
  });
});
