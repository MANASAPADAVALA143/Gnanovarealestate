import React from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Phone,
  Home,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  Megaphone,
  Link as LinkIcon,
  PenTool,
  Flame,
  UserCog,
  DoorOpen,
  Kanban,
  ListTodo,
} from 'lucide-react'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { agent, signOut, dashboardPreview } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const nextAppOrigin =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEXT_APP_URL?.replace(/\/$/, '')) ||
    'http://localhost:3002'

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leads', href: '/dashboard/leads', icon: Users },
    { name: 'Pipeline', href: '/dashboard/pipeline', icon: Kanban },
    { name: 'Tasks', href: '/dashboard/tasks', icon: ListTodo },
    { name: 'Calls', href: '/dashboard/calls', icon: Phone },
    { name: 'Properties', href: '/dashboard/properties', icon: Home },
    { name: 'Listing Writer', href: '/dashboard/listing-writer', icon: PenTool },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
    { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
    { name: 'Open House', href: '/dashboard/open-house', icon: DoorOpen },
    { name: 'Integrations', href: '/dashboard/integrations', icon: LinkIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Agent Settings', href: '/dashboard/agent-settings', icon: UserCog },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {dashboardPreview && (
        <div className="bg-amber-500 text-amber-950 text-center text-sm font-medium py-2 px-4 z-[60] relative">
          Preview mode — you can explore every screen without signing in. Data may be empty until Supabase is
          configured. To require login in dev, set{' '}
          <code className="rounded bg-amber-600/30 px-1">VITE_DASHBOARD_PREVIEW=false</code> in{' '}
          <code className="rounded bg-amber-600/30 px-1">.env</code>.
        </div>
      )}
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="text-white font-semibold text-lg">Gnanova</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
          <a
            href={`${nextAppOrigin}/dashboard/leads/scored`}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-slate-200 hover:text-white hover:bg-slate-800"
          >
            <Flame className="w-5 h-5" />
            <span className="font-medium">Hot Leads 🔥</span>
          </a>
        </nav>

        {/* Agent Profile */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center space-x-3 px-3 py-2 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {agent?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {agent?.full_name || 'Agent'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {agent?.subscription_tier || 'Trial'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:text-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-lg mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads, calls, properties..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Agent avatar (mobile) */}
            <div className="lg:hidden w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {agent?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}







