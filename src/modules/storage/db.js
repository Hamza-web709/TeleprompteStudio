/**
 * IndexedDB Database Layer with Schema Migrations
 */
const DB_NAME = 'TeleprompterStudioDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Scripts Store
        if (!db.objectStoreNames.contains('scripts')) {
          const scriptStore = db.createObjectStore('scripts', { keyPath: 'id' });
          scriptStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          scriptStore.createIndex('title', 'title', { unique: false });
          scriptStore.createIndex('folder', 'folder', { unique: false });
          scriptStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        }

        // Folders Store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('name', 'name', { unique: true });
        }

        // Presets Store
        if (!db.objectStoreNames.contains('presets')) {
          const presetStore = db.createObjectStore('presets', { keyPath: 'id' });
          presetStore.createIndex('name', 'name', { unique: false });
        }

        // Rehearsals Store
        if (!db.objectStoreNames.contains('rehearsals')) {
          const rehearsalStore = db.createObjectStore('rehearsals', { keyPath: 'id' });
          rehearsalStore.createIndex('scriptId', 'scriptId', { unique: false });
          rehearsalStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Recordings Metadata Store
        if (!db.objectStoreNames.contains('recordings')) {
          const recordingStore = db.createObjectStore('recordings', { keyPath: 'id' });
          recordingStore.createIndex('scriptId', 'scriptId', { unique: false });
          recordingStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Global Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Connection error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, item) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new Database();
