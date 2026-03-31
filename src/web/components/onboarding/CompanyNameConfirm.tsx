import { useState } from 'react'
import { Button } from '../ui/Button'

interface CompanyNameConfirmProps {
  suggestedName: string
  onConfirm: (name: string) => void
  loading?: boolean
}

export function CompanyNameConfirm({
  suggestedName,
  onConfirm,
  loading,
}: CompanyNameConfirmProps) {
  const [useCustom, setUseCustom] = useState(false)
  const [customName, setCustomName] = useState('')

  const handleConfirmSuggested = () => {
    onConfirm(suggestedName)
  }

  const handleConfirmCustom = () => {
    if (customName.trim()) {
      onConfirm(customName.trim())
    }
  }

  return (
    <div className="text-center space-y-6">
      <p className="text-xl text-gray-900">
        Create company as "{suggestedName}"?
      </p>

      <div className="flex justify-center gap-3">
        <Button onClick={handleConfirmSuggested} disabled={loading || useCustom}>
          Yes, use this name
        </Button>
        <Button
          variant="secondary"
          onClick={() => setUseCustom(true)}
          disabled={loading || useCustom}
        >
          No, enter custom name
        </Button>
      </div>

      {useCustom && (
        <div className="space-y-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter company name"
            className="w-full max-w-sm mx-auto block border border-gray-200 rounded-md px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
            autoFocus
          />
          <Button
            onClick={handleConfirmCustom}
            disabled={!customName.trim() || loading}
          >
            Confirm
          </Button>
        </div>
      )}
    </div>
  )
}
