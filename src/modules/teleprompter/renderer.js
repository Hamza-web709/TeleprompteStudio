import { isRTLText } from '../editor/sanitizer.js';
import { appState } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';

class PrompterRenderer {
  constructor() {
    this.containerEl = null;
    this.wordsList = [];
    this.sentencesList = [];
    this.currentHighlightedWordIdx = -1;
    this.currentHighlightedSentIdx = -1;
  }

  mount(containerElement) {
    this.containerEl = containerElement;

    // Listen to content updates
    eventBus.on('script:selected', () => this.render());
    eventBus.on('editor:content-changed', () => this.render());
  }

  render() {
    if (!this.containerEl) return;
    const script = appState.get('activeScript');
    if (!script) return;

    const rawHtml = script.content || '<p>No content to display.</p>';

    // Parse into structured DOM to tag words & sentences for voice tracking and focus
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    this.wordsList = [];
    this.sentencesList = [];
    let wordCounter = 0;
    let sentenceCounter = 0;

    // Traverse paragraphs/headers and wrap words with spans
    const blockElements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, li');
    if (blockElements.length === 0) {
      // fallback wrap entire text
      const p = document.createElement('p');
      p.innerHTML = tempDiv.innerHTML;
      tempDiv.innerHTML = '';
      tempDiv.appendChild(p);
    }

    const blocks = tempDiv.querySelectorAll('p, h1, h2, h3, h4, li');
    blocks.forEach((block, paraIdx) => {
      block.setAttribute('data-para-idx', paraIdx);
      const text = block.textContent;

      // Detect sentence splits
      const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
      block.innerHTML = '';

      sentences.forEach(sentenceText => {
        const sentSpan = document.createElement('span');
        sentSpan.className = 'prompter-sentence';
        sentSpan.setAttribute('data-sent-idx', sentenceCounter);
        const currentSentIdx = sentenceCounter++;
        this.sentencesList.push({ idx: currentSentIdx, text: sentenceText.trim(), paraIdx });

        // Tokenize words
        const words = sentenceText.split(/(\s+)/);
        words.forEach(token => {
          if (/\S/.test(token)) {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'prompter-word';
            wordSpan.setAttribute('data-word-idx', wordCounter);
            wordSpan.textContent = token;
            this.wordsList.push({
              idx: wordCounter,
              text: token.toLowerCase().replace(/[^\w\u0600-\u06FF\u0900-\u097F]/g, ''),
              element: wordSpan,
              sentIdx: currentSentIdx
            });
            wordCounter++;
            sentSpan.appendChild(wordSpan);
          } else {
            sentSpan.appendChild(document.createTextNode(token));
          }
        });

        block.appendChild(sentSpan);
      });
    });

    this.containerEl.innerHTML = tempDiv.innerHTML;

    // Check RTL
    const fullText = this.containerEl.innerText || '';
    if (isRTLText(fullText)) {
      this.containerEl.setAttribute('dir', 'rtl');
    } else {
      this.containerEl.setAttribute('dir', 'ltr');
    }

    eventBus.emit('prompter:rendered', {
      totalWords: wordCounter,
      totalSentences: sentenceCounter
    });
  }

  highlightWord(wordIdx) {
    if (!this.containerEl) return;
    if (this.currentHighlightedWordIdx === wordIdx) return;

    // Unhighlight previous
    if (this.currentHighlightedWordIdx >= 0) {
      const prevEl = this.containerEl.querySelector(`[data-word-idx="${this.currentHighlightedWordIdx}"]`);
      if (prevEl) prevEl.classList.remove('word-active');
    }

    // Highlight new
    const nextEl = this.containerEl.querySelector(`[data-word-idx="${wordIdx}"]`);
    if (nextEl) {
      nextEl.classList.add('word-active');
      this.currentHighlightedWordIdx = wordIdx;

      // Also highlight enclosing sentence
      const sentIdx = nextEl.closest('.prompter-sentence')?.getAttribute('data-sent-idx');
      if (sentIdx !== null && sentIdx !== undefined) {
        this.highlightSentence(parseInt(sentIdx, 10));
      }
    }
  }

  highlightSentence(sentIdx) {
    if (this.currentHighlightedSentIdx === sentIdx) return;

    if (this.currentHighlightedSentIdx >= 0) {
      const prevSent = this.containerEl.querySelector(`[data-sent-idx="${this.currentHighlightedSentIdx}"]`);
      if (prevSent) prevSent.classList.remove('sentence-active');
    }

    const nextSent = this.containerEl.querySelector(`[data-sent-idx="${sentIdx}"]`);
    if (nextSent) {
      nextSent.classList.add('sentence-active');
      this.currentHighlightedSentIdx = sentIdx;
    }
  }

  getWordOffsetTop(wordIdx) {
    if (!this.containerEl) return 0;
    const wordEl = this.containerEl.querySelector(`[data-word-idx="${wordIdx}"]`);
    return wordEl ? wordEl.offsetTop : 0;
  }

  getSentenceOffsetTop(sentIdx) {
    if (!this.containerEl) return 0;
    const sentEl = this.containerEl.querySelector(`[data-sent-idx="${sentIdx}"]`);
    return sentEl ? sentEl.offsetTop : 0;
  }

  getParagraphOffsetTop(paraIdx) {
    if (!this.containerEl) return 0;
    const paraEl = this.containerEl.querySelector(`[data-para-idx="${paraIdx}"]`);
    return paraEl ? paraEl.offsetTop : 0;
  }
}

export const prompterRenderer = new PrompterRenderer();
