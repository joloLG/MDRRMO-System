export const saveToCache = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cacheData = {
      data,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem(`er-cache-${key}`, JSON.stringify(cacheData))
  } catch (error) {
    console.error(`Failed to save ${key} to cache:`, error)
  }
}

export const loadFromCache = async <T,>(key: string, maxAgeMinutes = 60): Promise<T | null> => {
  try {
    const cached = localStorage.getItem(`er-cache-${key}`)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const cacheDate = new Date(timestamp)
    const now = new Date()
    const diffMinutes = (now.getTime() - cacheDate.getTime()) / (1000 * 60)

    if (diffMinutes > maxAgeMinutes) {
      console.log(`Cache for ${key} is stale (${diffMinutes.toFixed(1)} minutes old)`)
      return null
    }

    return data as T
  } catch (error) {
    console.error(`Failed to load ${key} from cache:`, error)
    return null
  }
}

export const clearCache = (key: string): void => {
  try {
    localStorage.removeItem(`er-cache-${key}`)
  } catch (error) {
    console.error(`Failed to clear cache for ${key}:`, error)
  }
}

export const clearAllCache = (): void => {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('er-cache-')) {
        localStorage.removeItem(key)
      }
    })
    console.log('✅ All ER team cache cleared')
  } catch (error) {
    console.error('Failed to clear all cache:', error)
  }
}
