export default function Header({
  activeTab,
  user,
  onOpenMobile,
  onRefresh,
  refreshing,
}) {
  const getHeaderInfo = (tab, role) => {
    const normRole = (role || '').trim().toUpperCase()
    if (tab === 'dashboard') {
      if (normRole === 'SITE_WORKER') {
        return {
          title: 'Field Operations',
          subtitle: 'Conduct on-site surveys, upload concrete photos, and run preliminary AI screening',
        }
      }
      if (normRole === 'SITE_ENGINEER') {
        return {
          title: 'Structural Engineering Center',
          subtitle: 'Review screening findings, analyze longitudinal trends, and certify determinations',
        }
      }
      if (normRole === 'ADMIN' || normRole === 'SITE_ADMIN') {
        return {
          title: 'System Administration',
          subtitle: 'Manage user authorizations, project structural hierarchies, and system activity',
        }
      }
      return {
        title: 'Dashboard Overview',
        subtitle: 'Structural inspection and crack monitoring overview',
      }
    }
    if (tab === 'users') {
      return {
        title: 'Users & Permissions',
        subtitle: 'Manage user access, assign system roles, and audit accounts',
      }
    }
    const baseTitles = {
      projects: {
        title: normRole === 'SITE_ENGINEER' ? 'Structures Explorer' : 'Projects & Structures',
        subtitle: 'Structural component hierarchies and construction assets',
      },
      inspections: {
        title: normRole === 'SITE_WORKER' ? 'Field Surveys' : 'Structural Inspections',
        subtitle: 'Component survey logs, photo evidence, and screening findings',
      },
      monitoring: {
        title: 'Component Monitoring',
        subtitle: 'Longitudinal AI screening progression curves and deltas',
      },
      reviews: {
        title: 'Engineer Reviews & Certifications',
        subtitle: 'Tamper-evident engineering determinations and certified action plans',
      },
    }
    return baseTitles[tab] || { title: 'CrackVision', subtitle: 'Structural Crack Detection & Monitoring System' }
  }

  const current = getHeaderInfo(activeTab, user?.role)

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Middle: Search bar on desktop */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects, components, inspections..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-slate-400 text-slate-800"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications Icon Button */}
        <button
          type="button"
          className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="System notifications"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* Refresh button */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh backend data"
          >
            <svg
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.047a1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* Backend status indicator */}
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live</span>
        </div>

        {/* Compact User info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center text-xs ring-1 ring-blue-500/30">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-medium text-slate-800 leading-tight truncate max-w-[120px]">
              {user?.name || 'Engineer'}
            </div>
            <div className="text-[10px] text-blue-600 font-mono leading-tight">
              {user?.role || 'SITE_ENGINEER'}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
