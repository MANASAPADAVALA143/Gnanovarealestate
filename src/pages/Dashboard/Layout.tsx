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
  Handshake,
  Banknote,
  MessageCircle,
  FileText,
  Shield,
  TrendingUp,
  CreditCard,
  Building2,
  Facebook,
  Receipt,
  Sun,
  Upload,
  LayoutDashboard as OwnerIcon,
  FileText as InvoiceIcon,
  ScrollText,
  Star,
  Bot,
  FileText as DocIcon,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { featureFlags } from '../../lib/featureFlags'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { agent, signOut, dashboardPreview } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const nextAppOrigin =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEXT_APP_URL?.replace(/\/$/, '')) ||
    'http://localhost:3002'

  const isManager =
    Boolean(agent?.is_manager) || Boolean(agent?.is_owner) || dashboardPreview
  const showAdminNav = isManager

  type NavItem = { name: string; href: string; icon: LucideIcon; managerOnly?: boolean }
  const navigation: { label: string; items: NavItem[] }[] = [
    {
      label: 'Command',
      items: [{ name: 'Executive Dashboard', href: '/dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Leads',
      items: [
        { name: 'Lead Generation', href: '/dashboard/lead-generation', icon: Target },
        { name: 'Lead Database', href: '/dashboard/leads', icon: Users },
        { name: 'Pipeline', href: '/dashboard/pipeline', icon: Kanban },
        { name: 'Follow-ups', href: '/dashboard/tasks', icon: ListTodo },
      ],
    },
    {
      label: 'Outreach',
      items: [
        { name: 'WhatsApp Inbox', href: '/dashboard/inbox', icon: MessageCircle },
        { name: 'WhatsApp Bot', href: '/dashboard/whatsapp-bot', icon: Bot },
        { name: 'Campaign Studio', href: '/dashboard/campaigns', icon: Megaphone },
        { name: 'AI Voice', href: '/dashboard/calls', icon: Phone },
        { name: 'Facebook Leads', href: '/dashboard/facebook-leads', icon: Facebook },
      ],
    },
    {
      label: 'Sales',
      items: [
        { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
        { name: 'Open House', href: '/dashboard/open-house', icon: DoorOpen },
        { name: 'Deals', href: '/dashboard/deals', icon: Handshake },
        { name: 'Commissions', href: '/dashboard/commissions', icon: Banknote },
        { name: 'Broker Invoices', href: '/dashboard/broker-invoices', icon: FileText },
        { name: 'Payment Run', href: '/dashboard/payment-run', icon: CreditCard, managerOnly: true },
        { name: 'Collections', href: '/dashboard/payment-tracker', icon: Receipt },
      ],
    },
    {
      label: 'Properties',
      items: [
        { name: 'Properties', href: '/dashboard/properties', icon: Home },
        { name: 'Suite Inventory', href: '/dashboard/suites', icon: Building2 },
        { name: 'Listing Writer', href: '/dashboard/listing-writer', icon: PenTool },
        { name: 'Documents', href: '/dashboard/documents', icon: DocIcon },
        { name: 'Club Membership', href: '/dashboard/club-membership', icon: Star },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
        { name: 'Daily Summary', href: '/dashboard/daily-summary', icon: Sun },
        { name: 'Owner Dashboard', href: '/dashboard/owner-dashboard', icon: OwnerIcon, managerOnly: true },
        { name: 'Invoices', href: '/dashboard/invoices', icon: InvoiceIcon, managerOnly: true },
        { name: 'Agreements', href: '/dashboard/agreements', icon: ScrollText, managerOnly: true },
        { name: 'Meta Ads', href: '/dashboard/meta-ads', icon: TrendingUp, managerOnly: true },
      ],
    },
    {
      label: 'Administration',
      items: [
        { name: 'Import Leads', href: '/dashboard/data-migration', icon: Upload },
        { name: 'Bot Config', href: '/dashboard/bot-configuration', icon: Bot },
        { name: 'Integrations', href: '/dashboard/integrations', icon: LinkIcon, managerOnly: true },
        { name: 'Team', href: '/dashboard/admin', icon: Shield, managerOnly: true },
        { name: 'Agent Settings', href: '/dashboard/agent-settings', icon: UserCog },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ],
    },
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
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-800 px-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">VSR</span>
            </div>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">Venkateswara Suites</span>
              <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Sales CRM</span>
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation — scrollable so items below Campaigns stay reachable */}
        <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4">
          {navigation.map((group) => {
            const items = group.items.filter((item) => !item.managerOnly || showAdminNav)
            if (items.length === 0) return null
            return (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive =
                      item.href === '/dashboard'
                        ? location.pathname === '/dashboard'
                        : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate font-medium">{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <a
            href={`${nextAppOrigin}/dashboard/leads/scored`}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-slate-200 hover:text-white hover:bg-slate-800"
          >
            <Flame className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Hot Leads 🔥</span>
          </a>
        </nav>

        {/* Agent Profile */}
        <div className="flex-shrink-0 border-t border-slate-800 p-4">
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

          {/* TODO(stub): backend not implemented — no global search API across leads/calls/properties */}
          {featureFlags.globalSearch ? (
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
          ) : (
            <div className="flex-1 mx-4" />
          )}

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* TODO(stub): backend not implemented — no notifications feed / realtime alert channel */}
            {featureFlags.notificationsBell && (
              <button
                type="button"
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            )}

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







