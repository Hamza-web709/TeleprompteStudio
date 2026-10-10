/**
 * Script Analytics Utility
 */

export function calculateScriptStats(text = '', targetWpm = 130) {
  if (!text || typeof text !== 'string') {
    return {
      words: 0,
      characters: 0,
      paragraphs: 0,
      estimatedSeconds: 0,
      formattedDuration: '00:00'
    };
  }

  // Strip HTML tags for clean word & character counts
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (!cleanText) {
    return {
      words: 0,
      characters: 0,
      paragraphs: 0,
      estimatedSeconds: 0,
      formattedDuration: '00:00'
    };
  }

  // Unicode word splitting supporting Latin, Roman Urdu, Arabic/Urdu, and Devanagari
  const wordsArray = cleanText.split(/\s+/).filter(w => w.length > 0);
  const words = wordsArray.length;
  const characters = cleanText.length;

  // Paragraph counting (split by double newline or block tags)
  const paragraphs = text.split(/(?:\r?\n){2,}|<\/p>|<\/div>/i).filter(p => p.trim().length > 0).length || 1;

  // Reading time calculation: (words / WPM) * 60 seconds
  const validWpm = Math.max(20, targetWpm || 130);
  const estimatedSeconds = Math.round((words / validWpm) * 60);

  const mins = Math.floor(estimatedSeconds / 60);
  const secs = estimatedSeconds % 60;
  const formattedDuration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    words,
    characters,
    paragraphs,
    estimatedSeconds,
    formattedDuration
  };
}

export function formatTimeSeconds(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
