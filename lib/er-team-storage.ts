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

interface ErTeamDB extends DBSchema {
  drafts: {
    key: string
    value: ErTeamDraftRecord
  }
  references: {
    key: string
    value: ReferenceCacheRecord
  }
}

const DB_NAME = "mdrrmo_er_team"
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<ErTeamDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ErTeamDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("drafts")) {
          database.createObjectStore("drafts")
        }
        if (!database.objectStoreNames.contains("references")) {
          database.createObjectStore("references")
        }
      },
    })
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
