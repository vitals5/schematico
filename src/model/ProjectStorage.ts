import { Project } from './types';
import { migrateLegacyData, readAppSetting, clearAppSetting } from './LegacyCompatibility';

export const STORAGE_KEY_LAST_PROJECT = 'schematico_last_project';
export const STORAGE_KEY_AUTOLOAD = 'schematico_autoload_last_project';

/**
 * Checks whether auto-loading the last project on startup is enabled.
 * Defaults to true unless explicitly disabled in application settings.
 */
export function isAutoLoadProjectEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const stored = readAppSetting('autoload_last_project');
  return stored !== 'false';
}

/**
 * Enables or disables auto-loading the last project on startup.
 */
export function setAutoLoadProjectEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_AUTOLOAD, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to save auto-load project preference:', err);
  }
}

/**
 * Saves the given project to persistent storage as the last active project.
 * Returns true if successfully saved, or false otherwise.
 */
export function saveLastProject(project: Project): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (!project || typeof project !== 'object' || !Array.isArray(project.pages) || project.pages.length === 0) {
      return false;
    }
    const jsonStr = JSON.stringify(project);
    localStorage.setItem(STORAGE_KEY_LAST_PROJECT, jsonStr);
    return true;
  } catch (err) {
    console.warn('Failed to save last project to localStorage:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Loads the last active project from persistent storage, if present and valid.
 * Returns null if no project is stored, autoload is disabled, or data is corrupt.
 */
export function loadLastProject(): Project | null {
  if (typeof localStorage === 'undefined') return null;
  if (!isAutoLoadProjectEnabled()) return null;

  try {
    const stored = readAppSetting('last_project');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return null;
    }

    const migrated = migrateLegacyData(parsed) as Project;
    if (!migrated.id || !migrated.name) {
      return null;
    }

    // Ensure activePageId points to an existing page
    if (!migrated.activePageId || !migrated.pages.some(p => p.id === migrated.activePageId)) {
      migrated.activePageId = migrated.pages[0].id;
    }

    return migrated;
  } catch (err) {
    console.warn('Failed to load last project from localStorage:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Clears the stored last project from persistent storage.
 */
export function clearLastProject(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    clearAppSetting('last_project');
  } catch (err) {
    console.warn('Failed to clear last project from localStorage:', err);
  }
}
