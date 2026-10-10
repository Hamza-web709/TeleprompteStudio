import { describe, it, expect } from 'vitest';
import { DEFAULT_PRESETS } from '../../src/modules/presets/presetManager.js';

describe('Studio Presets', () => {
  it('contains all 12 required industry presets', () => {
    expect(DEFAULT_PRESETS.length).toBe(12);
  });

  it('ensures each preset has required typography and background fields', () => {
    DEFAULT_PRESETS.forEach(preset => {
      expect(preset.id).toBeDefined();
      expect(preset.name).toBeDefined();
      expect(preset.typography.fontFamily).toBeDefined();
      expect(preset.typography.fontSize).toBeGreaterThan(0);
      expect(preset.background.color).toBeDefined();
      expect(preset.scrolling.speed).toBeGreaterThan(0);
    });
  });
});
