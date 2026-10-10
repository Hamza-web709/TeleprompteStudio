import { db } from '../storage/db.js';
import { eventBus } from '../../state/eventBus.js';

class RecordingLibrary {
  async getAllRecordings() {
    return await db.getAll('recordings');
  }

  async deleteRecording(id) {
    await db.delete('recordings', id);
    eventBus.emit('recordings:updated');
  }

  downloadBlob(blob, filename = 'recording.webm') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export const recordingLibrary = new RecordingLibrary();
