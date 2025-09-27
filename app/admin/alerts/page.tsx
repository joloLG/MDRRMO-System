"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Trash2, Play, CheckCircle2, UploadCloud, RefreshCw, ArrowLeft } from "lucide-react"

interface FileEntry {
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: any
}

export default function AlertManagementPage() {
  const router = useRouter()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [uploading, setUploading] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: list, error: listError } = await supabase
        .storage
        .from('alert_sounds')
        .list('', { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } })
      if (listError) throw listError

      setFiles(list as FileEntry[])

      // Load active setting
      const { data: settingsData, error: settingsError } = await supabase
        .from('alert_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (settingsError) {
        // If "no rows" it's fine; otherwise show error
        if ((settingsError as any).code !== 'PGRST116') {
          console.warn('Error loading alert settings:', settingsError)
        }
      } else if (settingsData && settingsData.length > 0) {
        setActiveFilePath(settingsData[0].active_file_path)
      } else {
        setActiveFilePath(null)
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshList()
    const channel = supabase
      .channel('alert-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_settings' }, () => {
        refreshList()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshList])

  const onUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0]
    if (!file) return
    setMessage(null)
    setError(null)

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !['mp3', 'wav'].includes(fileExt)) {
      setError('Only .mp3 or .wav files are allowed.')
      return
    }

    setUploading(true)
    try {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `admin-${timestamp}-${safeName}`

      const { error: uploadError } = await supabase
        .storage
        .from('alert_sounds')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || (fileExt === 'mp3' ? 'audio/mpeg' : 'audio/wav')
        })
      if (uploadError) throw uploadError

      setMessage('File uploaded successfully.')
      await refreshList()
    } catch (e: any) {
      console.error('Upload error:', e)
      setError(e.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      if (evt.target) evt.target.value = ''
    }
  }

  const setActive = async (name: string) => {
    setError(null)
    setMessage(null)
    try {
      // Check if row exists
      const { data: settingsData, error: settingsError } = await supabase
        .from('alert_settings')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)

      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id || null

      if (settingsError && (settingsError as any).code !== 'PGRST116') {
        throw settingsError
      }

      if (settingsData && settingsData.length > 0) {
        const id = settingsData[0].id
        const { error: updateError } = await supabase
          .from('alert_settings')
          .update({ active_file_path: name, updated_by: userId, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('alert_settings')
          .insert({ active_file_path: name, updated_by: userId, updated_at: new Date().toISOString() })
        if (insertError) throw insertError
      }
      setMessage('Active alert sound updated.')
      await refreshList()
    } catch (e: any) {
      console.error('Set active error:', e)
      setError(e.message || 'Failed to set active alert sound')
    }
  }

  const onDelete = async (name: string) => {
    setError(null)
    setMessage(null)
    try {
      if (name === activeFilePath) {
        setError('Cannot delete the currently active alert sound. Set a different active sound first.')
        return
      }
      const { error: delError } = await supabase
        .storage
        .from('alert_sounds')
        .remove([name])
      if (delError) throw delError
      setMessage('File deleted.')
      await refreshList()
    } catch (e: any) {
      console.error('Delete error:', e)
      setError(e.message || 'Failed to delete file')
    }
  }

  const onPreview = async (name: string) => {
    setPreviewing(name)
    try {
      const { data, error: urlError } = await supabase
        .storage
        .from('alert_sounds')
        .createSignedUrl(name, 60)
      if (urlError || !data?.signedUrl) throw urlError || new Error('Unable to create signed URL')
      const audio = new Audio(data.signedUrl)
      await audio.play().catch(err => {
        console.warn('Autoplay blocked, user interaction may be required:', err)
      })
    } catch (e) {
      console.error(e)
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Alert Sound Management</h1>
        <div className="w-fit rounded-lg border border-gray-200 bg-white shadow-sm">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </div>
      <Card className="mb-6 shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex items-center justify-between">
          <CardTitle className="text-xl">Upload Alert Sound</CardTitle>
          <Button variant="ghost" className="text-white" onClick={refreshList}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Input type="file" accept="audio/mpeg,audio/wav" onChange={onUpload} disabled={uploading} />
            <Button disabled={uploading} onClick={() => { /* no-op, use file input */ }} className="hidden sm:inline-flex">
              <UploadCloud className="h-4 w-4 mr-2" /> Upload
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">Allowed formats: .mp3, .wav</p>
          {message && <div className="mt-3 text-green-700">{message}</div>}
          {error && <div className="mt-3 text-red-600">{error}</div>}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl">Available Sounds</CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white rounded-b-lg">
          <Table>
            <TableCaption>List of alert sound files in the private bucket.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">Loading...</TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">No files uploaded yet.</TableCell>
                </TableRow>
              ) : (
                files.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{f.name}</span>
                        {activeFilePath === f.name && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => onPreview(f.name)} disabled={previewing === f.name}>
                        <Play className="h-4 w-4 mr-1" /> Preview
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setActive(f.name)} disabled={activeFilePath === f.name}>
                        Set Active
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(f.name)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
