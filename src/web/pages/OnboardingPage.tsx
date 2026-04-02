import { useState, useEffect } from 'react'
import type { Persona } from '../../core/types'
import { useOnboarding, type Answer } from '../hooks/useOnboarding'
import { PersonaCard } from '../components/onboarding/PersonaCard'
import { ChatMessage } from '../components/onboarding/ChatMessage'
import { QuestionForm } from '../components/onboarding/QuestionForm'
import { CompanyNameConfirm } from '../components/onboarding/CompanyNameConfirm'
import { Button } from '../components/ui/Button'

const PERSONAS: Persona[] = ['elon-musk', 'peter-thiel', 'steve-jobs', 'bill-gates']

const PERSONA_NAMES: Record<Persona, string> = {
  'elon-musk': 'Elon Musk',
  'peter-thiel': 'Peter Thiel',
  'steve-jobs': 'Steve Jobs',
  'bill-gates': 'Bill Gates',
}

const CEO_FIRST_MESSAGE = 'Tell me about your company goals.'

export function OnboardingPage() {
  const {
    state,
    selectPersona,
    submitAnswers,
    confirmCompanyName,
    sendInitialMessage,
  } = useOnboarding()

  const [inputValue, setInputValue] = useState('')
  const [initialMessageSent, setInitialMessageSent] = useState(false)

  // Handle persona selection
  const handlePersonaSelect = async (persona: Persona) => {
    await selectPersona(persona)
  }

  // Handle initial message submission
  const handleSendInitialMessage = () => {
    if (inputValue.trim()) {
      sendInitialMessage(inputValue.trim())
      setInputValue('')
      setInitialMessageSent(true)
    }
  }

  // Handle question answers submission
  const handleSubmitAnswers = (answers: Answer[], wantMore: boolean) => {
    submitAnswers(answers, wantMore)
  }

  // Handle company name confirmation
  const handleConfirmCompanyName = (name: string) => {
    confirmCompanyName(name)
  }

  // Redirect to dashboard when completed
  useEffect(() => {
    if (state.step === 'completed') {
      window.location.href = '/dashboard'
    }
  }, [state.step])

  // Step 1: Persona Selection
  if (state.step === 'persona') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-xl w-full">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Choose Your CEO Style
          </h1>
          <div className="grid grid-cols-2 gap-4">
            {PERSONAS.map((persona) => (
              <PersonaCard
                key={persona}
                persona={persona}
                onClick={() => handlePersonaSelect(persona)}
                disabled={state.loading}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Company Name Confirmation
  if (state.step === 'company-name' && state.suggestedCompanyName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <CompanyNameConfirm
            suggestedName={state.suggestedCompanyName}
            onConfirm={handleConfirmCompanyName}
            loading={state.loading}
          />
        </div>
      </div>
    )
  }

  // Step 2: Chat with CEO
  const ceoName = state.persona ? PERSONA_NAMES[state.persona] : 'CEO'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{ceoName}</h2>
        </div>

        {/* Messages */}
        <div className="px-6 py-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          {/* CEO's first message (hardcoded) */}
          <ChatMessage
            message={{ role: 'ceo', content: CEO_FIRST_MESSAGE }}
            ceoName={ceoName}
          />

          {/* User messages */}
          {state.messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} ceoName={ceoName} />
          ))}

          {/* Loading indicator */}
          {state.loading && !state.currentQuestions && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input or Questions */}
        <div className="border-t border-gray-200 px-6 py-4">
          {!initialMessageSent && !state.currentQuestions ? (
            // Initial text input
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInitialMessage()}
                placeholder="Enter your response..."
                className="flex-1 border border-gray-200 rounded-md px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
                disabled={state.loading}
              />
              <Button
                onClick={handleSendInitialMessage}
                disabled={!inputValue.trim() || state.loading}
              >
                Send
              </Button>
            </div>
          ) : state.currentQuestions ? (
            // Question form
            <QuestionForm
              questions={state.currentQuestions}
              onSubmit={handleSubmitAnswers}
              loading={state.loading}
            />
          ) : (
            // Waiting for questions
            <div className="text-center text-gray-500 text-sm py-4">
              Waiting for questions...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
