import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const SEMAPHORE_SMS_URL = 'https://api.semaphore.co/api/v4/messages'

const getApiKey = () => {
  const apiKey = process.env.SEMAPHORE_API_KEY
  if (!apiKey) {
    throw new Error('Semaphore API key is not configured')
  }
  return apiKey
}

const getSenderName = () => process.env.SEMAPHORE_SENDER_NAME

const normalizeMobileNumber = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('63') && digits.length === 12) {
    return digits
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `63${digits.slice(1)}`
  }
  if (digits.length === 10) {
    return `63${digits}`
  }
  return digits
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('users')
      .select('id, user_type')
      .eq('id', user.id)
      .single()

    if (adminProfileError || !adminProfile || !['admin', 'superadmin'].includes(adminProfile.user_type)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const reportId = typeof body?.reportId === 'string' ? body.reportId : ''
    const message = typeof body?.message === 'string' ? body.message.trim() : ''

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const { data: report, error: reportError } = await supabase
      .from('emergency_reports')
      .select('id, user_id')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('mobileNumber, user_type')
      .eq('id', report.user_id)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    if (targetUser.user_type !== 'user') {
      return NextResponse.json({ error: 'Target user not eligible for SMS' }, { status: 422 })
    }

    const normalizedNumber = normalizeMobileNumber(targetUser.mobileNumber || '')

    if (!/^63\d{10}$/.test(normalizedNumber)) {
      return NextResponse.json({ error: 'Invalid or missing mobile number' }, { status: 422 })
    }

    const params = new URLSearchParams()
    params.set('apikey', getApiKey())
    params.set('number', normalizedNumber)
    params.set('message', message)

    const senderName = getSenderName()
    if (senderName) {
      params.set('sendername', senderName)
    }

    const response = await fetch(SEMAPHORE_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMessage = Array.isArray(data) && data[0]?.message ? data[0].message : data?.error || 'Failed to send SMS'
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Unexpected response from Semaphore' }, { status: 502 })
    }

    const result = data[0]

    if (result.status && typeof result.status === 'string' && result.status.toLowerCase() === 'failed') {
      return NextResponse.json({ error: result.message || 'Semaphore rejected the SMS' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, sms: result })
  } catch (error: any) {
    console.error('Semaphore SMS error', error)
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 })
  }
}
