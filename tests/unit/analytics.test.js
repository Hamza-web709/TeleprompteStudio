import { describe, it, expect } from 'vitest';
import { calculateScriptStats, formatTimeSeconds } from '../../src/modules/scripts/analytics.js';

describe('Script Analytics', () => {
  it('calculates stats for empty text correctly', () => {
    const stats = calculateScriptStats('', 130);
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.estimatedSeconds).toBe(0);
    expect(stats.formattedDuration).toBe('00:00');
  });

  it('calculates word and character counts accurately for English text', () => {
    const text = '<p>The quick brown fox jumps over the lazy dog.</p>';
    const stats = calculateScriptStats(text, 130);
    expect(stats.words).toBe(9);
    expect(stats.estimatedSeconds).toBe(4); // (9 / 130) * 60 = 4.15 -> 4
    expect(stats.formattedDuration).toBe('00:04');
  });

  it('supports multilingual text including Urdu and Hindi', () => {
    const urduText = '<p>ٹیلی پرامپٹر اسٹوڈیو پرو ایک جدید ترین ایپلی کیشن ہے۔</p>';
    const statsUrdu = calculateScriptStats(urduText, 120);
    expect(statsUrdu.words).toBe(10);

    const hindiText = '<p>टेलीप्रॉम्प्टर स्टूडियो प्रो एक आधुनिक वेब एप्लिकेशन है।</p>';
    const statsHindi = calculateScriptStats(hindiText, 120);
    expect(statsHindi.words).toBe(8);
  });

  it('formats seconds into MM:SS correctly', () => {
    expect(formatTimeSeconds(0)).toBe('00:00');
    expect(formatTimeSeconds(65)).toBe('01:05');
    expect(formatTimeSeconds(3600)).toBe('60:00');
  });
});
