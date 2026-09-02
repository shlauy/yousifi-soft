import { registerPlugin } from '@capacitor/core';

export type BackupDirectoryEntry = {
  name: string;
  uri: string;
  modifiedAt: number;
  size: number;
};

export interface BackupDirectoryPlugin {
  pickDirectory(): Promise<{ uri: string; name: string }>;
  saveFile(options: { data: string; suggestedName: string }): Promise<{ uri: string; name: string }>;
  writeFile(options: { uri: string; name: string; data: string }): Promise<{ uri: string; name: string }>;
  readFile(options: { uri: string; name: string }): Promise<{ data: string }>;
  listFiles(options: { uri: string }): Promise<{ files: BackupDirectoryEntry[] }>;
  deleteFile(options: { uri: string; name: string }): Promise<void>;
}

export const BackupDirectory = registerPlugin<BackupDirectoryPlugin>('BackupDirectory');