import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import LandingPage from './src/components/LandingPage'
import HomePage from './src/pages/HomePage'
import Login from './src/pages/Login'
import Signup from './src/pages/Signup'
import DashboardLayout from './src/pages/Dashboard/Layout'
import DashboardHome from './src/pages/Dashboard/Home'
import LeadsPage from './src/pages/Dashboard/Leads'
import SettingsPage from './src/pages/Dashboard/Settings'
import VoiceCallCenter from './pages/VoiceCallCenter'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/call-center" element={<VoiceCallCenter />} />
          
          {/* Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="calls" element={<div className="p-6">Calls page coming soon...</div>} />
            <Route path="properties" element={<div className="p-6">Properties page coming soon...</div>} />
            <Route path="appointments" element={<div className="p-6">Appointments page coming soon...</div>} />
            <Route path="analytics" element={<div className="p-6">Analytics page coming soon...</div>} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
