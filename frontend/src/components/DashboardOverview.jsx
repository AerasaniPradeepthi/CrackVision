import { useState, useEffect, useMemo, useCallback } from 'react'
import NewInspectionModal from './NewInspectionModal'
import UploadPhotoModal from './UploadPhotoModal'
import AiAnalysisModal from './AiAnalysisModal'
import SubmitReviewModal from './SubmitReviewModal'

function parseArrayResponse(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.content)) return data.content
    if (Array.isArray(data.data)) return data.data
    if (data.id) return [data]
  }
  return []
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatHighlightedImageUrl(url) {
  if (!url) return null
  if (url.startsWith('/outputs/')) return url
  if (url.startsWith('outputs/')) return `/${url}`
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/outputs')) {
      return parsed.pathname
    }
  } catch {
    // not a full url
  }
  return url
}

function getStatusBadge(status) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
    case 'PENDING_REVIEW':
      return 'bg-[#FFF3C7] text-[#92400E] border-[#FDE68A]'
    case 'PENDING_AI_ANALYSIS':
    case 'IN_PROGRESS':
      return 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getDecisionBadge(decision) {
  switch (decision) {
    case 'MONITOR':
    case 'INSPECT_FURTHER':
      return 'bg-[#FFF3C7] text-[#92400E] border-[#FDE68A]'
    case 'REQUIRES_FURTHER_ASSESSMENT':
    case 'REPAIR_REQUIRED':
      return 'bg-[#FFE2E2] text-[#991B1B] border-[#FECACA]'
    case 'NO_ACTION_REQUIRED':
      return 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getSeverityBadge(severity) {
  const norm = (severity || '').toUpperCase()
  if (norm.includes('CRITICAL') || norm.includes('STRUCTURAL') || norm.includes('HIGH')) {
    return 'bg-[#FFE2E2] text-[#991B1B] border-[#FECACA]'
  }
  if (norm.includes('MODERATE') || norm.includes('MEDIUM')) {
    return 'bg-[#FFF3C7] text-[#92400E] border-[#FDE68A]'
  }
  if (norm.includes('LOW') || norm.includes('HAIRLINE')) {
    return 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]'
  }
  if (norm.includes('NEGLIGIBLE') || norm.includes('NO_CRACK') || norm.includes('CLEAR')) {
    return 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function getRoleBadge(role) {
  switch (role) {
    case 'ADMIN':
    case 'SITE_ADMIN':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'SITE_ENGINEER':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'SITE_WORKER':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'PROJECT_MANAGER':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getDashboardGreeting(role) {
  switch (role) {
    case 'SITE_WORKER':
      return 'Welcome Back, Site Worker'
    case 'SITE_ENGINEER':
      return 'Welcome Back, Engineer'
    case 'ADMIN':
    case 'SITE_ADMIN':
      return 'Welcome Back, Admin'
    case 'PROJECT_MANAGER':
      return 'Welcome Back, Project Manager'
    default:
      return 'Welcome Back'
  }
}

export default function DashboardOverview({
  projects = [],
  inspections = [],
  components = [],
  reviews = [],
  loading = false,
  error = null,
  user = null,
  userRole,
  token,
  onSelectTab,
  onSelectComponentForMonitoring,
  onRefresh,
}) {
  const rawRole = (userRole || user?.role || '').trim().toUpperCase()
  const effectiveRole = rawRole || 'SITE_WORKER'
  const isAdmin = effectiveRole === 'ADMIN' || effectiveRole === 'SITE_ADMIN'

  // Direct modal controls inside the dashboard
  const [isNewInspectionModalOpen, setIsNewInspectionModalOpen] = useState(false)
  const [photoModalInspection, setPhotoModalInspection] = useState(null)
  const [analysisTarget, setAnalysisTarget] = useState(null)
  const [isSubmitReviewModalOpen, setIsSubmitReviewModalOpen] = useState(false)
  const [reviewModalInspection, setReviewModalInspection] = useState(null)

  // Admin users state
  const [adminUsers, setAdminUsers] = useState([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(
    () => isAdmin && Boolean(token)
  )
  const [adminRoleUpdatingId, setAdminRoleUpdatingId] = useState(null)
  const [adminNotice, setAdminNotice] = useState(null)

  // Engineer recent analyses state
  const [recentAnalyses, setRecentAnalyses] = useState([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Fetch admin users when in ADMIN or SITE_ADMIN role
  useEffect(() => {
    if (!isAdmin || !token) return
    let active = true

    fetch('/api/admin/users', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          setAdminUsers(Array.isArray(data) ? data : [])
          setAdminUsersLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setAdminUsersLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isAdmin, effectiveRole, token, authHeaders])

  // Fetch recent AI analysis results for Engineer and Worker roles
  useEffect(() => {
    if (effectiveRole !== 'SITE_ENGINEER' && effectiveRole !== 'SITE_WORKER') return
    if (!token || inspections.length === 0) return
    let active = true

    const topInspections = inspections.slice(0, 8)
    Promise.all(
      topInspections.map((insp) =>
        fetch(`/api/inspections/${insp.id}/analysis`, { headers: authHeaders() })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            const list = parseArrayResponse(data)
            return list.map((a) => ({ ...a, inspection: insp }))
          })
          .catch(() => [])
      )
    )
      .then((results) => {
        if (active) {
          const combined = results.flat()
          setRecentAnalyses(combined)
          setLoadingAnalyses(false)
        }
      })
      .catch(() => {
        if (active) {
          setLoadingAnalyses(false)
        }
      })

    return () => {
      active = false
    }
  }, [effectiveRole, token, inspections, authHeaders])

  const handleAdminRoleChange = async (userId, newRole) => {
    setAdminRoleUpdatingId(userId)
    setAdminNotice(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to update role')
      }
      const updated = await res.json()
      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u))
      )
      setAdminNotice(`Role updated to ${updated.role} for ${updated.email}`)
      if (onRefresh) onRefresh()
    } catch (err) {
      setAdminNotice(`Error: ${err.message}`)
    } finally {
      setAdminRoleUpdatingId(null)
    }
  }

  // Calculate status statistics
  const statusStats = useMemo(() => {
    const total = inspections.length
    const pendingAi = inspections.filter(
      (i) => i.status === 'PENDING_AI_ANALYSIS' || i.status === 'IN_PROGRESS'
    ).length
    const pendingReview = inspections.filter((i) => i.status === 'PENDING_REVIEW').length
    const completed = inspections.filter((i) => i.status === 'COMPLETED').length
    const submitted = pendingReview + completed

    return { total, pendingAi, pendingReview, completed, submitted }
  }, [inspections])

  // Repeated monitoring components
  const repeatedComponents = useMemo(() => {
    const map = new Map()
    inspections.forEach((i) => {
      if (i.component?.id) {
        const id = i.component.id
        const existing = map.get(id) || {
          component: i.component,
          count: 0,
          latestDate: i.inspectionDate || i.createdAt,
        }
        existing.count++
        map.set(id, existing)
      }
    })
    return Array.from(map.values())
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [inspections])

  // Quick action: find inspection needing photo upload
  const handleUploadPhotoAction = () => {
    const pending = inspections.find((i) => i.status === 'PENDING_AI_ANALYSIS') || inspections[0]
    if (pending) {
      setPhotoModalInspection(pending)
    } else {
      setIsNewInspectionModalOpen(true)
    }
  }

  // Quick action: find inspection needing AI screening
  const handleAiScreeningAction = () => {
    const pending = inspections.find((i) => i.status === 'PENDING_AI_ANALYSIS') || inspections[0]
    if (pending) {
      setAnalysisTarget({ inspection: pending, imageId: null })
    } else {
      setIsNewInspectionModalOpen(true)
    }
  }

  // Quick action: open review for first pending inspection
  const handleOpenReviewPendingAction = () => {
    const pending = inspections.find((i) => i.status === 'PENDING_REVIEW')
    if (pending) {
      setReviewModalInspection(pending)
      setIsSubmitReviewModalOpen(true)
    } else if (onSelectTab) {
      onSelectTab('reviews')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-slate-500">
        <svg className="animate-spin h-7 w-7 text-blue-600 mb-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs font-medium">Loading workspace dashboard...</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Error Notice */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span className="truncate">
              <strong className="font-semibold text-red-800">Connection notice:</strong> {error}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1 text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg shadow-2xs cursor-pointer shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SITE_WORKER DASHBOARD: FIELD OPERATIONS                                */}
      {/* ========================================================================= */}
      {effectiveRole === 'SITE_WORKER' && (
        <div className="space-y-6">
          {/* 1. Worker Hero Banner with Construction Image & Telemetry Card */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800/40 shadow-lg min-h-[220px] flex flex-col justify-between">
            {/* Background Construction Image */}
            <img
              src="/construction-site.jpg"
              alt="Field Operations Center"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            {/* Dark Navy Gradient Overlay for high-contrast white text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-blue-950/80" />
            <div className="absolute inset-0 bg-slate-950/30" />

            {/* Hero Content */}
            <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 tracking-wide uppercase">
                    Field Operations Center
                  </span>
                  <span className="text-slate-400 text-xs">&bull;</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-300 italic tracking-wide">
                    Structural Evidence Logging &amp; Preliminary AI Screening
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Welcome Back, Site Worker
                </h1>

                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed italic border-l-2 border-amber-400 pl-3">
                  &ldquo;Record on-site structural inspections, upload photographic concrete evidence, and initiate preliminary AI crack screening.&rdquo;
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewInspectionModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors cursor-pointer border border-blue-400/30"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 00-1.5h-4.5v-4.5z" />
                    </svg>
                    <span>+ New Inspection</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadPhotoAction}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm backdrop-blur-xs border border-blue-400/30 shadow-md transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Upload Evidence</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Hero Field Telemetry Card */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl p-4 sm:p-5 text-white shadow-xl max-w-sm w-full shrink-0 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Field AI Telemetry
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Live Status
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Capture Camera:</span>
                    <span className="font-semibold text-slate-200">Orthogonal 90&deg; Mode</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Analysis Engine:</span>
                    <span className="font-semibold text-slate-200">OpenCV Canny &amp; Contour</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Active Field Records:</span>
                    <span className="font-bold text-amber-400 font-mono">{inspections.length} Logged</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 italic">
                  Ensure clean structural surface and perpendicular photo angle before AI screening.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Worker 4 Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* My Inspections */}
            <div
              onClick={() => onSelectTab && onSelectTab('inspections')}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  My Inspections
                </span>
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{inspections.length}</div>
              <p className="mt-1 text-[11px] text-slate-400">Total field survey logs</p>
            </div>

            {/* Analysis in Progress */}
            <div
              onClick={handleAiScreeningAction}
              className="bg-white rounded-xl border border-blue-200 p-4 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                  Analysis in Progress
                </span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-700">{statusStats.pendingAi}</div>
              <p className="mt-1 text-[11px] text-blue-600">Awaiting photo or AI screening</p>
            </div>

            {/* Pending Review */}
            <div
              onClick={() => onSelectTab && onSelectTab('inspections')}
              className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Pending Review
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-900">{statusStats.pendingReview}</div>
              <p className="mt-1 text-[11px] text-amber-700">Awaiting engineering determination</p>
            </div>

            {/* Completed */}
            <div
              onClick={() => onSelectTab && onSelectTab('inspections')}
              className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Completed
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{statusStats.completed}</div>
              <p className="mt-1 text-[11px] text-emerald-700">Certified by structural engineer</p>
            </div>
          </div>

          {/* 3. Field Workflow Shortcuts Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Field Workflow Shortcuts:</span> Select a field operation to execute immediately.
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsNewInspectionModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 00-1.5h-4.5v-4.5z" />
                </svg>
                <span>+ New Inspection</span>
              </button>
              <button
                type="button"
                onClick={handleUploadPhotoAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span>Upload Structural Photo</span>
              </button>
              <button
                type="button"
                onClick={handleAiScreeningAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-8-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10z" />
                </svg>
                <span>AI Crack Screening</span>
              </button>
            </div>
          </div>

          {/* 4. Recent Inspections Table (Left) & SOP Checklist (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* My Recent Inspections Table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    My Recent Inspections
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Field surveys logged with current evidence and review status
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab('inspections')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View all ({inspections.length}) &rarr;
                </button>
              </div>

              {inspections.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800">No field inspections recorded yet</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Start by recording a structural survey for a pillar, beam, or slab, then upload photographic evidence.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewInspectionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    + Record First Inspection
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Component & Location</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-right">Field Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {inspections.slice(0, 6).map((insp) => {
                        const comp = insp.component
                        const floorNum = comp?.floor?.floorNumber
                        return (
                          <tr key={insp.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-900 block">
                                {comp?.name || 'Structural Component'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{insp.id} &bull; {comp?.type || 'STRUCTURE'} {floorNum != null ? `&bull; Floor ${floorNum}` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {formatDate(insp.inspectionDate || insp.createdAt)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                                  insp.status
                                )}`}
                              >
                                {insp.status || 'PENDING'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {insp.status === 'PENDING_AI_ANALYSIS' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPhotoModalInspection(insp)}
                                      className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-2 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                                    >
                                      Photo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAnalysisTarget({ inspection: insp, imageId: null })}
                                      className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                                    >
                                      Run AI
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAnalysisTarget({ inspection: insp, imageId: null })}
                                    className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                                  >
                                    View Evidence
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Field SOP Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Field Protocol Checklist
                  </h3>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    SOP v2
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Standard operating procedure for structural field data capture
                </p>

                <ol className="mt-4 space-y-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-[10px]">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Select Location</strong>
                      Identify correct project, building, floor, and structural component ID.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-[10px]">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Capture Photo Evidence</strong>
                      Ensure clean surface lighting, perpendicular view, JPEG/PNG up to 10MB.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-[10px]">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Run AI Screening</strong>
                      Edge detection and automated crack surface area calculation execute instantly.
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-[10px]">
                      4
                    </span>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Submit for Review</strong>
                      Completed surveys route directly to the Site Engineer for formal certification.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewInspectionModalOpen(true)}
                  className="w-full text-center py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200"
                >
                  Start New Inspection Survey &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* 5. AI Crack Analysis Results Grid for Worker */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Recent AI Crack Screening Results
                </h3>
                <p className="text-[11px] text-slate-500">
                  Visual screening evidence, detected crack contours, and surface area measurements
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFE2E2] text-[#991B1B] border border-[#FECACA]">
                  Critical
                </span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFF3C7] text-[#92400E] border border-[#FDE68A]">
                  Moderate
                </span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]">
                  Hairline
                </span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">
                  No Crack
                </span>
              </div>
            </div>

            {loadingAnalyses ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading AI screening evidence...</div>
            ) : recentAnalyses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No preliminary AI screening records yet. Record an inspection and upload photo evidence to trigger AI screening.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {recentAnalyses.slice(0, 4).map((analysis) => {
                  const imgUrl = formatHighlightedImageUrl(analysis.highlightedImageUrl)
                  const category =
                    analysis.screeningCategory ||
                    (analysis.crackDetected ? 'CRITICAL' : 'NO_CRACK_DETECTED')
                  const compName =
                    analysis.inspection?.component?.name ||
                    `Inspection #${analysis.inspectionId || analysis.inspection?.id}`

                  return (
                    <div
                      key={analysis.id}
                      onClick={() => {
                        if (analysis.inspection) {
                          setAnalysisTarget({
                            inspection: analysis.inspection,
                            imageId: analysis.imageId,
                          })
                        }
                      }}
                      className="group bg-slate-50 hover:bg-white rounded-lg border border-slate-200 hover:border-blue-300 p-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative w-full h-28 rounded bg-slate-200 overflow-hidden mb-2.5 flex items-center justify-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt="Detection Overlay"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="text-slate-400 text-[10px]">No image preview</div>
                          )}
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                            {analysis.crackAreaPercentage != null
                              ? `${analysis.crackAreaPercentage.toFixed(2)}% Area`
                              : analysis.crackDetected
                              ? 'Crack Detected'
                              : 'Screened'}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-900 truncate" title={compName}>
                          {compName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Analysis #{analysis.id}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(category)}`}>
                          {category}
                        </span>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          Inspect &rarr;
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SITE_ENGINEER DASHBOARD: ENGINEERING REVIEW                            */}
      {/* ========================================================================= */}
      {effectiveRole === 'SITE_ENGINEER' && (
        <div className="space-y-6">
          {/* 1. Engineer Hero Banner with Dark Navy Overlay */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800/40 shadow-lg min-h-[220px] flex flex-col justify-between">
            {/* Background Construction Image */}
            <img
              src="/construction-site.jpg"
              alt="Engineering Review Center"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            {/* Dark Navy Gradient Overlay for high-contrast white text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-blue-950/80" />
            <div className="absolute inset-0 bg-slate-950/30" />

            {/* Hero Content */}
            <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30 tracking-wide uppercase">
                    Engineering Review Center
                  </span>
                  <span className="text-slate-400 text-xs">&bull;</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-300 italic tracking-wide">
                    Inspection Analysis &amp; Engineering Determination
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Welcome Back, Engineer
                </h1>

                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed italic border-l-2 border-blue-400 pl-3">
                  &ldquo;Review AI analysis results, record engineering decisions, monitor structural components, and support data-driven infrastructure safety.&rdquo;
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap pt-2">
                  <button
                    type="button"
                    onClick={handleOpenReviewPendingAction}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors cursor-pointer border border-blue-400/30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Review Pending Inspections</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTab && onSelectTab('monitoring')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm backdrop-blur-xs border border-blue-400/30 shadow-md transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>View Monitoring</span>
                  </button>
                </div>
              </div>

              {/* Right Side: AI Screening Telemetry Preview Card */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl p-4 sm:p-5 text-white shadow-xl max-w-sm w-full shrink-0 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      AI Screening Telemetry
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-400/30 font-bold">
                    CRITICAL SEVERITY
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Surface Coverage:</span>
                    <span className="font-semibold text-slate-200">2.14% Crack Area</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Algorithmic Confidence:</span>
                    <span className="font-semibold text-emerald-400">94.8% Detection</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tamper-Proof Audit:</span>
                    <span className="font-mono text-slate-300 text-[11px]">SHA-256 Verified</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 italic">
                  Deterministic OpenCV edge morphology calibrated against concrete stress standards.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Engineer Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Pending Reviews */}
            <div
              onClick={() => onSelectTab && onSelectTab('reviews')}
              className="bg-white rounded-xl border border-blue-200 p-5 shadow-2xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                  Pending Reviews
                </span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold text-blue-900">{statusStats.pendingReview}</div>
              <p className="mt-1 text-xs text-blue-600">Surveys awaiting engineering determination</p>
            </div>

            {/* Reviewed Inspections */}
            <div
              onClick={() => onSelectTab && onSelectTab('reviews')}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Reviewed Inspections
                </span>
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{reviews.length}</div>
              <p className="mt-1 text-xs text-slate-500">Completed certified engineering reviews</p>
            </div>

            {/* Components Under Monitoring */}
            <div
              onClick={() => onSelectTab && onSelectTab('monitoring')}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Components Under Monitoring
                </span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold text-indigo-700">{components.length}</div>
              <p className="mt-1 text-xs text-slate-500">Tracked structural elements</p>
            </div>
          </div>

          {/* 3. Side-by-Side: Urgent Review Queue (Left) & AI Crack Analysis & Severity Findings (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT: Urgent Review Queue */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-full">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Urgent Review Queue</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {inspections.filter((i) => i.status === 'PENDING_REVIEW').length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Field inspections awaiting certified engineering determination and action
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab('reviews')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer transition-colors"
                >
                  Open full review queue &rarr;
                </button>
              </div>

              {inspections.filter((i) => i.status === 'PENDING_REVIEW').length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  ✓ No inspections currently pending certified review. All field surveys are up to date.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Inspection</th>
                        <th className="py-3 px-3">Project</th>
                        <th className="py-3 px-3">Component</th>
                        <th className="py-3 px-3">Severity</th>
                        <th className="py-3 px-3">Review Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {inspections
                        .filter((i) => i.status === 'PENDING_REVIEW')
                        .slice(0, 6)
                        .map((insp) => {
                          const analysisForInsp = recentAnalyses.find(
                            (a) => a.inspectionId === insp.id || a.inspection?.id === insp.id
                          )
                          const severity =
                            analysisForInsp?.screeningCategory ||
                            (analysisForInsp?.crackDetected === true
                              ? 'CRITICAL'
                              : analysisForInsp
                              ? 'NO_CRACK_DETECTED'
                              : 'MODERATE')
                          const projectName =
                            insp.component?.floor?.building?.project?.name ||
                            insp.project?.name ||
                            projects[0]?.name ||
                            'Infrastructure'

                          return (
                            <tr key={insp.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Inspection ID */}
                              <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                #{insp.id}
                              </td>

                              {/* Project */}
                              <td className="py-3 px-3 text-slate-700 font-medium max-w-[120px] truncate" title={projectName}>
                                {projectName}
                              </td>

                              {/* Component */}
                              <td className="py-3 px-3">
                                <span className="font-semibold text-slate-900 block truncate max-w-[130px]" title={insp.component?.name}>
                                  {insp.component?.name || 'Component'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {insp.component?.type || 'STRUCTURE'}
                                </span>
                              </td>

                              {/* Severity */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(severity)}`}>
                                  {severity}
                                </span>
                              </td>

                              {/* Review Status */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(insp.status)}`}>
                                  {insp.status || 'PENDING_REVIEW'}
                                </span>
                              </td>

                              {/* Action */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewModalInspection(insp)
                                    setIsSubmitReviewModalOpen(true)
                                  }}
                                  className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                >
                                  Review &amp; Certify
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RIGHT: AI Crack Analysis & Severity Findings */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    AI Crack Analysis &amp; Severity Findings
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Visual screening evidence, surface area coverage, and automated classifications
                  </p>
                </div>

                {/* Severity Legend */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFE2E2] text-[#991B1B] border border-[#FECACA]">
                    Critical
                  </span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFF3C7] text-[#92400E] border border-[#FDE68A]">
                    Moderate
                  </span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]">
                    Hairline
                  </span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">
                    No Crack
                  </span>
                </div>
              </div>

              {loadingAnalyses ? (
                <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400">
                  <svg className="animate-spin h-6 w-6 text-blue-600 mb-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading AI crack screenings...
                </div>
              ) : recentAnalyses.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-6">
                  No AI crack screening analyses recorded yet. Screenings will populate here as field surveys are processed.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {recentAnalyses.slice(0, 4).map((analysis) => {
                    const imgUrl = formatHighlightedImageUrl(analysis.highlightedImageUrl)
                    const category =
                      analysis.screeningCategory ||
                      (analysis.crackDetected ? 'CRITICAL' : 'NO_CRACK_DETECTED')
                    const projectName =
                      analysis.inspection?.component?.floor?.building?.project?.name ||
                      analysis.inspection?.project?.name ||
                      projects[0]?.name ||
                      'Infrastructure'
                    const compName =
                      analysis.inspection?.component?.name ||
                      `Inspection #${analysis.inspectionId || analysis.inspection?.id}`

                    return (
                      <div
                        key={analysis.id}
                        onClick={() => {
                          if (analysis.inspection) {
                            setAnalysisTarget({
                              inspection: analysis.inspection,
                              imageId: analysis.imageId,
                            })
                          }
                        }}
                        className="group bg-slate-50 hover:bg-white rounded-lg border border-slate-200 hover:border-blue-300 p-3 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          {/* Highlighted image preview */}
                          <div className="relative w-full h-32 rounded bg-slate-200 overflow-hidden mb-2.5 flex items-center justify-center">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt="AI Detection Overlay"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                                <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-[10px]">No image preview</span>
                              </div>
                            )}
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                              {analysis.crackAreaPercentage != null
                                ? `${analysis.crackAreaPercentage.toFixed(2)}% Area`
                                : analysis.crackDetected
                                ? 'Crack Detected'
                                : 'Screened'}
                            </span>
                          </div>

                          <div className="font-semibold text-xs text-slate-900 truncate" title={compName}>
                            {compName}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate" title={projectName}>
                            {projectName}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Analysis #{analysis.id} &bull; {formatShortDate(analysis.createdAt || analysis.analyzedAt)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getSeverityBadge(category)}`}>
                            {category}
                          </span>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                          >
                            Inspect &rarr;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Crack Monitoring & Recent Reviews Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Crack Monitoring Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Longitudinal Crack Monitoring
                  </h3>
                  <span className="text-[10px] text-slate-400">Historical Tracking</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Components tracked with multiple chronological scans to assess growth delta
                </p>

                <div className="mt-3 divide-y divide-slate-100">
                  {repeatedComponents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No components with multiple surveys yet. Track components across repeated inspections to generate progression trends.
                    </div>
                  ) : (
                    repeatedComponents.map((item) => (
                      <div
                        key={item.component.id}
                        onClick={() => {
                          if (onSelectComponentForMonitoring) {
                            onSelectComponentForMonitoring(item.component.id)
                          } else if (onSelectTab) {
                            onSelectTab('monitoring')
                          }
                        }}
                        className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-xs text-slate-800">
                            {item.component.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.component.type} &bull; Floor {item.component.floor?.floorNumber ?? 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {item.count} scans
                          </span>
                          <span className="text-xs text-blue-600 font-semibold">&rarr;</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab('monitoring')}
                  className="w-full text-center py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200"
                >
                  Open Full Progression Curves & Comparison &rarr;
                </button>
              </div>
            </div>

            {/* Recent Engineering Reviews Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Recent Certified Engineering Reviews
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewModalInspection(null)
                      setIsSubmitReviewModalOpen(true)
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + Record Review
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Decisions recorded: Monitor, Inspect Further, Assessment, or Repair
                </p>

                <div className="mt-3 divide-y divide-slate-100">
                  {reviews.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No certified reviews recorded yet. Click &ldquo;+ Record Review&rdquo; to add a formal determination.
                    </div>
                  ) : (
                    reviews.slice(0, 5).map((rev) => (
                      <div key={rev.id} className="py-2.5 flex items-center justify-between">
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getDecisionBadge(rev.decision)}`}>
                              {rev.decision}
                            </span>
                            <span className="text-xs font-medium text-slate-800 truncate">
                              Inspection #{rev.inspectionId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {rev.comments || 'No comments recorded'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatShortDate(rev.reviewedAt || rev.createdAt)}
                          </div>
                          <div className="text-[10px] font-medium text-slate-600">
                            {rev.reviewer?.name || 'Engineer'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab('reviews')}
                  className="w-full text-center py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
                >
                  View All Review Audit Trails &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ADMIN DASHBOARD: ADMIN OPERATIONS CENTER                               */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="space-y-6">
          {/* 1. Admin Hero Banner with Construction Image & Governance Telemetry Card */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800/40 shadow-lg min-h-[220px] flex flex-col justify-between">
            {/* Background Construction Image */}
            <img
              src="/construction-site.jpg"
              alt="Admin Operations Center"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            {/* Dark Navy Gradient Overlay for high-contrast white text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-blue-950/80" />
            <div className="absolute inset-0 bg-slate-950/30" />

            {/* Hero Content */}
            <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 tracking-wide uppercase">
                    Admin Operations Center
                  </span>
                  <span className="text-slate-400 text-xs">&bull;</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-300 italic tracking-wide">
                    System Governance &amp; Structural Hierarchies
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Welcome Back, Admin
                </h1>

                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed italic border-l-2 border-purple-400 pl-3">
                  &ldquo;Manage user accounts and role assignments, configure project structural hierarchies, and oversee platform-wide inspection integrity.&rdquo;
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectTab && onSelectTab('users')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors cursor-pointer border border-blue-400/30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Manage Users &amp; Roles</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectTab && onSelectTab('projects')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white font-semibold text-xs sm:text-sm backdrop-blur-xs border border-blue-400/30 shadow-md transition-colors cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Configure Projects</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Admin System Governance Card */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl p-4 sm:p-5 text-white shadow-xl max-w-sm w-full shrink-0 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Governance Status
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                    RBAC ACTIVE
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className="font-semibold text-slate-200">Aiven Cloud MySQL (SSL)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registered Accounts:</span>
                    <span className="font-bold text-purple-300 font-mono">{adminUsers.length || '—'} Users</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Structural Projects:</span>
                    <span className="font-mono text-slate-200">{projects.length} Active</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 italic">
                  Role assignments and hierarchy modifications apply globally across all active sessions.
                </div>
              </div>
            </div>
          </div>

          {/* Admin Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onSelectTab && onSelectTab('users')}
              className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs hover:border-purple-300 transition-all cursor-pointer"
            >
              <div className="text-xs font-semibold text-purple-700">Registered Users</div>
              <div className="mt-1 text-2xl font-bold text-purple-900">
                {adminUsers.length > 0 ? adminUsers.length : '—'}
              </div>
              <div className="text-[10px] text-purple-600 mt-1">Click to manage permissions</div>
            </div>

            <div
              onClick={() => onSelectTab && onSelectTab('projects')}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="text-xs font-medium text-slate-500">Active Projects</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{projects.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">Infrastructure structures</div>
            </div>

            <div
              onClick={() => onSelectTab && onSelectTab('inspections')}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="text-xs font-medium text-slate-500">Total System Inspections</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{inspections.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">All field surveys logged</div>
            </div>

            <div
              onClick={() => onSelectTab && onSelectTab('reviews')}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="text-xs font-medium text-slate-500">Certified Reviews</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{reviews.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">Tamper-evident audit logs</div>
            </div>
          </div>

          {/* Admin Notice */}
          {adminNotice && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
              <span>✓ {adminNotice}</span>
              <button type="button" onClick={() => setAdminNotice(null)} className="text-emerald-600 font-bold cursor-pointer">✕</button>
            </div>
          )}

          {/* Quick User Management Table & Project Hierarchy Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Quick Users Table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    User Accounts & Role Assignments
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Quickly assign or reassign role permissions for system users
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab('users')}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 cursor-pointer"
                >
                  Manage all users &rarr;
                </button>
              </div>

              {adminUsersLoading && adminUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading user accounts...</div>
              ) : adminUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No users found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">User</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Current Role</th>
                        <th className="py-2.5 px-4 text-right">Change Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {adminUsers.slice(0, 6).map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-slate-900 block">{u.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {u.email}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(u.role)}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <select
                              value={u.role}
                              disabled={adminRoleUpdatingId === u.id}
                              onChange={(e) => handleAdminRoleChange(u.id, e.target.value)}
                              className="text-xs px-2 py-1 rounded border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-600 cursor-pointer disabled:opacity-50"
                            >
                              <option value="SITE_WORKER">SITE_WORKER</option>
                              <option value="SITE_ENGINEER">SITE_ENGINEER</option>
                              <option value="SITE_ADMIN">SITE_ADMIN</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Structure Hierarchies Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center justify-between">
                  <span>Project Hierarchies</span>
                  <span className="text-[10px] text-slate-400 font-normal">{projects.length} Projects</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Structure configuration: Projects, Buildings, Floors, and Components
                </p>

                <div className="mt-3 divide-y divide-slate-100">
                  {projects.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No active projects registered. Click below to add.
                    </div>
                  ) : (
                    projects.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onSelectTab && onSelectTab('projects')}
                        className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-xs text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-400">{p.location || 'General Site'}</div>
                        </div>
                        <span className="text-xs text-blue-600 font-semibold">&rarr;</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectTab && onSelectTab('projects')}
                className="w-full text-center py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              >
                Configure Projects & Hierarchies &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DEFAULT / PROJECT_MANAGER DASHBOARD                                    */}
      {/* ========================================================================= */}
      {!isAdmin && effectiveRole !== 'SITE_WORKER' && effectiveRole !== 'SITE_ENGINEER' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {getDashboardGreeting(effectiveRole)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              General oversight portal for monitoring project health and inspection progress.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Active Projects</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{projects.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Total Inspections</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{inspections.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Monitored Components</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{components.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500">Certified Reviews</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{reviews.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT MODALS ACCESSIBLE ON DASHBOARD                                     */}
      {/* ========================================================================= */}
      {/* 1. New Inspection Modal */}
      {isNewInspectionModalOpen && (
        <NewInspectionModal
          token={token}
          onClose={() => setIsNewInspectionModalOpen(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh()
          }}
          onAnalyze={(inspection, imageId) => {
            setIsNewInspectionModalOpen(false)
            setAnalysisTarget({ inspection, imageId })
          }}
        />
      )}

      {/* 2. Upload Photo Modal */}
      {photoModalInspection && (
        <UploadPhotoModal
          inspection={photoModalInspection}
          token={token}
          onClose={() => setPhotoModalInspection(null)}
          onSuccess={() => {
            if (onRefresh) onRefresh()
          }}
          onAnalyze={(inspection, imageId) => {
            setPhotoModalInspection(null)
            setAnalysisTarget({ inspection, imageId })
          }}
        />
      )}

      {/* 3. AI Crack Screening Modal */}
      {analysisTarget && (
        <AiAnalysisModal
          inspection={analysisTarget.inspection}
          initialImageId={analysisTarget.imageId}
          token={token}
          userRole={effectiveRole}
          onClose={() => setAnalysisTarget(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh()
          }}
        />
      )}

      {/* 4. Engineer Review Modal */}
      {isSubmitReviewModalOpen && (
        <SubmitReviewModal
          isOpen={isSubmitReviewModalOpen}
          initialInspection={reviewModalInspection}
          inspections={inspections}
          token={token}
          onClose={() => {
            setIsSubmitReviewModalOpen(false)
            setReviewModalInspection(null)
          }}
          onSuccess={() => {
            setIsSubmitReviewModalOpen(false)
            setReviewModalInspection(null)
            if (onRefresh) onRefresh()
          }}
        />
      )}
    </div>
  )
}
