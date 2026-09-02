import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { BackupDirectory } from './backup-directory';

const WEB_BACKUP_KEY = 'alyousifi-soft-automatic-backup';
const WEB_BACKUP_PREFIX = `${WEB_BACKUP_KEY}:`;
const WEB_HANDLE_DATABASE = 'alyousifi-soft-backup-directory';
const WEB_HANDLE_STORE = 'handles';
const WEB_HANDLE_KEY = 'automatic';
const NATIVE_BACKUP_PATH = 'alyousifi/backups';
const BACKUP_FILE_PATTERN = /^yousifi_auto_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(?:-\d{2})?\.json$/;

type WebFileHandle = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

type WebDirectoryHandle = {
  kind: 'directory';
  name: string;
  queryPermission?: (options: { mode: 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
  requestPermission?: (options: { mode: 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WebFileHandle>;
  removeEntry?: (name: string) => Promise<void>;
  values: () => AsyncIterableIterator<WebFileHandle | WebDirectoryHandle>;
};

type PickerWindow = Window & {
  showDirectoryPicker?: () => Promise<WebDirectoryHandle>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<WebFileHandle>;
};

type BackupEntry = { name: string; modifiedAt: number };

export type BackupSettings = {
  autoBackupDirectory?: string | null;
  autoBackupDirectoryName?: string | null;
  maxAutoBackups?: number;
};

export type SelectedBackupDirectory = {
  path: string;
  name: string;
};

export type AutomaticBackupResult = 'native' | 'native-custom' | 'web' | 'web-custom';

const pad = (value: number) => String(value).padStart(2, '0');

export function isUserCancellation(error: unknown) {
  if (!error) return false;
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = String(candidate.name ?? '');
  const code = String(candidate.code ?? '');
  const message = String(candidate.message ?? error);
  return name === 'AbortError'
    || code.toUpperCase().includes('CANCEL')
    || message.toUpperCase().includes('ABORT')
    || message.toUpperCase().includes('CANCEL');
}

function backupFileName(date = new Date()) {
  return `yousifi_auto_backup_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`;
}

function maximumBackups(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  return Math.min(1000, Math.max(1, Math.floor(value as number)));
}

function isBackupFile(name: string) {
  return BACKUP_FILE_PATTERN.test(name);
}

function sortNewestFirst(entries: BackupEntry[]) {
  return [...entries].sort((a, b) => b.modifiedAt - a.modifiedAt || b.name.localeCompare(a.name));
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('WEB_DIRECTORY_STORAGE_UNAVAILABLE'));
      return;
    }
    const request = window.indexedDB.open(WEB_HANDLE_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(WEB_HANDLE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('WEB_DIRECTORY_STORAGE_UNAVAILABLE'));
  });
}

async function storeWebDirectory(handle: WebDirectoryHandle) {
  const database = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WEB_HANDLE_STORE, 'readwrite');
    transaction.objectStore(WEB_HANDLE_STORE).put(handle, WEB_HANDLE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('WEB_DIRECTORY_STORAGE_FAILED'));
  });
  database.close();
}

async function loadWebDirectory(requestPermission = false) {
  const database = await openHandleDatabase();
  const handle = await new Promise<WebDirectoryHandle | null>((resolve, reject) => {
    const request = database.transaction(WEB_HANDLE_STORE, 'readonly').objectStore(WEB_HANDLE_STORE).get(WEB_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as WebDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('WEB_DIRECTORY_STORAGE_FAILED'));
  });
  database.close();
  if (!handle) return null;
  const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'granted';
  if (permission === 'prompt' && requestPermission && handle.requestPermission) {
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    if (requested !== 'granted') throw new Error('BACKUP_DIRECTORY_PERMISSION_DENIED');
  } else if (permission !== 'granted') {
    throw new Error('BACKUP_DIRECTORY_PERMISSION_DENIED');
  }
  return handle;
}

