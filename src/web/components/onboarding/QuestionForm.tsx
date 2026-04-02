import { useState } from 'react'
import type { Question, Answer } from '../../hooks/useOnboarding'
import { Button } from '../ui/Button'

interface QuestionFormProps {
  questions: Question[]
  onSubmit: (answers: Answer[], wantMore: boolean) => void
  loading?: boolean
}

export function QuestionForm({ questions, onSubmit, loading }: QuestionFormProps) {
  const [answers, setAnswers] = useState<Record<string, { selected: number | null; custom: string }>>(() =>
    questions.reduce(
      (acc, q) => ({
        ...acc,
        [q.id]: { selected: null, custom: '' },
      }),
      {}
    )
  )

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { selected: optionIndex, custom: '' },
    }))
  }

  const handleCustomInput = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { selected: 3, custom: value },
    }))
  }

  const handleSubmit = (wantMore: boolean) => {
    const formattedAnswers: Answer[] = questions.map((q) => {
      const answer = answers[q.id]
      const answerText =
        answer.selected === 3
          ? answer.custom
          : answer.selected !== null
          ? q.options[answer.selected]
          : ''
      return { questionId: q.id, answer: answerText }
    })
    onSubmit(formattedAnswers, wantMore)
  }

  const allAnswered = questions.every((q) => {
    const answer = answers[q.id]
    return (
      (answer.selected !== null && answer.selected < 3) ||
      (answer.selected === 3 && answer.custom.trim() !== '')
    )
  })

  return (
    <div className="space-y-6">
      {questions.map((question, qIndex) => (
        <div key={question.id} className="border-t border-gray-200 pt-4 first:border-t-0 first:pt-0">
          <p className="font-medium text-gray-900 mb-3">
            Q{qIndex + 1}: {question.text}
          </p>
          <div className="space-y-2">
            {question.options.map((option, oIndex) => (
              <label
                key={oIndex}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  checked={answers[question.id]?.selected === oIndex}
                  onChange={() => handleOptionSelect(question.id, oIndex)}
                  className="w-4 h-4 text-gray-900"
                />
                <span className="text-sm text-gray-700">
                  {String.fromCharCode(97 + oIndex)}) {option}
                </span>
              </label>
            ))}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answers[question.id]?.selected === 3}
                onChange={() => handleOptionSelect(question.id, 3)}
                className="w-4 h-4 text-gray-900 mt-1"
              />
              <div className="flex-1">
                <span className="text-sm text-gray-700">Other:</span>
                <input
                  type="text"
                  value={answers[question.id]?.custom || ''}
                  onChange={(e) => handleCustomInput(question.id, e.target.value)}
                  onFocus={() => handleOptionSelect(question.id, 3)}
                  placeholder="Enter your answer"
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </label>
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-4">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={!allAnswered || loading}
        >
          Submit and Start
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSubmit(true)}
          disabled={!allAnswered || loading}
        >
          3 More Questions
        </Button>
      </div>
    </div>
  )
}
