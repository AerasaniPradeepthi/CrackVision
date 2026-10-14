export default function Sidebar({
  activeTab,
  onSelectTab,
  user,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) {
  const role = (user?.role || '').trim().toUpperCase() || 'SITE_WORKER'
  const isAdmin = role === 'ADMIN' || role === 'SITE_ADMIN'

  const allItems = {
    dashboard: {
      id: 'dashboard',
      label:
        role === 'SITE_WORKER'
          ? 'Field Operations'
          : isAdmin
          ? 'Admin Overview'
          : 'Dashboard',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
    },
    users: {
      id: 'users',
      label: 'Users & Roles',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
    projects: {
      id: 'projects',
      label: role === 'SITE_ENGINEER' ? 'Structures Explorer' : 'Projects',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    inspections: {
      id: 'inspections',
      label: role === 'SITE_WORKER' ? 'Field Surveys' : 'Inspections',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm3-4a1 1 0 10-2 0v7a1 1 0 102 0V8zm3 2a1 1 0 10-2 0v5a1 1 0 102 0v-5z" clipRule="evenodd" />
        </svg>
      ),
    },
    monitoring: {
      id: 'monitoring',
      label: 'Monitoring',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      ),
    },
    reviews: {
      id: 'reviews',
      label: role === 'SITE_ENGINEER' ? 'Reviews & Certify' : 'Reviews',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
  }

  // Determine allowed navigation items per role
  let navKeys = ['dashboard', 'inspections']
  if (role === 'SITE_WORKER') {
    navKeys = ['dashboard', 'inspections']
  } else if (role === 'SITE_ENGINEER') {
    navKeys = ['dashboard', 'reviews', 'monitoring', 'inspections', 'projects']
  } else if (isAdmin) {
    navKeys = ['dashboard', 'users', 'projects', 'inspections', 'monitoring', 'reviews']
  } else if (role === 'PROJECT_MANAGER') {
    navKeys = ['dashboard', 'projects', 'inspections', 'monitoring', 'reviews']
  }

  const navItems = navKeys.map((key) => allItems[key]).filter(Boolean)

  const portalSubtitle =
    isAdmin
      ? 'Admin Portal'
      : role === 'SITE_WORKER'
      ? 'Worker Portal'
      : role === 'PROJECT_MANAGER'
      ? 'Manager Portal'
      : 'Engineer Portal'

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#071426] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Brand Header & Nav */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/30">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="m9 9 3 3-2 3 5 3" />
                  <path d="M15 6v3" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-white block leading-tight">
                  CrackVision
                </span>
                <span className="text-[10px] font-medium tracking-tight text-slate-400 block truncate">
                  Structural Monitoring
                </span>
                <span className="text-[9px] font-mono text-blue-400 block uppercase">
                  {portalSubtitle}
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
              aria-label="Close sidebar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id)
                    if (onCloseMobile) onCloseMobile()
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs ring-1 ring-blue-500/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Architectural Blueprint Accent */}
          <div className="mx-3 my-2 p-3 rounded-lg bg-blue-950/20 border border-blue-900/30">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                System Blueprint
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Real-time structural crack assessment with automated edge screening and cloud persistence.
            </p>
          </div>
        </div>

        {/* Bottom: User Info & Sign Out */}
        <div className="p-3.5 border-t border-slate-800/80 bg-[#071426]">
          <div className="flex items-center gap-2.5 mb-2.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center text-xs shrink-0 ring-1 ring-blue-400/40">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-blue-400 font-mono truncate">
                {user?.role || 'SITE_WORKER'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 00-.75-.75H8.704l2.47-2.47a.75.75 0 10-1.06-1.06l-3.75 3.75a.75.75 0 000 1.06l3.75 3.75a.75.75 0 101.06-1.06L8.704 10.75H18.25A.75.75 0 0019 10z"
                clipRule="evenodd"
              />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
