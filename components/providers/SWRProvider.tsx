"use client"

import React from 'react'
import { SWRConfig } from 'swr'

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 1000,
        provider: () => new Map(),
      }}
    >
      {children}
    </SWRConfig>
  )
}
