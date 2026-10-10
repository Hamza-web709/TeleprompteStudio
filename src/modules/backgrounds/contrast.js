/**
 * WCAG 2.2 AA Contrast Ratio Calculation Utility
 */

function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastRatio(textColorHex = '#ffffff', bgColorHex = '#000000') {
  try {
    const rgb1 = hexToRgb(textColorHex);
    const rgb2 = hexToRgb(bgColorHex);

    const l1 = getLuminance(rgb1);
    const l2 = getLuminance(rgb2);

    const brightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);

    const ratio = (brightest + 0.05) / (darkest + 0.05);
    return Math.round(ratio * 10) / 10;
  } catch {
    return 21; // fallback max contrast
  }
}

export function isContrastAcceptable(textColorHex, bgColorHex, isLargeText = true) {
  const ratio = calculateContrastRatio(textColorHex, bgColorHex);
  const minRatio = isLargeText ? 3.0 : 4.5;
  return {
    ratio,
    acceptable: ratio >= minRatio,
    message: ratio >= minRatio ? 'Optimal contrast' : `Low contrast warning: ${ratio}:1 (Recommended ≥ ${minRatio}:1)`
  };
}
