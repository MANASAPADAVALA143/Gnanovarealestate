import { type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import LandingPage from './src/components/LandingPage'
import HomePage from './src/pages/HomePage'
import DemoPage from './src/pages/DemoPage'
import Login from './src/pages/Login'
import Signup from './src/pages/Signup'
import DashboardLayout from './src/pages/Dashboard/Layout'
import DashboardHome from './src/pages/Dashboard/Home'
import LeadsPage from './src/pages/Dashboard/Leads'
import SettingsPage from './src/pages/Dashboard/Settings'
import CampaignsPage from './src/pages/Dashboard/Campaigns'
import IntegrationsPage from './src/pages/Dashboard/Integrations'
import PropertiesManagementPage from './src/pages/Dashboard/PropertiesManagement'
import ListingWriter from './src/pages/Dashboard/ListingWriter'
import CallsPage from './src/pages/Dashboard/Calls'
import AppointmentsPage from './src/pages/Dashboard/Appointments'
import OpenHousePage from './src/pages/Dashboard/OpenHouse'
import AnalyticsPage from './src/pages/Dashboard/Analytics'
import AgentSettingsPage from './src/pages/Dashboard/AgentSettings'
import PipelinePage from './src/pages/Dashboard/Pipeline'
import TasksPage from './src/pages/Dashboard/Tasks'
import VoiceCallCenter from './pages/VoiceCallCenter'

function ProtectedRoute({ children }: { children: ReactNode }) {
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
          <Route path="/demo" element={<DemoPage />} />
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
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="properties" element={<PropertiesManagementPage />} />
            <Route path="listing-writer" element={<ListingWriter />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="open-house" element={<OpenHousePage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="agent-settings" element={<AgentSettingsPage />} />
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
