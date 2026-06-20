import type { SaveStore, SaveData } from './SaveStore'

const DB_NAME = 'gamepwa'
const STORE = 'save'
const KEY = 'state'
const VERSION = 1

/**
 * Persistencia local con IndexedDB (offline-first, sin dependencias).
 * Implementa SaveStore; reemplazable por un backend en el futuro.
 */
export class IndexedDBSaveStore implements SaveStore {
  private dbPromise?: Promise<IDBDatabase>

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION)
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE)
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }
    return this.dbPromise
  }

  async load(): Promise<SaveData | null> {
    try {
      const db = await this.open()
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
        req.onsuccess = () => resolve((req.result as SaveData) ?? null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return null // sin persistencia disponible: arrancar limpio
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // silencioso
    }
  }

  async save(data: SaveData): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(data, KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // silencioso: no romper el juego si falla el guardado
    }
  }
}
