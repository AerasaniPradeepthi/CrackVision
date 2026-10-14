import { useState, useEffect, useCallback } from 'react'
import LoginView from './components/LoginView'
import RegisterView from './components/RegisterView'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import DashboardOverview from './components/DashboardOverview'
import ProjectsView from './components/ProjectsView'
import InspectionsView from './components/InspectionsView'
import MonitoringView from './components/MonitoringView'
import ReviewsView from './components/ReviewsView'
import UserManagementView from './components/UserManagementView'

function isTokenExpired(token) {
  if (!token) return true
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function parseJwtRole(token) {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role || null
  } catch {
    return null
  }
}

function getInitialAuth() {
  try {
    const storedToken =
      sessionStorage.getItem('crackvision_token') ||
      localStorage.getItem('crackvision_token')
    const storedUserStr =
      sessionStorage.getItem('crackvision_user') ||
      localStorage.getItem('crackvision_user')

    if (storedToken && storedUserStr) {
      if (isTokenExpired(storedToken)) {
        localStorage.removeItem('crackvision_token')
        localStorage.removeItem('crackvision_user')
        sessionStorage.removeItem('crackvision_token')
        sessionStorage.removeItem('crackvision_user')
        return { token: null, user: null }
      }
      const parsedUser = JSON.parse(storedUserStr)
      // Enforce the cryptographically signed role from the JWT token
      const jwtRole = parseJwtRole(storedToken)
      if (jwtRole) {
        parsedUser.role = jwtRole
      }
      return { token: storedToken, user: parsedUser }
    }
  } catch {
    // Ignore storage parse error
  }
  return { token: null, user: null }
}

function parseArrayResponse(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.content)) return data.content
    if (Array.isArray(data.data)) return data.data
    if (data.id) return [data]
  }
  return []
}

// Helper to guard tabs against unauthorized role access
function getEffectiveTab(tab, role) {
  const normRole = (role || '').trim().toUpperCase()
  if (normRole === 'SITE_WORKER') {
    if (tab !== 'dashboard' && tab !== 'inspections') {
      return 'dashboard'
    }
  } else if (normRole === 'SITE_ENGINEER') {
    if (tab === 'users') {
      return 'dashboard'
    }
  } else if (normRole !== 'ADMIN' && tab === 'users') {
    return 'dashboard'
  }
  return tab
}

