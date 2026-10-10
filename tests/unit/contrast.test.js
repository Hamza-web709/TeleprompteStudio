import { describe, it, expect } from 'vitest';
import { calculateContrastRatio, isContrastAcceptable } from '../../src/modules/backgrounds/contrast.js';

describe('Contrast Ratio Validator', () => {
  it('calculates pure black and white contrast as 21:1', () => {
    const ratio = calculateContrastRatio('#ffffff', '#000000');
    expect(ratio).toBe(21);
  });

  it('detects low contrast pairs correctly', () => {
    // Light gray on white
    const result = isContrastAcceptable('#cccccc', '#ffffff', false);
    expect(result.acceptable).toBe(false);
    expect(result.ratio).toBeLessThan(4.5);
  });

  it('confirms high contrast theme is optimal', () => {
    // Yellow on black
    const result = isContrastAcceptable('#ffff00', '#000000', true);
    expect(result.acceptable).toBe(true);
    expect(result.ratio).toBeGreaterThan(15);
  });
});
