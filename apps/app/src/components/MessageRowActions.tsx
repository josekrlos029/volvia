'use client'

import { api } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Pulls a scheduled message back before it leaves. */
export function MessageRowActions({ messageId }: { messageId: string }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)

  async function cancel() {
    setWorking(true)
    try {
      await api.post(`/v1/messages/${messageId}/cancel`)
      router.refresh()
    } finally {
      setWorking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={working}
      className="text-[13px] font-medium underline underline-offset-2 disabled:opacity-60"
    >
      {working ? 'Cancelando' : 'Cancelar envío'}
    </button>
  )
}
