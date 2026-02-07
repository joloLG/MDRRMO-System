"use client"

import { cn } from "@/lib/utils"

interface SkeletonLoaderProps {
  className?: string
}

export function SkeletonCard({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse", className)}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gray-300"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 rounded w-full"></div>
          <div className="h-3 bg-gray-300 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonSummaryCard({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-300"></div>
        <div className="h-8 w-16 bg-gray-300 rounded"></div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-300 rounded w-2/3"></div>
        <div className="h-2 bg-gray-300 rounded w-full"></div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3, className }: SkeletonLoaderProps & { count?: number }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonIncidentCard({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("rounded-xl border-2 border-gray-200 bg-white p-4 animate-pulse", className)}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-300"></div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-10 h-10 rounded-lg bg-gray-300"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
        <div className="w-16 h-6 bg-gray-300 rounded-full"></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="h-3 bg-gray-300 rounded"></div>
        <div className="h-3 bg-gray-300 rounded"></div>
        <div className="h-3 bg-gray-300 rounded sm:col-span-2"></div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="flex-1 h-8 bg-gray-300 rounded"></div>
        <div className="flex-1 h-8 bg-gray-300 rounded"></div>
        <div className="flex-1 h-8 bg-gray-300 rounded"></div>
      </div>
    </div>
  )
}

export function SkeletonIncidentsList({ className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {[1, 2, 3].map((i) => (
        <SkeletonIncidentCard key={i} />
      ))}
    </div>
  )
}
