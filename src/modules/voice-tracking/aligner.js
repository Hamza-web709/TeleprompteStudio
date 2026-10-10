/**
 * Dynamic Speech-to-Script Alignment Engine
 * Uses token normalization, sliding window matching, and Levenshtein distance
 */

export function normalizeToken(word = '') {
  if (!word || typeof word !== 'string') return '';
  return word
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\w\u0600-\u06FF\u0900-\u097F]/g, '')
    .trim();
}

export function levenshteinDistance(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function tokenSimilarity(a = '', b = '') {
  const normA = normalizeToken(a);
  const normB = normalizeToken(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return 1 - dist / maxLen;
}

export class ScriptSpeechAligner {
  constructor(scriptTokens = [], windowSize = 15, matchThreshold = 0.65) {
    this.scriptTokens = scriptTokens.map((t, idx) => ({
      index: idx,
      raw: t.text || t,
      normalized: normalizeToken(t.text || t)
    }));
    this.windowSize = windowSize;
    this.matchThreshold = matchThreshold;
    this.currentPosition = 0;
  }

  setScriptTokens(tokens) {
    this.scriptTokens = tokens.map((t, idx) => ({
      index: idx,
      raw: t.text || t,
      normalized: normalizeToken(t.text || t)
    }));
    this.currentPosition = 0;
  }

  alignTranscript(transcript) {
    if (!transcript || !this.scriptTokens.length) return null;

    const spokenTokens = transcript
      .split(/\s+/)
      .map(w => normalizeToken(w))
      .filter(w => w.length > 0);

    if (!spokenTokens.length) return null;

    // Search within window around currentPosition to prevent sudden jumps
    const startIndex = Math.max(0, this.currentPosition - 2);
    const endIndex = Math.min(this.scriptTokens.length, this.currentPosition + this.windowSize);

    let bestMatchIndex = -1;
    let highestScore = 0;

    // Last 1 to 3 spoken words are matched against candidate script tokens
    const recentSpoken = spokenTokens.slice(-3);

    for (let i = startIndex; i < endIndex; i++) {
      let scoreSum = 0;
      let matchedCount = 0;

      for (let k = 0; k < recentSpoken.length; k++) {
        const scriptCandidate = this.scriptTokens[i + k];
        if (!scriptCandidate) break;

        const sim = tokenSimilarity(recentSpoken[k], scriptCandidate.normalized);
        if (sim >= this.matchThreshold) {
          scoreSum += sim;
          matchedCount++;
        }
      }

      if (matchedCount > 0) {
        const avgScore = scoreSum / matchedCount;
        if (avgScore > highestScore && avgScore >= this.matchThreshold) {
          highestScore = avgScore;
          bestMatchIndex = i + matchedCount - 1;
        }
      }
    }

    // If no match in immediate window, search extended lookahead (up to 60 tokens) to recover from skipped sentences
    if (bestMatchIndex === -1 && endIndex < this.scriptTokens.length) {
      const extendedEnd = Math.min(this.scriptTokens.length, this.currentPosition + 60);
      for (let i = endIndex; i < extendedEnd; i++) {
        let scoreSum = 0;
        let matchedCount = 0;

        for (let k = 0; k < recentSpoken.length; k++) {
          const scriptCandidate = this.scriptTokens[i + k];
          if (!scriptCandidate) break;

          const sim = tokenSimilarity(recentSpoken[k], scriptCandidate.normalized);
          if (sim >= this.matchThreshold) {
            scoreSum += sim;
            matchedCount++;
          }
        }

        if (matchedCount > 0) {
          const avgScore = scoreSum / matchedCount;
          if (avgScore > highestScore && avgScore >= this.matchThreshold) {
            highestScore = avgScore;
            bestMatchIndex = i + matchedCount - 1;
          }
        }
      }
    }

    if (bestMatchIndex !== -1 && bestMatchIndex >= this.currentPosition) {
      this.currentPosition = bestMatchIndex;
      return {
        matchedIndex: bestMatchIndex,
        confidence: highestScore,
        scriptToken: this.scriptTokens[bestMatchIndex]
      };
    }

    return null;
  }

  reset(position = 0) {
    this.currentPosition = Math.max(0, Math.min(position, this.scriptTokens.length - 1));
  }
}
