import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

const LOCAL_STORAGE_KEY = 'alyousifi-soft-state';
const INDEXED_DB_NAME = 'alyousifi-soft-local';
const INDEXED_DB_VERSION = 2;
const INDEXED_DB_STORE = 'app-state';
const SQLITE_DATABASE = 'alyousifi_soft';

type StoredEnvelope<T> = {
  schemaVersion: number;
  savedAt: string;
  data: T;
};

let nativeDatabase: Promise<SQLiteDBConnection> | null = null;

function warnStorageFailure(message: string, error: unknown) {
  console.warn(`[اليوسفي سوفت] ${message}`, error);
}

function parseStored<T>(raw: string | null): StoredEnvelope<T> | T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredEnvelope<T> | T;
  } catch (error) {
    warnStorageFailure('تعذر قراءة البيانات المحلية، سيتم استخدام آخر مصدر متاح.', error);
    return null;
  }
}

async function openNativeDatabase(): Promise<SQLiteDBConnection> {
  if (nativeDatabase) return nativeDatabase;
  nativeDatabase = (async () => {
    const connection = new SQLiteConnection(CapacitorSQLite);
    let database: SQLiteDBConnection;
    try {
      database = await connection.retrieveConnection(SQLITE_DATABASE, false);
    } catch {
      database = await connection.createConnection(
        SQLITE_DATABASE,
        false,
        'no-encryption',
        1,
        false,
      );
    }
    await database.open();
    await database.execute(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY NOT NULL,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return database;
  })().catch((error) => {
    nativeDatabase = null;
    throw error;
  });
  return nativeDatabase;
}

async function readNative<T>(): Promise<StoredEnvelope<T> | T | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const database = await openNativeDatabase();
  const result = await database.query(
    'SELECT payload FROM app_state WHERE id = ? LIMIT 1',
    ['current'],
  );
  return parseStored<T>(result.values?.[0]?.payload ?? null);
}

async function writeNative<T>(envelope: StoredEnvelope<T>) {
  if (!Capacitor.isNativePlatform()) return;
  const database = await openNativeDatabase();
  await database.run(
    `INSERT INTO app_state (id, schema_version, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       schema_version = excluded.schema_version,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    ['current', envelope.schemaVersion, JSON.stringify(envelope), envelope.savedAt],
  );
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(INDEXED_DB_STORE)) {
        request.result.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function readIndexedDb<T>(): Promise<StoredEnvelope<T> | T | null> {
  const database = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXED_DB_STORE, 'readonly');
    const request = transaction.objectStore(INDEXED_DB_STORE).get('current');
    request.onsuccess = () => {
      database.close();
      resolve(parseStored<T>(typeof request.result === 'string' ? request.result : null));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('IndexedDB read failed'));
    };
  });
}

async function writeIndexedDb(envelope: StoredEnvelope<unknown>) {
  const database = await openIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(INDEXED_DB_STORE, 'readwrite');
    transaction.objectStore(INDEXED_DB_STORE).put(JSON.stringify(envelope), 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'));
  }).finally(() => database.close());
}

export class LocalDataService {
  async load<T>(): Promise<StoredEnvelope<T> | T | null> {
    try {
      const nativeValue = await readNative<T>();
      if (nativeValue) return nativeValue;
    } catch (error) {
      warnStorageFailure('SQLite غير متاح حالياً، سيتم استخدام التخزين المحلي للويب.', error);
    }

    try {
      const indexedValue = await readIndexedDb<T>();
      if (indexedValue) return indexedValue;
    } catch (error) {
      warnStorageFailure('تعذر قراءة IndexedDB، سيتم استخدام LocalStorage.', error);
    }

    return parseStored<T>(localStorage.getItem(LOCAL_STORAGE_KEY));
  }

  async save<T>(data: T, schemaVersion: number) {
    const envelope: StoredEnvelope<T> = {
      schemaVersion,
      savedAt: new Date().toISOString(),
      data,
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(envelope);
    } catch (error) {
      warnStorageFailure('تعذر تجهيز البيانات المحلية للحفظ.', error);
      return;
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    } catch (error) {
      warnStorageFailure('LocalStorage غير متاح، ستبقى البيانات في SQLite أو الذاكرة.', error);
    }

    try {
      await writeIndexedDb(envelope);
    } catch (error) {
      warnStorageFailure('تعذر تحديث IndexedDB.', error);
    }

    try {
      await writeNative(envelope);
    } catch (error) {
      warnStorageFailure('تعذر تحديث SQLite، لكن نسخة الويب المحلية ما زالت محفوظة.', error);
    }
  }
}

export const localDataService = new LocalDataService();