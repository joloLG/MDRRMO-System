import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { ErTeamDraft, ReferenceOption } from "@/components/er-team/er-team-report-form"
import type { ErTeamDraftStatus } from "@/components/er-team/er-team-report-form"

interface ErTeamDraftRecord extends ErTeamDraft {
  status: ErTeamDraftStatus
}

interface ReferenceCacheRecord {
  key: string
  items?: ReferenceOption[]
  cachedAt?: string
  data?: any
  timestamp?: string
  expiresAt?: string
  version?: string
}

interface AssetCacheRecord {
  key: string
  content: string
  contentType: string
  cachedAt: string
}

interface ErTeamDB extends DBSchema {
  drafts: {
    key: string
    value: ErTeamDraftRecord
  }
  references: {
    key: string
    value: ReferenceCacheRecord
  }
  assets: {
    key: string
    value: AssetCacheRecord
  }
}

const DB_NAME = "mdrrmo_er_team"
const DB_VERSION = 2 // Incremented version to force DB upgrade
const CACHE_VERSION = 'v2' // Cache version for manual invalidation

let dbPromise: Promise<IDBPDatabase<ErTeamDB>> | null = null

async function deleteExistingDatabase(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return

  return new Promise((resolve) => {
    const deleteRequest = window.indexedDB.deleteDatabase(DB_NAME)
    deleteRequest.onsuccess = () => {
      console.log('🗑️ Deleted existing IndexedDB database')
      resolve()
    }
    deleteRequest.onerror = () => {
      console.warn('Failed to delete existing database:', deleteRequest.error)
      resolve() // Resolve anyway to prevent blocking the app
    }
    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked - please close other tabs')
      resolve()
    }
  })
}

// Clear old caches when updating versions
async function clearOldCaches() {
  try {
    const keys = await caches.keys()
    for (const key of keys) {
      if (key.startsWith('er-team-') && !key.includes(CACHE_VERSION)) {
        await caches.delete(key)
      }
    }
    console.log('🧹 Cleared old caches')
  } catch (error) {
    console.error('Error clearing old caches:', error)
  }
}

function getDb(): Promise<IDBPDatabase<ErTeamDB>> {
  if (!dbPromise) {
    dbPromise = (async (): Promise<IDBPDatabase<ErTeamDB>> => {
      try {
        // Clear old caches when initializing
        if (typeof window !== 'undefined' && 'caches' in window) {
          await clearOldCaches()
        }

        return await openDB<ErTeamDB>(DB_NAME, DB_VERSION, {
          upgrade(database, oldVersion) {
            console.log(`🔄 Upgrading database from version ${oldVersion} to ${DB_VERSION}`)
            
            // Create or update stores
            if (!database.objectStoreNames.contains("drafts")) {
              database.createObjectStore("drafts", { keyPath: 'clientDraftId' })
            }
            if (!database.objectStoreNames.contains("references")) {
              database.createObjectStore("references")
            }
            if (!database.objectStoreNames.contains("assets")) {
              database.createObjectStore("assets")
            }

            // Add any new indexes or migrations here based on oldVersion
            if (oldVersion < 2) {
              // Migration code for version 2
              console.log('Running migration to v2')
              // Recreate drafts store with keyPath
              if (database.objectStoreNames.contains('drafts')) {
                database.deleteObjectStore('drafts')
              }
              database.createObjectStore('drafts', { keyPath: 'clientDraftId' })
            }
          },
        })
      } catch (error: any) {
        console.error('❌ IndexedDB error:', error)
        
        // On any error, try to delete and recreate the database
        console.log('🔄 Database error detected, attempting reset...')
        await deleteExistingDatabase()
        
        // Reset the promise so it will try again
        dbPromise = null
        return getDb()
      }
    })()
  }
  return dbPromise
}

export async function loadDrafts(): Promise<ErTeamDraftRecord[]> {
  const db = await getDb()
  return db.getAll("drafts")
}

export async function upsertDraft(draft: ErTeamDraftRecord): Promise<void> {
  const db = await getDb()
  const tx = db.transaction("drafts", "readwrite")
  await tx.store.put(draft)
  await tx.done
}

export async function upsertDrafts(drafts: ErTeamDraftRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction("drafts", "readwrite")
  for (const draft of drafts) {
    await tx.store.put(draft)
  }
  await tx.done
}

export async function removeDraft(draftId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction("drafts", "readwrite")
  await tx.store.delete(draftId)
  await tx.done
}

export async function saveReference(key: string, items: ReferenceOption[]): Promise<void> {
  const db = await getDb()
  const record: ReferenceCacheRecord = {
    key,
    items,
    cachedAt: new Date().toISOString(),
  }
  const tx = db.transaction("references", "readwrite")
  await tx.store.put(record, key)
  await tx.done
}

export async function loadReference(key: string): Promise<ReferenceCacheRecord | undefined> {
  const db = await getDb()
  return db.get("references", key)
}

export async function clearReferences(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction("references", "readwrite")
  await tx.store.clear()
  await tx.done
}

export async function saveAsset(key: string, content: string, contentType: string): Promise<void> {
  const db = await getDb()
  const record: AssetCacheRecord = {
    key,
    content,
    contentType,
    cachedAt: new Date().toISOString(),
  }
  const tx = db.transaction("assets", "readwrite")
  await tx.store.put(record, key)
  await tx.done
}

