import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { isContrastAcceptable } from '../backgrounds/contrast.js';

function buildOutlineShadow(width, color) {
  if (!width || width <= 0) return 'none';
  const shadows = [];
  for (let x = -width; x <= width; x++) {
    for (let y = -width; y <= width; y++) {
      if (x !== 0 || y !== 0) {
        shadows.push(`${x}px ${y}px 0 ${color}`);
      }
    }
  }
  return shadows.join(', ');
}

class TypographyEngine {
  constructor() {
    this.root = typeof document !== 'undefined' ? document.documentElement : null;
  }

  init() {
    this.applySettings(appState.get('typography'));

    eventBus.on('state:typography', (typography) => {
      this.applySettings(typography);
    });
  }

  applySettings(typography) {
    if (!typography || typeof document === 'undefined') return;

    const textColor = typography.textColor || '#ffffff';
    const outlineEnabled = Boolean(typography.textOutline);
    const outlineWidth = outlineEnabled ? (typography.outlineWidth ?? 2) : 0;
    const outlineColor = typography.outlineColor || '#000000';
    const textShadowStr = typography.textShadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none';
    const outlineShadowStr = buildOutlineShadow(outlineWidth, outlineColor);

    // Apply to :root
    this.root.style.setProperty('--prompt-font-family', typography.fontFamily || "'Inter', sans-serif");
    this.root.style.setProperty('--prompt-font-size', `${typography.fontSize || 52}px`);
    this.root.style.setProperty('--prompt-font-weight', typography.fontWeight || 600);
    this.root.style.setProperty('--prompt-text-color', textColor);
    this.root.style.setProperty('--custom-text-color', textColor);
    this.root.style.setProperty('--prompt-text-align', typography.textAlign || 'center');
    this.root.style.setProperty('--prompt-line-height', typography.lineHeight || 1.5);
    this.root.style.setProperty('--prompt-letter-spacing', `${typography.letterSpacing || 0.5}px`);
    this.root.style.setProperty('--prompt-word-spacing', `${typography.wordSpacing || 1}px`);
    this.root.style.setProperty('--prompt-container-width', `${typography.containerWidth || 85}%`);
    this.root.style.setProperty('--prompt-text-transform', typography.textTransform || 'none');
    this.root.style.setProperty('--prompt-shadow', textShadowStr);
    this.root.style.setProperty('--prompt-outline-width', `${outlineWidth}px`);
    this.root.style.setProperty('--prompt-outline-color', outlineColor);
    this.root.style.setProperty('--prompt-outline', outlineShadowStr);

    // Apply directly to body to override theme attribute selector specificity
    if (document.body) {
      document.body.style.setProperty('--prompt-font-weight', typography.fontWeight || 600);
      document.body.style.setProperty('--prompt-line-height', typography.lineHeight || 1.5);
      document.body.style.setProperty('--prompt-text-color', textColor);
      document.body.style.setProperty('--custom-text-color', textColor);
      document.body.style.setProperty('--prompt-outline-width', `${outlineWidth}px`);
      document.body.style.setProperty('--prompt-outline-color', outlineColor);
    }

    // Apply to prompter text container directly
    const textContainer = document.getElementById('prompter-text-container');
    if (textContainer) {
      textContainer.style.setProperty('--prompt-font-family', typography.fontFamily || "'Inter', sans-serif");
      textContainer.style.setProperty('--prompt-font-size', `${typography.fontSize || 52}px`);
      textContainer.style.setProperty('--prompt-font-weight', typography.fontWeight || 600);
      textContainer.style.setProperty('--prompt-line-height', typography.lineHeight || 1.5);
      textContainer.style.setProperty('--prompt-text-color', textColor);
      textContainer.style.setProperty('--prompt-outline-width', `${outlineWidth}px`);
      textContainer.style.setProperty('--prompt-outline-color', outlineColor);
      textContainer.style.fontFamily = typography.fontFamily || "'Inter', sans-serif";
      textContainer.style.fontWeight = typography.fontWeight || 600;
      textContainer.style.lineHeight = typography.lineHeight || 1.5;
      textContainer.style.color = textColor;
    }

    // Evaluate contrast against current effective background color
    const currentBg = appState.get('background')?.color || '#000000';
    const contrastResult = isContrastAcceptable(textColor, currentBg);
    eventBus.emit('contrast:checked', contrastResult);
  }

  update(key, value) {
    const current = appState.get('typography');
    const updated = { ...current, [key]: value };
    appState.set('typography', updated);
  }

  reset() {
    const defaults = {
      fontFamily: "'Inter', sans-serif",
      fontSize: 52,
      fontWeight: 600,
      textColor: '#ffffff',
      textAlign: 'center',
      lineHeight: 1.5,
      letterSpacing: 0.5,
      wordSpacing: 1,
      containerWidth: 85,
      textTransform: 'none',
      textShadow: true,
      textOutline: false,
      outlineWidth: 2,
      outlineColor: '#000000'
    };
    appState.set('typography', defaults);
  }
}

export const typographyEngine = new TypographyEngine();
