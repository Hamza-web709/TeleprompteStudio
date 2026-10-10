import { describe, it, expect } from 'vitest';
import { CaptionEditor } from '../../src/modules/video-editor/captionEditor.js';

describe('Caption Editor', () => {
  it('formats SRT subtitles accurately', () => {
    const editor = new CaptionEditor();
    editor.addSegment(1.5, 4.25, 'Hello world');
    const srt = editor.exportSRT();

    expect(srt).toContain('1\n');
    expect(srt).toContain('00:00:01,500 --> 00:00:04,250\nHello world');
  });

  it('formats VTT subtitles accurately', () => {
    const editor = new CaptionEditor();
    editor.addSegment(0, 3.1, 'Welcome to studio');
    const vtt = editor.exportVTT();

    expect(vtt).toContain('WEBVTT\n');
    expect(vtt).toContain('00:00:00.000 --> 00:00:03.100\nWelcome to studio');
  });

  it('auto-generates timestamped subtitle cues from script text', () => {
    const editor = new CaptionEditor();
    const script = '<p>Welcome to Teleprompter Studio Pro. Record high quality speeches easily.</p>';
    const segs = editor.generateFromScript(script, 120);

    expect(segs.length).toBe(2);
    expect(segs[0].text).toContain('Welcome to Teleprompter Studio Pro');
    expect(segs[0].startSec).toBe(0);
    expect(segs[0].endSec).toBeGreaterThan(0);
    expect(segs[1].startSec).toBeGreaterThanOrEqual(segs[0].endSec);
  });
});