export async function clearAllData(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(["drafts", "references", "assets"], "readwrite")
  await Promise.all([
    tx.objectStore("drafts").clear(),
    tx.objectStore("references").clear(),
    tx.objectStore("assets").clear(),
  ])
  await tx.done
}

export async function forceRefreshData(): Promise<void> {
  console.log('🧹 Force refreshing all data...')
  
  // Reset the database
  dbPromise = null
  await deleteExistingDatabase()
  
  // Clear related localStorage entries
  if (typeof window !== "undefined") {
    const prefix = "mdrrmo_er_team"
    const keys = Array.from({ length: window.localStorage.length }, (_, i) => 
      window.localStorage.key(i)
    ).filter((key): key is string => key?.startsWith(prefix) ?? false)
    
    keys.forEach(key => window.localStorage.removeItem(key))
    console.log('🗑️ Cleared localStorage cache')
  }
  
  console.log('✅ Force refresh complete')
}

export async function getCacheTimestamp(): Promise<string | null> {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem("mdrrmo_er_team_cache_timestamp")
  } catch {
    return null
  }
}

export async function setCacheTimestamp(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem("mdrrmo_er_team_cache_timestamp", new Date().toISOString())
  } catch {
    // Ignore localStorage errors
  }
}

export async function shouldForceRefresh(maxAgeMinutes: number = 5): Promise<boolean> {
  const cacheTimestamp = await getCacheTimestamp()
  if (!cacheTimestamp) return true

  const cacheTime = new Date(cacheTimestamp).getTime()
  const now = new Date().getTime()
  const maxAgeMs = maxAgeMinutes * 60 * 1000

  return (now - cacheTime) > maxAgeMs
}

export async function loadDraftsWithCacheCheck(): Promise<{ drafts: ErTeamDraftRecord[], isStale: boolean }> {
  const isStale = await shouldForceRefresh(10) // 10 minutes for drafts
  const drafts = await loadDrafts()
  return { drafts, isStale }
}

export async function loadReferenceWithCacheCheck(key: string): Promise<{ data: ReferenceCacheRecord | undefined, isStale: boolean }> {
  const isStale = await shouldForceRefresh(30) // 30 minutes for references
  const data = await loadReference(key)
  return { data, isStale }
}

export async function loadAsset(key: string): Promise<AssetCacheRecord | undefined> {
  const db = await getDb()
  return db.get("assets", key)
}

export async function saveToCache<T>(key: string, data: T, options: { maxAgeMinutes?: number } = {}): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction("references", "readwrite");
    const timestamp = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (options.maxAgeMinutes || 5)); // Default 5 minutes TTL
    
    const record = {
      key: `${CACHE_VERSION}_${key}`,
      data,
      timestamp,
      expiresAt: expiresAt.toISOString(),
      version: CACHE_VERSION
    };
    
    await tx.store.put(record, key);
    await tx.done;
    
    // Also store in session storage for faster access
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`cache_${CACHE_VERSION}_${key}`, JSON.stringify({
          data,
          timestamp,
          expiresAt: expiresAt.toISOString()
        }));
      } catch (e) {
        console.warn('Session storage quota exceeded, falling back to IndexedDB only');
      }
    }
  } catch (error) {
    console.error(`Failed to save ${key} to cache:`, error);
    // If IndexedDB fails, try to clear the database
    try {
      await forceRefreshData();
    } catch (e) {
      console.error('Failed to refresh data after cache error:', e);
    }
  }
}

export async function loadFromCache<T>(key: string, maxAgeMinutes = 5): Promise<T | null> {
  // First try sessionStorage for faster access
  if (typeof sessionStorage !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(`cache_${CACHE_VERSION}_${key}`);
      if (cached) {
        const { data, expiresAt } = JSON.parse(cached);
        if (new Date(expiresAt) > new Date()) {
          return data;
        }
        // If expired, remove from sessionStorage
        sessionStorage.removeItem(`cache_${CACHE_VERSION}_${key}`);
      }
    } catch (e) {
      console.warn('Error reading from sessionStorage:', e);
    }
  }

  // Fall back to IndexedDB
  try {
    const db = await getDb();
    const record = await db.get("references", `${CACHE_VERSION}_${key}`);
    
    if (!record) return null;
    
    // Check if record is expired
    const now = new Date();
    const recordTimestamp = record.timestamp || record.cachedAt || new Date(0).toISOString();
    const recordExpiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
    
    // Calculate record age in minutes
    const recordAge = (now.getTime() - new Date(recordTimestamp).getTime()) / (1000 * 60);
    
    // Check if record is expired based on either expiresAt or maxAgeMinutes
    const isExpired = (recordExpiresAt && recordExpiresAt < now) || 
                     (!recordExpiresAt && recordAge > maxAgeMinutes);
    
    if (isExpired) {
      console.log(`Cache entry ${key} is stale or expired (${recordAge.toFixed(1)} minutes old)`);
      return null;
    }
    
    return record.data;
  } catch (error) {
    console.error(`Failed to load ${key} from cache:`, error);
    return null;
  }
}
