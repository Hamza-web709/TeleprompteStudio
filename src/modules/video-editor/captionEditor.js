/**
 * Subtitles & Captions Generator & Editor
 * Supports SRT & VTT exports, timestamp segmentation, and auto-generation
 */

export class CaptionEditor {
  constructor() {
    this.segments = []; // { id, startSec, endSec, text }
  }

  setSegments(segments) {
    this.segments = [...segments];
  }

  getSegments() {
    return [...this.segments];
  }

  clearSegments() {
    this.segments = [];
  }

  addSegment(startSec, endSec, text) {
    this.segments.push({
      id: `cap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      startSec: Math.max(0, parseFloat(startSec) || 0),
      endSec: Math.max(0.1, parseFloat(endSec) || 1),
      text: (text || '').trim()
    });
    this.sortSegments();
  }

  updateSegment(id, partial) {
    const idx = this.segments.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.segments[idx] = { ...this.segments[idx], ...partial };
      this.sortSegments();
    }
  }

  deleteSegment(id) {
    this.segments = this.segments.filter(s => s.id !== id);
  }

  sortSegments() {
    this.segments.sort((a, b) => a.startSec - b.startSec);
  }

  generateFromScript(htmlOrText = '', targetWpm = 130) {
    if (!htmlOrText) return [];
    this.clearSegments();

    // Clean HTML to text
    const cleanText = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return [];

    // Split sentences
    const sentences = cleanText.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [cleanText];
    let currentTime = 0;
    const wps = (targetWpm || 130) / 60; // words per second

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      const wordCount = trimmed.split(/\s+/).length;
      const duration = Math.max(1.5, wordCount / wps);

      this.addSegment(currentTime, currentTime + duration, trimmed);
      currentTime += duration + 0.3; // brief gap between sentences
    });

    return this.getSegments();
  }

  formatTimeSRT(seconds) {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  formatTimeVTT(seconds) {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  exportSRT() {
    let output = '';
    this.segments.forEach((seg, idx) => {
      output += `${idx + 1}\n`;
      output += `${this.formatTimeSRT(seg.startSec)} --> ${this.formatTimeSRT(seg.endSec)}\n`;
      output += `${seg.text}\n\n`;
    });
    return output;
  }

  exportVTT() {
    let output = 'WEBVTT\n\n';
    this.segments.forEach((seg, idx) => {
      output += `${idx + 1}\n`;
      output += `${this.formatTimeVTT(seg.startSec)} --> ${this.formatTimeVTT(seg.endSec)}\n`;
      output += `${seg.text}\n\n`;
    });
    return output;
  }

  downloadCaptions(format = 'srt', filename = 'captions') {
    const content = format === 'vtt' ? this.exportVTT() : this.exportSRT();
    const mime = format === 'vtt' ? 'text/vtt' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export const captionEditor = new CaptionEditor();
