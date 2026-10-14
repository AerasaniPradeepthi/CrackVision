import { useState, useEffect, useCallback, useMemo } from 'react'

function parseArrayResponse(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.content)) return data.content
    if (Array.isArray(data.data)) return data.data
    if (data.id) return [data]
  }
  return []
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

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

function getCategoryBadge(category) {
  switch (category) {
    case 'SEVERE':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'MODERATE':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'MINOR':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200'
    case 'NORMAL':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getDecisionBadge(decision) {
  switch (decision) {
    case 'MONITOR':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'INSPECT_FURTHER':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'REQUIRES_FURTHER_ASSESSMENT':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'NO_ACTION_REQUIRED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'REPAIR_REQUIRED':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function getTrendBadge(trend) {
  switch (trend) {
    case 'AREA_EXPANSION_INDICATED':
      return {
        label: 'Worsening (Expansion Indicated)',
        badgeClass: 'bg-red-100 text-red-800 border-red-300',
        cardClass: 'border-red-200 bg-red-50/50',
        icon: '▲',
      }
    case 'AREA_REDUCTION_INDICATED':
      return {
        label: 'Improving (Reduction Indicated)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        cardClass: 'border-emerald-200 bg-emerald-50/50',
        icon: '▼',
      }
    case 'STABLE_SCREENING_METRICS':
      return {
        label: 'Stable Screening Metrics',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        cardClass: 'border-blue-200 bg-blue-50/50',
        icon: '■',
      }
    case 'NEW_DETECTION':
      return {
        label: 'New Crack Candidate Detected',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        cardClass: 'border-amber-200 bg-amber-50/50',
        icon: '!',
      }
    case 'NO_CANDIDATE_DETECTED':
      return {
        label: 'Clear / No Crack Detected',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        cardClass: 'border-slate-200 bg-slate-50/50',
        icon: '✓',
      }
    case 'SINGLE_ANALYSIS_BASELINE':
      return {
        label: 'Initial Baseline Established',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        cardClass: 'border-indigo-200 bg-indigo-50/50',
        icon: '★',
      }
    default:
      return {
        label: trend || 'Comparative Trend Pending',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        cardClass: 'border-slate-200 bg-white',
        icon: '•',
      }
  }
}

// Secure Image Component for Baseline & Current inspection photos
function SecureComparisonImage({ inspectionId, imageId, highlightedUrl, token, title }) {
  const [viewMode, setViewMode] = useState('highlighted') // 'highlighted' | 'original'
  const [blobUrl, setBlobUrl] = useState(null)
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const effectiveHighlighted = formatHighlightedImageUrl(highlightedUrl)

  // Revoke blob URL on component unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  const handleSwitchToOriginal = async () => {
    setViewMode('original')
    if (blobUrl || loadingOriginal) return
    if (!inspectionId || !imageId || !token) return

    setLoadingOriginal(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/images/${imageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const created = URL.createObjectURL(blob)
      setBlobUrl(created)
    } catch (err) {
      setLoadError(err.message || 'Failed to load photo')
    } finally {
      setLoadingOriginal(false)
    }
  }

  const currentSrc = viewMode === 'highlighted' && effectiveHighlighted ? effectiveHighlighted : blobUrl

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs">
      {/* Header bar with Mode Toggles */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
        <span className="font-semibold text-slate-700 truncate">{title}</span>
        <div className="inline-flex rounded-md shadow-2xs bg-white border border-slate-300 p-0.5">
          <button
            type="button"
            disabled={!effectiveHighlighted}
            onClick={() => setViewMode('highlighted')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'highlighted'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            AI Overlay
          </button>
          <button
            type="button"
            onClick={handleSwitchToOriginal}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'original' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Original
          </button>
        </div>
      </div>

      {/* Image Preview Area */}
      <div className="relative aspect-4/3 w-full bg-slate-900 flex items-center justify-center overflow-hidden group">
        {loadingOriginal ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[11px]">Loading original photo...</span>
          </div>
        ) : loadError ? (
          <div className="p-4 text-center text-red-400">
            <span className="text-[11px] font-semibold">Image unavailable</span>
            <p className="text-[10px] text-slate-400 mt-1">{loadError}</p>
          </div>
        ) : currentSrc ? (
          <>
            <img
              src={currentSrc}
              alt={title}
              className="max-h-full max-w-full object-contain cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              onError={() => {
                if (viewMode === 'highlighted') {
                  handleSwitchToOriginal()
                }
              }}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            >
              Zoom
            </button>
          </>
        ) : (
          <div className="text-center p-4 text-slate-400">
            <span className="text-[11px]">No overlay or image record found</span>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && currentSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 text-white text-sm font-semibold hover:text-slate-300"
            >
              ✕ Close
            </button>
            <img src={currentSrc} alt={title} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl" />
            <div className="mt-2 text-center text-xs text-slate-300">
              {title} &bull; Mode: {viewMode === 'highlighted' ? 'AI Highlighted Overlay' : 'Original Photo'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Trend Line / Area Chart rendered using responsive pure SVG
function ProgressionTrendChart({ timeline = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)

  if (!timeline || timeline.length === 0) return null

  // Ensure chronological order (oldest first)
  const sorted = [...timeline].sort((a, b) => new Date(a.analyzedAt) - new Date(b.analyzedAt))

  // Chart dimensions
  const svgWidth = 720
  const svgHeight = 220
  const padLeft = 45
  const padRight = 45
  const padTop = 25
  const padBottom = 40

  const plotW = svgWidth - padLeft - padRight
  const plotH = svgHeight - padTop - padBottom

  // Extract values
  const areaValues = sorted.map((s) => (s.crackAreaPercentage != null ? s.crackAreaPercentage : 0))
  const regionValues = sorted.map((s) => (s.regionsCount != null ? s.regionsCount : 0))

  const maxArea = Math.max(0.5, ...areaValues) * 1.15
  const maxRegions = Math.max(5, ...regionValues) * 1.15

  const points = sorted.map((item, idx) => {
    const x = sorted.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (sorted.length - 1)) * plotW
    const area = item.crackAreaPercentage != null ? item.crackAreaPercentage : 0
    const regions = item.regionsCount != null ? item.regionsCount : 0
    const yArea = padTop + plotH - (area / maxArea) * plotH
    const yRegions = padTop + plotH - (regions / maxRegions) * plotH

    return {
      x,
      yArea,
      yRegions,
      area,
      regions,
      snapshot: item,
      dateLabel: formatShortDate(item.analyzedAt),
    }
  })

  const areaLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yArea}`).join(' ')
  const regionsLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yRegions}`).join(' ')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Screening Progression Over Time
          </h3>
          <p className="text-xs text-slate-500">
            Chronological trend of crack area percentage and candidate regions from classical CV baseline
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
            <span className="text-slate-600 font-medium">Crack Area %</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-600 font-medium">Region Count</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[500px]"
          style={{ overflow: 'visible' }}
        >
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padTop + plotH * (1 - pct)
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="sans-serif"
                >
                  {(maxArea * pct).toFixed(2)}%
                </text>
                <text
                  x={svgWidth - padRight + 8}
                  y={y + 3}
                  textAnchor="start"
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="sans-serif"
                >
                  {Math.round(maxRegions * pct)}
                </text>
              </g>
            )
          })}

          {/* Area % Path */}
          {points.length > 1 && (
            <path
              d={areaLinePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Region Count Path */}
          {points.length > 1 && (
            <path
              d={regionsLinePath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {points.map((pt, idx) => (
            <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredPoint(pt)}>
              {/* Region Node */}
              <circle
                cx={pt.x}
                cy={pt.yRegions}
                r="4.5"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {/* Area Node */}
              <circle
                cx={pt.x}
                cy={pt.yArea}
                r="5.5"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* X Date Label */}
              <text
                x={pt.x}
                y={padTop + plotH + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
                fontFamily="sans-serif"
              >
                {pt.dateLabel}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none rounded-lg bg-slate-900 text-white p-3 shadow-lg border border-slate-700 text-xs space-y-1 transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.yArea / svgHeight) * 100}%`,
            }}
          >
            <div className="font-semibold text-slate-200">
              Analysis #{hoveredPoint.snapshot.analysisId} &bull; {formatDate(hoveredPoint.snapshot.analyzedAt)}
            </div>
            <div className="flex items-center gap-3 pt-1 text-[11px]">
              <span className="text-blue-400 font-mono">
                Area: {hoveredPoint.area.toFixed(2)}%
              </span>
              <span className="text-amber-400 font-mono">
                Regions: {hoveredPoint.regions}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getCategoryBadge(
                  hoveredPoint.snapshot.screeningCategory
                )}`}
              >
                {hoveredPoint.snapshot.screeningCategory}
              </span>
            </div>
            {hoveredPoint.snapshot.latestReviewDecision && (
              <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1">
                Review: {hoveredPoint.snapshot.latestReviewDecision}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-400 italic text-center">
        Hover over data points to inspect individual survey screening measurements.
      </div>
    </div>
  )
}

export default function MonitoringView({
  projects = [],
  components = [],
  selectedComponentId = null,
  onSelectComponent,
  token,
  onSelectTab,
}) {
  // Cascading Location Filters
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterBuildingId, setFilterBuildingId] = useState('')
  const [filterFloorId, setFilterFloorId] = useState('')

  const [buildings, setBuildings] = useState([])
  const [floors, setFloors] = useState([])
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [loadingFloors, setLoadingFloors] = useState(false)

  // Active component ID selection derived cleanly without effect syncing
  const [selectedCompOverride, setSelectedCompOverride] = useState(null)
  const activeComponentId = selectedCompOverride ?? selectedComponentId ?? (components[0]?.id ?? null)

  // Timeline and Comparison data
  const [timelineData, setTimelineData] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [timelineError, setTimelineError] = useState(null)
  const [comparisonError, setComparisonError] = useState(null)

  // Custom analysis comparison pair (when component has >= 2 analyses)
  const [customBaselineId, setCustomBaselineId] = useState('')
  const [customCurrentId, setCustomCurrentId] = useState('')

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Filter change handlers
  const handleProjectFilterChange = (e) => {
    const val = e.target.value
    setFilterProjectId(val)
    setFilterBuildingId('')
    setFilterFloorId('')
    setBuildings([])
    setFloors([])
  }

  const handleBuildingFilterChange = (e) => {
    const val = e.target.value
    setFilterBuildingId(val)
    setFilterFloorId('')
    setFloors([])
  }

  // Cascading 1: Fetch buildings when filterProjectId is active
  useEffect(() => {
    if (!filterProjectId || !token) return

    let active = true
    const fetchBuildings = async () => {
      setLoadingBuildings(true)
      try {
        const res = await fetch(`/api/buildings/project/${filterProjectId}`, {
          headers: authHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          if (active) setBuildings(parseArrayResponse(data))
        }
      } catch {
        if (active) setBuildings([])
      } finally {
        if (active) setLoadingBuildings(false)
      }
    }

    fetchBuildings()
    return () => {
      active = false
    }
  }, [filterProjectId, token, authHeaders])

  // Cascading 2: Fetch floors when filterBuildingId is active
  useEffect(() => {
    if (!filterBuildingId || !token) return

    let active = true
    const fetchFloors = async () => {
      setLoadingFloors(true)
      try {
        const res = await fetch(`/api/floors/building/${filterBuildingId}`, {
          headers: authHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          if (active) setFloors(parseArrayResponse(data))
        }
      } catch {
        if (active) setFloors([])
      } finally {
        if (active) setLoadingFloors(false)
      }
    }

    fetchFloors()
    return () => {
      active = false
    }
  }, [filterBuildingId, token, authHeaders])

  // Filter components list based on cascade or show all
  const filteredComponents = useMemo(() => {
    if (!filterProjectId && !filterBuildingId && !filterFloorId) {
      return components
    }
    return components.filter((c) => {
      if (filterFloorId && c.floor?.id && c.floor.id !== Number(filterFloorId)) {
        return false
      }
      return true
    })
  }, [components, filterProjectId, filterBuildingId, filterFloorId])

  // Load Timeline and Comparison whenever activeComponentId or token changes
  useEffect(() => {
    if (!activeComponentId || !token) return

    let active = true
    const loadAll = async () => {
      setLoadingTimeline(true)
      setLoadingComparison(true)
      setTimelineError(null)
      setComparisonError(null)

      try {
        const [tRes, cRes] = await Promise.all([
          fetch(`/api/components/${activeComponentId}/monitoring/timeline`, {
            headers: authHeaders(),
          }),
          fetch(`/api/components/${activeComponentId}/monitoring/compare`, {
            headers: authHeaders(),
          }),
        ])

        if (!tRes.ok) {
          if (tRes.status === 404) {
            if (active) setTimelineData({ timeline: [] })
          } else {
            throw new Error(`Failed to load timeline (Status ${tRes.status})`)
          }
        } else {
          const tData = await tRes.json()
          if (active) setTimelineData(tData)
        }

        if (!cRes.ok) {
          if (cRes.status === 404) {
            if (active) setComparisonData(null)
          } else {
            const errData = await cRes.json().catch(() => null)
            if (active) setComparisonError(errData?.error || `HTTP ${cRes.status}`)
          }
        } else {
          const cData = await cRes.json()
          if (active) setComparisonData(cData)
        }
      } catch (err) {
        if (active) setTimelineError(err.message || 'Error loading monitoring data')
      } finally {
        if (active) {
          setLoadingTimeline(false)
          setLoadingComparison(false)
        }
      }
    }

    loadAll()

    return () => {
      active = false
    }
  }, [activeComponentId, token, authHeaders])

  // Custom pair comparison called by form submission
  const fetchCustomComparison = async (baselineId, currentId) => {
    if (!activeComponentId || !token) return

    setLoadingComparison(true)
    setComparisonError(null)

    try {
      let url = `/api/components/${activeComponentId}/monitoring/compare`
      if (baselineId && currentId) {
        url += `?baselineId=${baselineId}&currentId=${currentId}`
      }

      const res = await fetch(url, {
        headers: authHeaders(),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Failed to compare analyses (HTTP ${res.status})`)
      }

      const data = await res.json()
      setComparisonData(data)
    } catch (err) {
      setComparisonError(err.message || 'Error comparing analyses')
    } finally {
      setLoadingComparison(false)
    }
  }

  const handleCustomCompareSubmit = (e) => {
    e.preventDefault()
    if (!customBaselineId || !customCurrentId) return
    if (customBaselineId === customCurrentId) {
      setComparisonError('Baseline and current analyses must be distinct.')
      return
    }
    fetchCustomComparison(customBaselineId, customCurrentId)
  }

  const handleResetToLatestCompare = () => {
    setCustomBaselineId('')
    setCustomCurrentId('')
    fetchCustomComparison(null, null)
  }

  // Active component object details
  const currentComponent = useMemo(() => {
    return components.find((c) => c.id === activeComponentId) || null
  }, [components, activeComponentId])

  const timelineEntries = timelineData?.timeline || []

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Component Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Component Monitoring & Crack Progression
          </h2>
          <p className="text-xs text-slate-500">
            Longitudinal AI screening timeline, delta metrics, and comparative visual analysis
          </p>
        </div>

        {/* Primary Component Selector */}
        {components.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="component-select" className="text-xs font-semibold text-slate-700">
              Active Component:
            </label>
            <select
              id="component-select"
              value={activeComponentId || ''}
              onChange={(e) => {
                const val = Number(e.target.value)
                setSelectedCompOverride(val)
                setCustomBaselineId('')
                setCustomCurrentId('')
                if (onSelectComponent) onSelectComponent(val)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[280px]"
            >
              {filteredComponents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cascading Filter Bar */}
      {projects.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
              Filter By Structure Hierarchy
            </span>
            {(filterProjectId || filterBuildingId || filterFloorId) && (
              <button
                type="button"
                onClick={() => {
                  setFilterProjectId('')
                  setFilterBuildingId('')
                  setFilterFloorId('')
                  setBuildings([])
                  setFloors([])
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Reset Hierarchy Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Project Filter */}
            <div>
              <label htmlFor="monitoring-project-filter" className="block text-[11px] font-medium text-slate-500 mb-1">
                Project
              </label>
              <select
                id="monitoring-project-filter"
                value={filterProjectId}
                onChange={handleProjectFilterChange}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Building Filter */}
            <div>
              <label htmlFor="monitoring-building-filter" className="block text-[11px] font-medium text-slate-500 mb-1">
                Building
              </label>
              <select
                id="monitoring-building-filter"
                value={filterBuildingId}
                disabled={!filterProjectId || loadingBuildings}
                onChange={handleBuildingFilterChange}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50"
              >
                <option value="">{loadingBuildings ? 'Loading...' : 'All Buildings'}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Floor Filter */}
            <div>
              <label htmlFor="monitoring-floor-filter" className="block text-[11px] font-medium text-slate-500 mb-1">
                Floor
              </label>
              <select
                id="monitoring-floor-filter"
                value={filterFloorId}
                disabled={!filterBuildingId || loadingFloors}
                onChange={(e) => setFilterFloorId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-50"
              >
                <option value="">{loadingFloors ? 'Loading...' : 'All Floors'}</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    Floor {f.floorNumber} {f.name ? `(${f.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      {components.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-base font-semibold text-slate-800">No Structural Components</h3>
          <p className="text-xs text-slate-400 mt-1">
            No components have been registered for monitoring yet.
          </p>
        </div>
      ) : loadingTimeline ? (
        <div className="p-12 flex flex-col items-center justify-center min-h-[300px] text-slate-500">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-medium">Fetching longitudinal monitoring data...</span>
        </div>
      ) : timelineError ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-sm text-red-700">
          <p className="font-semibold">Unable to fetch timeline data</p>
          <p className="text-xs text-red-600 mt-1">{timelineError}</p>
        </div>
      ) : timelineEntries.length === 0 ? (
        /* Empty state: 0 recorded analyses */
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-4">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-base font-semibold text-slate-800">No Screening History Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Component &ldquo;{currentComponent?.name || 'Selected Component'}&rdquo; does not have any recorded AI analyses. Upload a photo and run an AI screening from Inspections to begin tracking progression.
            </p>
          </div>
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('inspections')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <span>Go to Inspections</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Component Details Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {timelineData.componentName || currentComponent?.name}
                </h3>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {timelineData.componentType || currentComponent?.type}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {timelineData.componentDescription || currentComponent?.description || 'Monitored structural component'}
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
              {timelineEntries.length} Recorded Screening{timelineEntries.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* SINGLE BASELINE STATE (1 Analysis recorded) */}
          {timelineEntries.length === 1 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6 space-y-3">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px]">
                  ★
                </span>
                <span>Initial Inspection Baseline Established</span>
              </div>
              <p className="text-xs text-indigo-700 leading-relaxed">
                A single inspection has been recorded for this component on {formatDate(timelineEntries[0].analyzedAt)}.
                A subsequent inspection and AI analysis is required to calculate progression deltas, area expansion, and growth rates.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab('inspections')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-900 bg-white border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <span>Log Subsequent Inspection</span> &rarr;
                </button>
              )}
            </div>
          )}

          {/* COMPARISON CARD & METRICS (When comparison data is available) */}
          {comparisonData && (
            <div className={`rounded-xl border p-5 shadow-2xs space-y-5 ${getTrendBadge(comparisonData.progressionTrend).cardClass}`}>
              {/* Header with Trend Badge & Pair Selector */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900">
                    Comparative Delta Analysis
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      getTrendBadge(comparisonData.progressionTrend).badgeClass
                    }`}
                  >
                    <span>{getTrendBadge(comparisonData.progressionTrend).icon}</span>
                    <span>{getTrendBadge(comparisonData.progressionTrend).label}</span>
                  </span>
                </div>

                {/* Custom Pair Selector (if timeline has >= 2 analyses) */}
                {timelineEntries.length >= 2 && (
                  <form onSubmit={handleCustomCompareSubmit} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-600 font-medium">Compare:</span>
                    <select
                      value={customBaselineId || comparisonData.baseline?.analysisId || ''}
                      onChange={(e) => setCustomBaselineId(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-[11px] shadow-2xs"
                    >
                      {timelineEntries.map((e) => (
                        <option key={e.analysisId} value={e.analysisId}>
                          Baseline #{e.analysisId} ({formatShortDate(e.analyzedAt)})
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400">&rarr;</span>
                    <select
                      value={customCurrentId || comparisonData.current?.analysisId || ''}
                      onChange={(e) => setCustomCurrentId(e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 text-[11px] shadow-2xs"
                    >
                      {timelineEntries.map((e) => (
                        <option key={e.analysisId} value={e.analysisId}>
                          Current #{e.analysisId} ({formatShortDate(e.analyzedAt)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={loadingComparison}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] cursor-pointer"
                    >
                      {loadingComparison ? 'Comparing...' : 'Compare'}
                    </button>
                    {(customBaselineId || customCurrentId) && (
                      <button
                        type="button"
                        onClick={handleResetToLatestCompare}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Reset to Latest
                      </button>
                    )}
                  </form>
                )}
              </div>

              {comparisonError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {comparisonError}
                </div>
              )}

              {/* Comparative Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Days Elapsed */}
                <div className="rounded-lg bg-white border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Days Elapsed
                  </span>
                  <div className="mt-1 font-mono text-base font-bold text-slate-900">
                    {comparisonData.daysElapsed != null ? `${comparisonData.daysElapsed} Days` : 'N/A (Baseline)'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Between inspection dates
                  </span>
                </div>

                {/* Screening Category Delta */}
                <div className="rounded-lg bg-white border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Screening Transition
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {comparisonData.previousScreeningCategory && (
                      <>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadge(
                            comparisonData.previousScreeningCategory
                          )}`}
                        >
                          {comparisonData.previousScreeningCategory}
                        </span>
                        <span className="text-slate-400">&rarr;</span>
                      </>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadge(
                        comparisonData.currentScreeningCategory
                      )}`}
                    >
                      {comparisonData.currentScreeningCategory || 'NORMAL'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {comparisonData.screeningCategoryChanged ? 'Severity category shifted' : 'Category unchanged'}
                  </span>
                </div>

                {/* Crack Area Percentage Delta */}
                <div className="rounded-lg bg-white border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Area Delta (Δ)
                  </span>
                  <div className="mt-1 font-mono text-base font-bold">
                    {comparisonData.areaPercentageDelta != null ? (
                      <span
                        className={
                          comparisonData.areaPercentageDelta > 0.05
                            ? 'text-red-600'
                            : comparisonData.areaPercentageDelta < -0.05
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                        }
                      >
                        {comparisonData.areaPercentageDelta > 0 ? '+' : ''}
                        {comparisonData.areaPercentageDelta.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-slate-500">Baseline</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {comparisonData.baseline
                      ? `${comparisonData.baseline.crackAreaPercentage?.toFixed(2)}% → ${comparisonData.current?.crackAreaPercentage?.toFixed(2)}%`
                      : 'Initial baseline'}
                  </span>
                </div>

                {/* Region Count Delta */}
                <div className="rounded-lg bg-white border border-slate-200/90 p-3 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Regions Delta (Δ)
                  </span>
                  <div className="mt-1 font-mono text-base font-bold">
                    {comparisonData.regionsCountDelta != null ? (
                      <span
                        className={
                          comparisonData.regionsCountDelta > 0
                            ? 'text-amber-600'
                            : comparisonData.regionsCountDelta < 0
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                        }
                      >
                        {comparisonData.regionsCountDelta > 0 ? '+' : ''}
                        {comparisonData.regionsCountDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500">Baseline</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {comparisonData.baseline
                      ? `${comparisonData.baseline.regionsCount} → ${comparisonData.current?.regionsCount} paths`
                      : 'Initial baseline'}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Visual Comparison (Baseline vs Current) */}
              {comparisonData.baseline && comparisonData.current && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Visual Side-by-Side Inspection Comparison
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Baseline Photo */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span className="font-semibold text-slate-700">
                          Baseline: Analysis #{comparisonData.baseline.analysisId}
                        </span>
                        <span>{formatDate(comparisonData.baseline.analyzedAt)}</span>
                      </div>
                      <SecureComparisonImage
                        inspectionId={comparisonData.baseline.inspectionId}
                        imageId={comparisonData.baseline.imageId}
                        highlightedUrl={comparisonData.baseline.highlightedImageUrl}
                        token={token}
                        title={`Baseline Analysis #${comparisonData.baseline.analysisId}`}
                      />
                    </div>

                    {/* Current Photo */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span className="font-semibold text-slate-700">
                          Current: Analysis #{comparisonData.current.analysisId}
                        </span>
                        <span>{formatDate(comparisonData.current.analyzedAt)}</span>
                      </div>
                      <SecureComparisonImage
                        inspectionId={comparisonData.current.inspectionId}
                        imageId={comparisonData.current.imageId}
                        highlightedUrl={comparisonData.current.highlightedImageUrl}
                        token={token}
                        title={`Current Analysis #${comparisonData.current.analysisId}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Prominent Engineering Disclaimer */}
              <div className="rounded-lg bg-slate-900 text-slate-300 p-4 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Engineering Advisory & Screening Disclaimer</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  {comparisonData.comparisonDisclaimer ||
                    'Screening metrics are 2D image indicators only. Variations may result from lighting, camera angle, distance, or surface moisture. Numeric deltas do not constitute certified physical crack growth rates or structural safety certifications. On-site qualified engineer evaluation is required.'}
                </p>
              </div>
            </div>
          )}

          {/* TREND CHART */}
          {timelineEntries.length >= 2 && (
            <ProgressionTrendChart timeline={timelineEntries} />
          )}

          {/* CHRONOLOGICAL TIMELINE OF ALL RECORDED ANALYSES */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Chronological Inspection Timeline
              </h3>
              <p className="text-xs text-slate-500">
                Detailed record of each AI screening run and engineer review decisions
              </p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
              {timelineEntries.map((entry) => (
                <div key={entry.analysisId} className="relative">
                  {/* Timeline Pin */}
                  <div className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-xs" />

                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    {/* Header: Analysis ID, Inspection ID, Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          Analysis #{entry.analysisId}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs text-slate-500">
                          Inspection #{entry.inspectionId} (Image #{entry.imageId})
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {formatDate(entry.analyzedAt)}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Screening Category
                        </span>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getCategoryBadge(
                              entry.screeningCategory
                            )}`}
                          >
                            {entry.screeningCategory || 'NORMAL'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Detection Status
                        </span>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              entry.crackDetected
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {entry.crackDetected ? 'CRACK DETECTED' : 'CLEAR'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Crack Area %
                        </span>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-900">
                          {entry.crackAreaPercentage !== null && entry.crackAreaPercentage !== undefined
                            ? `${entry.crackAreaPercentage.toFixed(2)}%`
                            : 'N/A'}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Region Count
                        </span>
                        <div className="mt-1 font-mono text-xs font-bold text-slate-900">
                          {entry.regionsCount !== null && entry.regionsCount !== undefined
                            ? entry.regionsCount
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* AI Model Baseline Transparency Card */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-700">Model: </span>
                        <span>{entry.modelName || 'OpenCV Classical Heuristic (v1.0.0)'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Confidence: </span>
                        <span className="text-slate-500 italic">
                          {entry.confidence != null ? `${(entry.confidence * 100).toFixed(1)}%` : 'Not available (Heuristic baseline)'}
                        </span>
                      </div>
                    </div>

                    {/* Independent Engineer Review Status */}
                    <div className="rounded-lg bg-slate-900 text-white p-4 space-y-2 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold tracking-wider text-blue-400 uppercase">
                          Engineer Review Status
                        </span>
                        {entry.latestReviewDecision ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getDecisionBadge(
                              entry.latestReviewDecision
                            )}`}
                          >
                            {entry.latestReviewDecision}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Pending Engineer Review
                          </span>
                        )}
                      </div>

                      {entry.latestReviewDecision && (
                        <div className="text-xs space-y-1 pt-1">
                          <p className="text-slate-300 font-sans italic">
                            &ldquo;{entry.latestReviewComments}&rdquo;
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                            <span>
                              Reviewer: {entry.reviewerName || 'Site Engineer'} ({entry.reviewerEmail})
                            </span>
                            <span>Reviewed: {formatDate(entry.latestReviewedAt)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
