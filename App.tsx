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
import AdminPage from './src/pages/Dashboard/Admin'
import MetaAdsPage from './src/pages/Dashboard/MetaAds'
import AgentSettingsPage from './src/pages/Dashboard/AgentSettings'
import PipelinePage from './src/pages/Dashboard/Pipeline'
import TasksPage from './src/pages/Dashboard/Tasks'
import DealsPage from './src/pages/Dashboard/Deals'
import CommissionsPage from './src/pages/Dashboard/Commissions'
import BrokerInvoicesPage from './src/pages/Dashboard/BrokerInvoices'
import PaymentRunPage from './src/pages/Dashboard/PaymentRun'
import InboxPage from './src/pages/Dashboard/Inbox'
import VoiceCallCenter from './pages/VoiceCallCenter'
import PrivacyPolicy from './src/pages/PrivacyPolicy'
import OpenHouseCheckInPage from './src/pages/OpenHouseCheckInPage'
import { featureFlags } from './src/lib/featureFlags'
import {
  resolveProtectedRouteAccess,
  shouldAllowManagerRoute,
} from './src/lib/authGuards'

function ProtectedRoute({
  children,
  requireManager = false,
}: {
  children: ReactNode
  /** When true, non-managers are redirected to /dashboard (RLS alone is not enough UX). */
  requireManager?: boolean
}) {
  const { user, agent, loading, dashboardPreview } = useAuth()

  const gate = resolveProtectedRouteAccess({
    loading,
    userId: user?.id ?? null,
  })

  if (gate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (gate === 'redirect-login') {
    return <Navigate to="/login" replace />
  }

  if (requireManager) {
    if (
      !shouldAllowManagerRoute({
        isManager: Boolean(agent?.is_manager),
        isOwner: Boolean(agent?.is_owner),
        previewMode: dashboardPreview,
      })
    ) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
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
          {/* TODO(stub): live call-center uses mock data — gated until realtime VAPI feed exists */}
          <Route
            path="/call-center"
            element={
              featureFlags.liveCallCenter ? <VoiceCallCenter /> : <Navigate to="/" replace />
            }
          />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/open-house/:eventId/check-in" element={<OpenHouseCheckInPage />} />

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
            <Route path="deals" element={<DealsPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="broker-invoices" element={<BrokerInvoicesPage />} />
            <Route
              path="payment-run"
              element={
                <ProtectedRoute requireManager>
                  <PaymentRunPage />
                </ProtectedRoute>
              }
            />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="properties" element={<PropertiesManagementPage />} />
            <Route path="listing-writer" element={<ListingWriter />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="open-house" element={<OpenHousePage />} />
            <Route
              path="integrations"
              element={
                <ProtectedRoute requireManager>
                  <IntegrationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute requireManager>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route
              path="meta-ads"
              element={
                <ProtectedRoute requireManager>
                  <MetaAdsPage />
                </ProtectedRoute>
              }
            />
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
