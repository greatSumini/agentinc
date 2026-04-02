import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { Layout } from './components/layout/Layout'
import { get } from './lib/api-client'

interface OnboardingStatus {
  step: 'persona' | 'chat' | 'company-name' | 'completed'
}

function RootRedirect() {
  const [loading, setLoading] = useState(true)
  const [redirect, setRedirect] = useState<string | null>(null)

  useEffect(() => {
    get<OnboardingStatus>('/onboarding/status')
      .then((status) => {
        if (status.step === 'completed') {
          setRedirect('/dashboard')
        } else {
          setRedirect('/onboarding')
        }
      })
      .catch(() => {
        // On error, default to onboarding
        setRedirect('/onboarding')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (redirect) {
    return <Navigate to={redirect} replace />
  }

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/chat"
          element={
            <Layout>
              <ChatPage />
            </Layout>
          }
        />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
