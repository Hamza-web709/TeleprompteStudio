import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

export const ASPECT_RATIOS = {
  'full': { key: 'full', label: 'Full Screen / Native', ratio: null },
  '16:9': { key: '16:9', label: '16:9 (Landscape YouTube)', ratio: 16 / 9 },
  '9:16': { key: '9:16', label: '9:16 (Portrait Shorts/Reels)', ratio: 9 / 16 },
  '4:3': { key: '4:3', label: '4:3 (Broadcast Standard)', ratio: 4 / 3 },
  '1:1': { key: '1:1', label: '1:1 (Square)', ratio: 1.0 },
  '2:1': { key: '2:1', label: '2:1 (Cinematic Wide)', ratio: 2.0 }
};

class AspectRatioManager {
  constructor() {
    this.workspaceEl = null;
    this.frameEl = null;
    this.viewportEl = null;
    this.currentRatio = 'full';
    this.handleResize = this.handleResize.bind(this);
  }

  mount({ workspaceEl, frameEl, viewportEl }) {
    this.workspaceEl = workspaceEl;
    this.frameEl = frameEl;
    this.viewportEl = viewportEl;

    const initialDisplay = appState.get('display');
    this.currentRatio = initialDisplay?.aspectRatio || 'full';
    this.applyAspectRatio(this.currentRatio);

    window.addEventListener('resize', this.handleResize);

    eventBus.on('state:display', (display) => {
      if (display?.aspectRatio && display.aspectRatio !== this.currentRatio) {
        this.currentRatio = display.aspectRatio;
        this.applyAspectRatio(this.currentRatio);
      }
    });
  }

  handleResize() {
    this.applyAspectRatio(this.currentRatio);
  }

  setRatio(ratioKey) {
    if (!ASPECT_RATIOS[ratioKey]) {
      ratioKey = 'full';
    }
    this.currentRatio = ratioKey;
    appState.update('display', { aspectRatio: ratioKey });
    this.applyAspectRatio(ratioKey);
  }

  applyAspectRatio(ratioKey = this.currentRatio) {
    if (!this.frameEl && typeof document !== 'undefined') {
      this.frameEl = document.getElementById('prompter-frame') || document.getElementById('prompter-viewport');
    }
    if (!this.workspaceEl && typeof document !== 'undefined') {
      this.workspaceEl = document.getElementById('main-workspace');
    }
    if (!this.viewportEl && typeof document !== 'undefined') {
      this.viewportEl = document.getElementById('prompter-viewport');
    }

    if (!this.workspaceEl || !this.frameEl) return;

    if (!ratioKey || ratioKey === 'full') {
      this.frameEl.style.width = '100%';
      this.frameEl.style.height = '100%';
      this.frameEl.style.aspectRatio = 'auto';
      this.frameEl.classList.remove('framed-aspect-ratio');
      if (this.viewportEl && this.viewportEl !== this.frameEl) {
        this.viewportEl.style.aspectRatio = 'auto';
      }
    } else {
      this.frameEl.classList.add('framed-aspect-ratio');
      const ratioConfig = ASPECT_RATIOS[ratioKey] || ASPECT_RATIOS['16:9'];
      const targetAspect = ratioConfig.ratio;

      const wsWidth = this.workspaceEl.clientWidth || window.innerWidth;
      const wsHeight = this.workspaceEl.clientHeight || (window.innerHeight - 128);
      const wsAspect = wsWidth / (wsHeight || 1);

      let frameWidth, frameHeight;
      if (wsAspect > targetAspect) {
        // Workspace is wider -> fit height (pillarbox left/right)
        frameHeight = wsHeight;
        frameWidth = Math.round(wsHeight * targetAspect);
      } else {
        // Workspace is taller -> fit width (letterbox top/bottom)
        frameWidth = wsWidth;
        frameHeight = Math.round(wsWidth / targetAspect);
      }

      // Constrain within available bounds
      if (frameWidth > wsWidth) {
        frameWidth = wsWidth;
        frameHeight = Math.round(wsWidth / targetAspect);
      }
      if (frameHeight > wsHeight) {
        frameHeight = wsHeight;
        frameWidth = Math.round(wsHeight * targetAspect);
      }

      const [rw, rh] = ratioKey.split(':');
      this.frameEl.style.width = `${frameWidth}px`;
      this.frameEl.style.height = `${frameHeight}px`;
      this.frameEl.style.aspectRatio = `${rw}/${rh}`;
      if (this.viewportEl && this.viewportEl !== this.frameEl) {
        this.viewportEl.style.aspectRatio = `${rw}/${rh}`;
      }
    }

    // Invalidate scrollEngine dimensions so text scroll ranges update immediately
    if (typeof window !== 'undefined' && window.teleprompterApp?.scrollEngine?.recalculateDimensions) {
      window.teleprompterApp.scrollEngine.recalculateDimensions();
    }

    eventBus.emit('display:aspect-ratio-applied', {
      ratio: ratioKey,
      width: this.frameEl.clientWidth,
      height: this.frameEl.clientHeight
    });
  }

  getDimensions() {
    if (!this.frameEl) return { width: 0, height: 0, ratio: 1 };
    const rect = this.frameEl.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      ratio: rect.width / (rect.height || 1)
    };
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}

export const aspectRatioManager = new AspectRatioManager();
