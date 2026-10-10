import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOptimalRecordingFormat, getTargetBitrates } from '../../src/modules/recording/mediaRecorder.js';
import { appState, getDefaultResolution } from '../../src/state/appState.js';

describe('Mobile Recording Optimizations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bitrate Assignment', () => {
    it('provides 2.5 Mbps video bitrate for 720p default mobile recording', () => {
      const bitrates = getTargetBitrates('720p');
      expect(bitrates.videoBitsPerSecond).toBe(2_500_000);
      expect(bitrates.audioBitsPerSecond).toBe(128_000);
    });

    it('provides 5.0 Mbps video bitrate for 1080p Full HD recording', () => {
      const bitrates = getTargetBitrates('1080p');
      expect(bitrates.videoBitsPerSecond).toBe(5_000_000);
      expect(bitrates.audioBitsPerSecond).toBe(128_000);
    });

    it('provides 12.0 Mbps video bitrate for 4K Ultra HD recording', () => {
      const bitrates = getTargetBitrates('4k');
      expect(bitrates.videoBitsPerSecond).toBe(12_000_000);
      expect(bitrates.audioBitsPerSecond).toBe(128_000);
    });

    it('defaults to 720p bitrates for unknown resolution strings', () => {
      const bitrates = getTargetBitrates('custom-res');
      expect(bitrates.videoBitsPerSecond).toBe(2_500_000);
    });
  });

  describe('Hardware-Aware Codec Selection', () => {
    it('prioritizes hardware H.264/MP4 when supported on mobile', () => {
      // Mock mobile device
      appState.set('isMobileDevice', true);

      // Mock MediaRecorder.isTypeSupported
      global.MediaRecorder = {
        isTypeSupported: vi.fn((type) => {
          // Both H.264 MP4 and VP9 WebM return true
          if (type.includes('video/mp4') || type.includes('video/webm')) return true;
          return false;
        })
      };

      const format = getOptimalRecordingFormat();
      expect(format.mimeType).toContain('video/mp4');
      expect(format.hw).toBe(true);
      expect(format.mimeType).not.toContain('vp9');
    });

    it('falls back to VP8 hardware WebM when MP4 is unsupported', () => {
      appState.set('isMobileDevice', true);

      global.MediaRecorder = {
        isTypeSupported: vi.fn((type) => {
          if (type.includes('video/mp4')) return false;
          if (type.includes('vp8')) return true;
          if (type.includes('vp9')) return true;
          return false;
        })
      };

      const format = getOptimalRecordingFormat();
      expect(format.mimeType).toBe('video/webm;codecs=vp8,opus');
      expect(format.hw).toBe(true);
    });

    it('does NOT choose VP9 solely because isTypeSupported is true on mobile', () => {
      appState.set('isMobileDevice', true);

      global.MediaRecorder = {
        isTypeSupported: vi.fn((type) => {
          // If only VP8 and VP9 are supported, VP8 is chosen over VP9
          return type.includes('vp8') || type.includes('vp9');
        })
      };

      const format = getOptimalRecordingFormat();
      expect(format.mimeType).not.toContain('vp9');
      expect(format.mimeType).toContain('vp8');
    });

    it('handles environments where MediaRecorder is undefined gracefully', () => {
      const originalRecorder = global.MediaRecorder;
      delete global.MediaRecorder;

      const format = getOptimalRecordingFormat();
      expect(format.mimeType).toBe('');
      expect(format.desc).toBe('Browser Default Codec');

      global.MediaRecorder = originalRecorder;
    });
  });

  describe('Mobile Device State Constraints', () => {
    it('determines 720p as default resolution when isMobileDevice is true', () => {
      expect(getDefaultResolution(true)).toBe('720p');
      expect(getDefaultResolution(false)).toBe('1080p');
    });

    it('supports Clean Recording toggle to avoid canvas re-encoding', () => {
      expect(appState.get('media').cleanRecord).toBe(true);
      appState.update('media', { cleanRecord: false });
      expect(appState.get('media').cleanRecord).toBe(false);
      appState.update('media', { cleanRecord: true });
      expect(appState.get('media').cleanRecord).toBe(true);
    });
  });
});