async function clearWebDirectory() {
  if (!window.indexedDB) return;
  const database = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WEB_HANDLE_STORE, 'readwrite');
    transaction.objectStore(WEB_HANDLE_STORE).delete(WEB_HANDLE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('WEB_DIRECTORY_STORAGE_FAILED'));
  });
  database.close();
}

async function getWebCustomDirectory(requestPermission = false) {
  const handle = await loadWebDirectory(requestPermission);
  if (!handle) return null;
  return handle;
}

async function listWebDirectory(handle: WebDirectoryHandle): Promise<BackupEntry[]> {
  const entries: BackupEntry[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !isBackupFile(entry.name)) continue;
    const file = await entry.getFile();
    entries.push({ name: entry.name, modifiedAt: file.lastModified });
  }
  return entries;
}

async function writeWebFile(handle: WebDirectoryHandle, name: string, data: string) {
  const file = await handle.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(data);
  await writable.close();
}

async function readWebFile(handle: WebDirectoryHandle, name: string) {
  const file = await handle.getFileHandle(name);
  return file.getFile().then((value) => value.text());
}

async function rotateNativeCustomDirectory(uri: string, keep: number) {
  const files = (await BackupDirectory.listFiles({ uri })).files
    .filter((file) => isBackupFile(file.name))
    .map((file) => ({ name: file.name, modifiedAt: file.modifiedAt }));
  const stale = sortNewestFirst(files).slice(keep);
  await Promise.all(stale.map((file) => BackupDirectory.deleteFile({ uri, name: file.name })));
}

async function rotateNativeDefaultDirectory(keep: number) {
  let files: BackupEntry[];
  try {
    files = (await Filesystem.readdir({ path: NATIVE_BACKUP_PATH, directory: Directory.Data })).files
      .filter((file) => file.type === 'file' && isBackupFile(file.name))
      .map((file) => ({ name: file.name, modifiedAt: file.mtime }));
  } catch {
    return;
  }
  const stale = sortNewestFirst(files).slice(keep);
  await Promise.all(stale.map((file) => Filesystem.deleteFile({ path: `${NATIVE_BACKUP_PATH}/${file.name}`, directory: Directory.Data })));
}

function listWebLocalBackups() {
  const files: BackupEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(WEB_BACKUP_PREFIX)) continue;
    const name = key.slice(WEB_BACKUP_PREFIX.length);
    if (!isBackupFile(name)) continue;
    const raw = window.localStorage.getItem(key);
    let modifiedAt = 0;
    try {
      modifiedAt = raw ? Date.parse((JSON.parse(raw) as { exportedAt?: string }).exportedAt ?? '') : 0;
    } catch {
      modifiedAt = 0;
    }
    files.push({ name, modifiedAt });
  }
  return files;
}

function rotateWebLocalBackups(keep: number) {
  sortNewestFirst(listWebLocalBackups()).slice(keep).forEach((file) => {
    window.localStorage.removeItem(`${WEB_BACKUP_PREFIX}${file.name}`);
  });
}

export async function chooseAutomaticBackupDirectory(): Promise<SelectedBackupDirectory> {
  if (Capacitor.isNativePlatform()) {
    const selected = await BackupDirectory.pickDirectory();
    return { path: selected.uri, name: selected.name };
  }

  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('BACKUP_DIRECTORY_PICKER_UNAVAILABLE');
  const handle = await picker();
  if (handle.requestPermission) {
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('BACKUP_DIRECTORY_PERMISSION_DENIED');
  }
  await storeWebDirectory(handle);
  return { path: `web:${handle.name}`, name: handle.name };
}

export async function clearAutomaticBackupDirectory() {
  if (!Capacitor.isNativePlatform()) await clearWebDirectory();
}

export function backupDirectoryLabel(settings: BackupSettings) {
  if (!settings.autoBackupDirectory) return 'مجلد التطبيق (افتراضياً)';
  return settings.autoBackupDirectoryName ?? settings.autoBackupDirectory;
}

