"use client"

import React from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PublishedNarrative {
  id: string
  title: string
  narrative_text: string
  image_url: string | null
  internal_report_id: number | null
  published_at: string | null
  created_at: string
}

interface FetchParams {
  page: number
  search: string
}

interface FetchResponse {
  records: PublishedNarrative[]
  total: number
}

const PAGE_SIZE = 10

const fetchPublishedNarratives = async ({ page, search }: FetchParams): Promise<FetchResponse> => {
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from("narrative_reports")
    .select("id, title, narrative_text, image_url, internal_report_id, published_at, created_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to)

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`title.ilike.%${term}%,narrative_text.ilike.%${term}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message)
  }

  return {
    records: (data as PublishedNarrative[]) || [],
    total: count ?? 0,
  }
}

export default function IncidentPostsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = React.useState("")
  const deferredSearch = React.useDeferredValue(searchTerm)
  const [page, setPage] = React.useState(1)

  const { data, error, isLoading } = useSWR({ key: "incident-posts", page, search: deferredSearch }, () =>
    fetchPublishedNarratives({ page, search: deferredSearch }),
  )

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  React.useEffect(() => {
    setPage(1)
  }, [deferredSearch])

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">MDRRMO Incident Posts</h1>
            <p className="text-sm text-gray-600">Stay updated with the latest incident narratives from MDRRMO Bulan.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search incident posts..."
            className="pl-9 bg-white shadow-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading posts...
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to load incident posts: {error.message}
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No incident posts found.
          </div>
        ) : (
          <div className="space-y-6">
            {records.map((record) => (
              <Card key={record.id} className="overflow-hidden shadow-md">
                {record.image_url ? (
                  <div className="relative w-full overflow-hidden bg-gray-200">
                    <img
                      src={record.image_url}
                      alt={record.title}
                      className="w-full object-cover"
                      style={{ maxHeight: 280 }}
                    />
                  </div>
                ) : null}
                <CardHeader className="bg-white pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-semibold text-gray-900 break-words">
                      MDRRMO BULAN
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 border-orange-200 bg-orange-50 text-orange-700">
                      {record.internal_report_id ? `Report #${record.internal_report_id}` : "Incident"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {record.published_at
                      ? `Published ${formatDistanceToNow(new Date(record.published_at), { addSuffix: true })}`
                      : `Created ${formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}`}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 bg-white">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                    {record.narrative_text}
                  </p>
                  <div className="text-xs text-gray-500">
                    Last updated {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} disabled={isLoading} />

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push("/")} className="text-gray-700">
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

function PaginationControls({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button variant="outline" size="sm" disabled={disabled || !canPrev} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={disabled || !canNext} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}
