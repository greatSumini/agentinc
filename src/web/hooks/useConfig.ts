import { useEffect, useState } from 'react'
import { get } from '../lib/api-client'

interface ConfigResponse {
  company: string
  persona: string
}

export function useConfig(): { company: string | null; loading: boolean } {
  const [company, setCompany] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get<ConfigResponse>('/config')
      .then((data) => {
        setCompany(data.company)
      })
      .catch(() => {
        setCompany(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { company, loading }
}