export async function saveAutomaticBackup(
  data: unknown,
  schemaVersion: number,
  settings: BackupSettings = {},
): Promise<AutomaticBackupResult> {
  const payload = JSON.stringify({
    schemaVersion,
    exportedAt: new Date().toISOString(),
    data,
  });
  const name = backupFileName();
  const keep = maximumBackups(settings.maxAutoBackups);
  const customDirectory = settings.autoBackupDirectory;

  if (Capacitor.isNativePlatform()) {
    if (customDirectory) {
      await BackupDirectory.writeFile({ uri: customDirectory, name, data: payload });
      await rotateNativeCustomDirectory(customDirectory, keep);
      return 'native-custom';
    }
    await Filesystem.writeFile({
      path: `${NATIVE_BACKUP_PATH}/${name}`,
      directory: Directory.Data,
      data: payload,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await rotateNativeDefaultDirectory(keep);
    return 'native';
  }

  if (customDirectory) {
    const handle = await getWebCustomDirectory(true);
    if (!handle) throw new Error('BACKUP_DIRECTORY_NOT_FOUND');
    await writeWebFile(handle, name, payload);
    const stale = sortNewestFirst(await listWebDirectory(handle)).slice(keep);
    if (stale.length && !handle.removeEntry) throw new Error('WEB_DIRECTORY_ROTATION_UNAVAILABLE');
    await Promise.all(stale.map((file) => handle.removeEntry?.(file.name)));
    return 'web-custom';
  }

  window.localStorage.setItem(`${WEB_BACKUP_PREFIX}${name}`, payload);
  rotateWebLocalBackups(keep);
  return 'web';
}

export async function restoreLatestAutomaticBackup(settings: BackupSettings = {}) {
  const customDirectory = settings.autoBackupDirectory;

  if (Capacitor.isNativePlatform()) {
    if (customDirectory) {
      const files = sortNewestFirst((await BackupDirectory.listFiles({ uri: customDirectory })).files
        .filter((file) => isBackupFile(file.name))
        .map((file) => ({ name: file.name, modifiedAt: file.modifiedAt })));
      if (!files.length) return null;
      const result = await BackupDirectory.readFile({ uri: customDirectory, name: files[0].name });
      return JSON.parse(result.data);
    }

    try {
      const files = sortNewestFirst((await Filesystem.readdir({ path: NATIVE_BACKUP_PATH, directory: Directory.Data })).files
        .filter((file) => file.type === 'file' && isBackupFile(file.name))
        .map((file) => ({ name: file.name, modifiedAt: file.mtime })));
      if (files.length) {
        const result = await Filesystem.readFile({ path: `${NATIVE_BACKUP_PATH}/${files[0].name}`, directory: Directory.Data, encoding: Encoding.UTF8 });
        return JSON.parse(result.data as string);
      }
      const legacy = await Filesystem.readFile({ path: `${NATIVE_BACKUP_PATH}/latest.json`, directory: Directory.Data, encoding: Encoding.UTF8 });
      return JSON.parse(legacy.data as string);
    } catch {
      return null;
    }
  }

  if (customDirectory) {
    const handle = await getWebCustomDirectory();
    if (!handle) return null;
    const files = sortNewestFirst(await listWebDirectory(handle));
    if (!files.length) return null;
    return JSON.parse(await readWebFile(handle, files[0].name));
  }

  const files = sortNewestFirst(listWebLocalBackups());
  if (files.length) {
    const raw = window.localStorage.getItem(`${WEB_BACKUP_PREFIX}${files[0].name}`);
    if (raw) return JSON.parse(raw);
  }
  const legacy = window.localStorage.getItem(WEB_BACKUP_KEY);
  return legacy ? JSON.parse(legacy) : null;
}

export async function exportManualBackup(data: string, suggestedName: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      await BackupDirectory.saveFile({ data, suggestedName });
      return 'native';
    }

    const picker = (window as PickerWindow).showSaveFilePicker;
    if (picker) {
      const file = await picker({
        suggestedName,
        types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
      return 'web-picker';
    }

    const blob = new Blob([data], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = suggestedName;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    return 'web-download';
  } catch (error) {
    if (isUserCancellation(error)) return 'cancelled';
    throw error;
  }
}