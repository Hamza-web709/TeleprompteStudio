import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class MirrorManager {
  constructor() {
    this.textContainerEl = null;
  }

  mount(textContainerElement) {
    this.textContainerEl = textContainerElement;
    this.applyMirror(appState.get('display'));

    eventBus.on('state:display', (display) => {
      this.applyMirror(display);
    });
  }

  applyMirror(display) {
    if (!this.textContainerEl || !display) return;

    const { mirrorX, mirrorY } = display;

    this.textContainerEl.classList.remove('mirror-x', 'mirror-y', 'mirror-xy');

    if (mirrorX && mirrorY) {
      this.textContainerEl.classList.add('mirror-xy');
    } else if (mirrorX) {
      this.textContainerEl.classList.add('mirror-x');
    } else if (mirrorY) {
      this.textContainerEl.classList.add('mirror-y');
    }
  }

  toggleMirrorX() {
    const current = appState.get('display');
    appState.set('display', { ...current, mirrorX: !current.mirrorX });
  }

  toggleMirrorY() {
    const current = appState.get('display');
    appState.set('display', { ...current, mirrorY: !current.mirrorY });
  }
}

export const mirrorManager = new MirrorManager();
