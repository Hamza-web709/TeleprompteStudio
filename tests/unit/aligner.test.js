import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  levenshteinDistance,
  tokenSimilarity,
  ScriptSpeechAligner
} from '../../src/modules/voice-tracking/aligner.js';

describe('Voice Tracking Aligner', () => {
  it('normalizes tokens removing punctuation and lowercasing', () => {
    expect(normalizeToken('Hello,')).toBe('hello');
    expect(normalizeToken('WORLD!!!')).toBe('world');
    expect(normalizeToken('آپ')).toBe('آپ');
  });

  it('calculates Levenshtein distance properly', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('teleprompter', 'teleprompter')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('calculates token similarity score', () => {
    expect(tokenSimilarity('welcome', 'welcome')).toBe(1.0);
    expect(tokenSimilarity('pro', 'pro')).toBe(1.0);
    expect(tokenSimilarity('speech', 'peech')).toBeGreaterThan(0.7);
  });

  it('aligns speech transcript window against script tokens', () => {
    const script = [
      { text: 'Welcome' },
      { text: 'to' },
      { text: 'the' },
      { text: 'production' },
      { text: 'studio' }
    ];

    const aligner = new ScriptSpeechAligner(script, 10, 0.6);

    const match1 = aligner.alignTranscript('welcome to');
    expect(match1).not.toBeNull();
    expect(match1.matchedIndex).toBe(1);

    const match2 = aligner.alignTranscript('the production studio');
    expect(match2).not.toBeNull();
    expect(match2.matchedIndex).toBe(4);
  });

  it('aligns Roman Urdu speech tokens accurately', () => {
    const urduScript = [
      { text: 'shukriya' },
      { text: 'dosto' },
      { text: 'aaj' },
      { text: 'hum' },
      { text: 'teleprompter' },
      { text: 'testing' },
      { text: 'kar' },
      { text: 'rahe' },
      { text: 'hain' }
    ];

    const aligner = new ScriptSpeechAligner(urduScript, 10, 0.6);
    const match = aligner.alignTranscript('shukriya dosto aaj hum');
    expect(match).not.toBeNull();
    expect(match.matchedIndex).toBe(3);

    const matchNext = aligner.alignTranscript('kar rahe hain');
    expect(matchNext).not.toBeNull();
    expect(matchNext.matchedIndex).toBe(8);
  });

  it('recovers and fast-forwards when speaker skips a sentence', () => {
    // 35 tokens script
    const longScript = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive final destination'
      .split(' ')
      .map(t => ({ text: t }));

    const aligner = new ScriptSpeechAligner(longScript, 10, 0.6);
    
    // First match at start
    const match1 = aligner.alignTranscript('one two');
    expect(match1.matchedIndex).toBe(1);

    // Speaker skips 22 words and jumps straight to "final destination"
    const matchSkip = aligner.alignTranscript('final destination');
    expect(matchSkip).not.toBeNull();
    expect(matchSkip.matchedIndex).toBe(longScript.length - 1);
  });

  it('handles pause/silence without moving or corrupting reading position', () => {
    const script = [{ text: 'alpha' }, { text: 'bravo' }, { text: 'charlie' }];
    const aligner = new ScriptSpeechAligner(script, 10, 0.6);

    aligner.alignTranscript('alpha bravo');
    expect(aligner.currentPosition).toBe(1);

    // Silence or unrelated noise during pause
    const silenceResult = aligner.alignTranscript('   ');
    expect(silenceResult).toBeNull();
    expect(aligner.currentPosition).toBe(1); // Position maintained
  });
});