export default function App() {
  const [auth, setAuth] = useState(() => getInitialAuth())
  const token = auth.token
  const user = auth.user

  const [authView, setAuthView] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase()
      if (hash === '#register' || window.location.search.includes('register')) {
        return 'register'
      }
    }
    return 'login'
  })

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase()
      if (hash === '#register') {
        setAuthView('register')
      } else if (hash === '#login') {
        setAuthView('login')
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Navigation tab: 'dashboard' | 'users' | 'projects' | 'inspections' | 'monitoring' | 'reviews'
  const [activeTab, setActiveTab] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedComponentId, setSelectedComponentId] = useState(null)

  // Real backend data states
  const [projects, setProjects] = useState([])
  const [inspections, setInspections] = useState([])
  const [components, setComponents] = useState([])
  const [reviews, setReviews] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dataError, setDataError] = useState(null)

  // Compute active tab guarded by user role
  const currentTab = getEffectiveTab(activeTab, user?.role)

  // Sign out handler: clears storage and resets application state
  const handleSignOut = useCallback(() => {
    localStorage.removeItem('crackvision_token')
    localStorage.removeItem('crackvision_user')
    sessionStorage.removeItem('crackvision_token')
    sessionStorage.removeItem('crackvision_user')
    setAuth({ token: null, user: null })
    setProjects([])
    setInspections([])
    setComponents([])
    setReviews([])
    setActiveTab('dashboard')
    setDataError(null)
  }, [])

  // Login success handler called by LoginView
  const handleLoginSuccess = (userData, jwtToken) => {
    const jwtRole = parseJwtRole(jwtToken)
    const finalUser = {
      ...userData,
      role: jwtRole || userData.role,
    }
    setAuth({ token: jwtToken, user: finalUser })
    setActiveTab('dashboard')
  }

  // Fetch real data from verified backend endpoints
  const loadData = useCallback(async (authToken) => {
    if (!authToken) return

    try {
      const authHeaders = {
        Authorization: `Bearer ${authToken}`,
      }

      // Parallel fetch for core data
      const [projRes, inspRes, compRes] = await Promise.all([
        fetch('/api/projects', { headers: authHeaders }),
        fetch('/api/inspections', { headers: authHeaders }),
        fetch('/api/components', { headers: authHeaders }),
      ])

      // Handle token expiration/unauthorized across all core endpoints
      if (
        projRes.status === 401 || projRes.status === 403 ||
        inspRes.status === 401 || inspRes.status === 403 ||
        compRes.status === 401 || compRes.status === 403
      ) {
        handleSignOut()
        return
      }

      // Detect non-OK server or client responses and throw descriptive error
      const failed = [
        { name: 'projects', res: projRes },
        { name: 'inspections', res: inspRes },
        { name: 'components', res: compRes },
      ].find((item) => !item.res.ok)

      if (failed) {
        let msg = `Backend error loading ${failed.name} (HTTP ${failed.res.status})`
        try {
          const errData = await failed.res.json()
          if (errData?.error) msg = errData.error
          else if (errData?.message) msg = errData.message
        } catch {
          // Ignore JSON parse errors for non-JSON response bodies
        }
        throw new Error(msg)
      }

      // Parse JSON from successful responses
      const [projectsData, inspectionsData, componentsData] = await Promise.all([
        projRes.json(),
        inspRes.json(),
        compRes.json(),
      ])

      const normProjects = parseArrayResponse(projectsData)
      const normInspections = parseArrayResponse(inspectionsData)
      const normComponents = parseArrayResponse(componentsData)

      setProjects(normProjects)
      setInspections(normInspections)
      setComponents(normComponents)
      setDataError(null)

      // Fetch reviews: primary /api/inspections/reviews/all endpoint with fallback
      try {
        const revRes = await fetch('/api/inspections/reviews/all', { headers: authHeaders })
        if (revRes.ok) {
          const revData = await revRes.json()
          setReviews(parseArrayResponse(revData))
        } else if (normInspections.length > 0) {
          const inspectionsToCheck = normInspections.slice(0, 15)
          const reviewFetches = inspectionsToCheck.map((insp) =>
            fetch(`/api/inspections/${insp.id}/reviews`, { headers: authHeaders })
              .then((res) => (res.ok ? res.json() : []))
              .catch(() => [])
          )
          const nestedReviews = await Promise.all(reviewFetches)
          const combined = nestedReviews.flatMap((r) => parseArrayResponse(r))
          const uniqueReviews = Array.from(
            new Map(combined.map((item) => [item.id, item])).values()
          )
          setReviews(uniqueReviews)
        } else {
          setReviews([])
        }
      } catch {
        // Non-blocking: reviews remain empty if endpoint fails
        setReviews([])
      }
    } catch (err) {
      setDataError(
        err.message || 'Unable to synchronize data with backend server on port 5050.'
      )
    }
  }, [handleSignOut])

  // Synchronize backend data on mount or token change
  useEffect(() => {
    if (!token) return
    let active = true

    const run = async () => {
      setLoadingData(true)
      setDataError(null)
      await loadData(token)
      if (active) {
        setLoadingData(false)
      }
    }

    run()
    return () => {
      active = false
    }
  }, [token, loadData])

  // Explicit refresh action from header or dashboard
  const handleRefresh = async () => {
    if (!token) return
    setRefreshing(true)
    await loadData(token)
    setRefreshing(false)
  }

  // Quick navigation handler from inspection list to component monitoring
  const handleSelectComponentForMonitoring = (componentId) => {
    setSelectedComponentId(componentId)
    setActiveTab('monitoring')
  }

  // Unauthenticated View
  if (!user || !token) {
    if (authView === 'register') {
      return (
        <RegisterView
          onLoginSuccess={handleLoginSuccess}
          onSwitchToLogin={() => {
            window.location.hash = 'login'
            setAuthView('login')
          }}
        />
      )
    }
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => {
          window.location.hash = 'register'
          setAuthView('register')
        }}
      />
    )
  }

  // Authenticated Dashboard Layout
  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] font-sans antialiased text-slate-800">
      {/* Dark Navy Sidebar */}
      <Sidebar
        activeTab={currentTab}
        onSelectTab={(tab) => setActiveTab(getEffectiveTab(tab, user?.role))}
        user={user}
        onSignOut={handleSignOut}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header */}
        <Header
          activeTab={currentTab}
          user={user}
          onOpenMobile={() => setMobileMenuOpen(true)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {currentTab === 'dashboard' && (
            <DashboardOverview
              projects={projects}
              inspections={inspections}
              components={components}
              reviews={reviews}
              loading={loadingData}
              error={dataError}
              user={user}
              userRole={user?.role}
              token={token}
              onSelectTab={(tab) => setActiveTab(getEffectiveTab(tab, user?.role))}
              onSelectComponentForMonitoring={handleSelectComponentForMonitoring}
              onRefresh={handleRefresh}
            />
          )}

          {currentTab === 'users' && user?.role === 'ADMIN' && (
            <UserManagementView
              token={token}
              onRefresh={handleRefresh}
            />
          )}

          {currentTab === 'projects' && (
            <ProjectsView
              projects={projects}
              loading={loadingData}
              error={dataError}
              token={token}
              userRole={user?.role}
              onSelectComponentForMonitoring={handleSelectComponentForMonitoring}
              onSelectTab={(tab) => setActiveTab(getEffectiveTab(tab, user?.role))}
              onRefresh={handleRefresh}
            />
          )}

          {currentTab === 'inspections' && (
            <InspectionsView
              inspections={inspections}
              loading={loadingData}
              error={dataError}
              onSelectComponentForMonitoring={handleSelectComponentForMonitoring}
              token={token}
              onRefresh={handleRefresh}
              userRole={user?.role}
            />
          )}

          {currentTab === 'monitoring' && (
            <MonitoringView
              projects={projects}
              components={components}
              selectedComponentId={selectedComponentId}
              onSelectComponent={setSelectedComponentId}
              token={token}
              onSelectTab={(tab) => setActiveTab(getEffectiveTab(tab, user?.role))}
            />
          )}

          {currentTab === 'reviews' && (
            <ReviewsView
              reviews={reviews}
              inspections={inspections}
              loading={loadingData}
              error={dataError}
              userRole={user?.role}
              token={token}
              onRefresh={handleRefresh}
            />
          )}
        </main>
      </div>
    </div>
  )
}
