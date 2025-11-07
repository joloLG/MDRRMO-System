import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { ErTeamDraft, ReferenceOption } from "@/components/er-team/er-team-report-form"
import type { ErTeamDraftStatus } from "@/components/er-team/er-team-report-form"

interface ErTeamDraftRecord extends ErTeamDraft {
  status: ErTeamDraftStatus
}

interface ReferenceCacheRecord {
  key: string
  items: ReferenceOption[]
  cachedAt: string
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
const DB_VERSION = 3

let dbPromise: Promise<IDBPDatabase<ErTeamDB>> | null = null

async function deleteExistingDatabase(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return

  return new Promise((resolve, reject) => {
    const deleteRequest = window.indexedDB.deleteDatabase(DB_NAME)
    deleteRequest.onsuccess = () => {
      console.log('🗑️ Deleted existing IndexedDB database due to version conflict')
      resolve()
    }
    deleteRequest.onerror = () => {
      console.warn('Failed to delete existing database:', deleteRequest.error)
      reject(deleteRequest.error)
    }
    deleteRequest.onblocked = () => {
      console.warn('Database deletion blocked - please close other tabs')
      // Try to resolve anyway
      resolve()
    }
  })
}

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        return await openDB<ErTeamDB>(DB_NAME, DB_VERSION, {
          upgrade(database, oldVersion, newVersion, transaction) {
            console.log(`🔄 Upgrading IndexedDB from v${oldVersion} to v${newVersion}`)

            // Handle upgrades from older versions
            if (oldVersion < 3) {
              // Clear all existing data and recreate stores
              const storeNames = Array.from(database.objectStoreNames)
              storeNames.forEach(storeName => {
                database.deleteObjectStore(storeName)
              })

              // Recreate all stores
              if (!database.objectStoreNames.contains("drafts")) {
                database.createObjectStore("drafts")
              }
              if (!database.objectStoreNames.contains("references")) {
                database.createObjectStore("references")
              }
              if (!database.objectStoreNames.contains("assets")) {
                database.createObjectStore("assets")
              }
            }
          },
        })
      } catch (error: any) {
        console.error('❌ IndexedDB error:', error)

        // If it's a version error, try to delete and recreate the database
        if (error.name === 'VersionError' || error.message?.includes('version')) {
          console.log('🔄 Version conflict detected, attempting database reset...')
          await deleteExistingDatabase()

          // Reset the promise so it will try again
          dbPromise = null
          return getDb()
        }

        throw error
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
  await tx.store.put(draft, draft.clientDraftId)
  await tx.done
}

export async function upsertDrafts(drafts: ErTeamDraftRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction("drafts", "readwrite")
  for (const draft of drafts) {
    await tx.store.put(draft, draft.clientDraftId)
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

  // Reset the database promise to force recreation
  dbPromise = null

  // Delete the IndexedDB database completely
  await deleteExistingDatabase()

  // Clear any cached profile data
  if (typeof window !== "undefined") {
    const keysToRemove = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith("mdrrmo_er_team")) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key))
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
