"use client"

import React, { useCallback } from 'react'
import { SWRConfig, Cache } from 'swr'

// Cache provider that handles both memory and session storage for better offline support
const createCacheProvider = (): Cache<any> => {
  const map = new Map<string, any>()
  
  // Try to load from sessionStorage on initial load
  if (typeof window !== 'undefined') {
    try {
      const cacheKey = 'mdrrmo-swr-cache-v2'
      const cacheData = sessionStorage.getItem(cacheKey)
      if (cacheData) {
        const parsed = JSON.parse(cacheData) as Record<string, any>
        for (const [key, value] of Object.entries(parsed)) {
          map.set(key, value)
        }
      }
      
      // Save to sessionStorage on unload
      const saveCache = () => {
        const cache: Record<string, any> = {}
        map.forEach((value, key) => {
          cache[key] = value
        })
        sessionStorage.setItem(cacheKey, JSON.stringify(cache))
      }
      
      window.addEventListener('beforeunload', saveCache)
    } catch (error) {
      console.warn('Failed to initialize SWR cache from sessionStorage', error)
    }
  }
  
  return map as unknown as Cache<any>
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  // Create a stable reference to the provider
  const provider = useCallback(() => {
    const cache = createCacheProvider()
    
    // Add a method to clear the cache
    const clearCache = () => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('mdrrmo-swr-cache-v2')
        } catch (error) {
          console.warn('Failed to clear SWR cache', error)
        }
      }
      return cache
    }
    
    // Add clear method to the cache
    return Object.assign(cache, { clear: clearCache })
  }, [])

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true, // Enable revalidation on focus
        revalidateOnReconnect: true,
        revalidateIfStale: true, // Revalidate if data is stale
        revalidateOnMount: true, // Always revalidate when component mounts
        refreshInterval: 30000, // Refresh every 30 seconds when focused
        dedupingInterval: 10000, // Increase deduping interval to 10s
        errorRetryCount: 3, // Retry failed requests up to 3 times
        errorRetryInterval: 5000, // Wait 5 seconds between retries
        provider,
        onError: (error: any, key: string) => {
          console.error('SWR Error:', { key, error })
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
