import type { Persona } from '../../../core/types'

interface PersonaInfo {
  name: string
  description: string
}

const PERSONA_INFO: Record<Persona, PersonaInfo> = {
  'elon-musk': {
    name: 'Elon Musk',
    description: 'Bold vision, rapid iteration, first principles thinking',
  },
  'peter-thiel': {
    name: 'Peter Thiel',
    description: 'Contrarian thinking, zero to one innovation',
  },
  'steve-jobs': {
    name: 'Steve Jobs',
    description: 'Obsessive focus, design excellence, reality distortion',
  },
  'bill-gates': {
    name: 'Bill Gates',
    description: 'Strategic scaling, systematic execution, long-term planning',
  },
}

interface PersonaCardProps {
  persona: Persona
  onClick: () => void
  disabled?: boolean
}

export function PersonaCard({ persona, onClick, disabled }: PersonaCardProps) {
  const info = PERSONA_INFO[persona]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="border border-gray-200 rounded-lg p-6 text-left hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
    >
      <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
      <p className="text-sm text-gray-600 mt-1">{info.description}</p>
    </button>
  )
}
