import { useState, useEffect, useCallback } from 'react'

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
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const REVIEW_DECISIONS = [
  {
    id: 'MONITOR',
    label: 'MONITOR',
    title: 'Periodic Monitoring',
    description: 'Track in subsequent surveys. No urgent structural intervention required.',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    id: 'INSPECT_FURTHER',
    label: 'INSPECT_FURTHER',
    title: 'Detailed Inspection',
    description: 'Requires closer manual physical inspection or non-destructive testing.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: 'REQUIRES_FURTHER_ASSESSMENT',
    label: 'REQUIRES_FURTHER_ASSESSMENT',
    title: 'Specialist Assessment',
    description: 'Structural safety assessment warranted by structural engineering team.',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
  },
  {
    id: 'NO_ACTION_REQUIRED',
    label: 'NO_ACTION_REQUIRED',
    title: 'No Action Required',
    description: 'Superficial surface blemish, formwork mark, or benign condition.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'REPAIR_REQUIRED',
    label: 'REPAIR_REQUIRED',
    title: 'Repair / Intervention',
    description: 'Surface sealing, epoxy injection, or active remediation required.',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
  },
]

export default function SubmitReviewModal({
  isOpen,
  onClose,
  initialInspection = null,
  initialAnalysisId = null,
  inspections = [],
  token,
  onSuccess,
}) {
  const [selectedInspectionId, setSelectedInspectionId] = useState(
    initialInspection?.id
      ? String(initialInspection.id)
      : inspections.length > 0
      ? String(inspections[0].id)
      : ''
  )
  const [analyses, setAnalyses] = useState([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [analysesError, setAnalysesError] = useState(null)

  const [selectedAnalysisId, setSelectedAnalysisId] = useState(
    initialAnalysisId ? String(initialAnalysisId) : ''
  )

  const [decision, setDecision] = useState('MONITOR')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Fetch analyses for the chosen inspection
  useEffect(() => {
    if (!selectedInspectionId || !token) return

    let active = true
    const fetchAnalyses = async () => {
      setLoadingAnalyses(true)
      setAnalysesError(null)
      try {
        const res = await fetch(`/api/inspections/${selectedInspectionId}/analysis`, {
          headers: authHeaders(),
        })
        if (!res.ok) {
          throw new Error(`Failed to load analyses (HTTP ${res.status})`)
        }
        const data = await res.json()
        const norm = parseArrayResponse(data)
        if (active) {
          setAnalyses(norm)
          if (norm.length > 0) {
            setSelectedAnalysisId((current) => {
              const matched = norm.some((a) => String(a.id) === String(current))
              return matched ? current : String(norm[norm.length - 1].id)
            })
          } else {
            setSelectedAnalysisId('')
          }
        }
      } catch (err) {
        if (active) {
          setAnalyses([])
          setSelectedAnalysisId('')
          setAnalysesError(err.message || 'Error loading analyses for this inspection')
        }
      } finally {
        if (active) {
          setLoadingAnalyses(false)
        }
      }
    }

    fetchAnalyses()
    return () => {
      active = false
    }
  }, [selectedInspectionId, token, authHeaders])

  if (!isOpen) return null

  const selectedAnalysis = analyses.find((a) => String(a.id) === String(selectedAnalysisId))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedInspectionId || !selectedAnalysisId) {
      setSubmitError('Please select both an inspection and an AI analysis to review.')
      return
    }
    if (!comments.trim()) {
      setSubmitError('Review comments are required. Provide professional engineering observations.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(
        `/api/inspections/${selectedInspectionId}/analysis/${selectedAnalysisId}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            decision,
            comments: comments.trim(),
          }),
        }
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Failed to submit review (HTTP ${res.status})`)
      }

      const reviewData = await res.json()
      if (onSuccess) {
        onSuccess(reviewData)
      }
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Error submitting review determination.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Record Engineer Review</h3>
              <p className="text-xs text-slate-300">
                Official determination appended to the permanent inspection audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              <p className="font-semibold">Submission Error</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          )}

          {/* Inspection and Analysis Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="review-inspection-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Inspection
              </label>
              <select
                id="review-inspection-select"
                value={selectedInspectionId}
                onChange={(e) => {
                  setSelectedInspectionId(e.target.value)
                  setSelectedAnalysisId('')
                  setAnalyses([])
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none"
              >
                <option value="">Select an Inspection...</option>
                {inspections.map((insp) => (
                  <option key={insp.id} value={insp.id}>
                    Inspection #{insp.id} &bull; {insp.component?.name || 'Structural Component'} ({insp.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="review-analysis-select" className="block text-xs font-semibold text-slate-700 mb-1">
                AI Analysis Run
              </label>
              <select
                id="review-analysis-select"
                value={selectedAnalysisId}
                disabled={!selectedInspectionId || loadingAnalyses || analyses.length === 0}
                onChange={(e) => setSelectedAnalysisId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none disabled:opacity-50"
              >
                {loadingAnalyses ? (
                  <option value="">Loading analyses...</option>
                ) : analyses.length === 0 ? (
                  <option value="">No AI analyses for this inspection</option>
                ) : (
                  analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      Analysis #{a.id} &bull; {a.screeningCategory || 'NORMAL'} ({formatDate(a.analyzedAt)})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {analysesError && (
            <p className="text-xs text-red-600">{analysesError}</p>
          )}

          {/* Missing AI Analysis Alert */}
          {selectedInspectionId && !loadingAnalyses && analyses.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <svg className="h-4 w-4 text-amber-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>No Preliminary AI Screening Results</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Inspection #{selectedInspectionId} does not have any recorded AI analyses.
                Structural engineering procedures require automated preliminary visual screening before an official determination can be recorded.
                Please upload an image and execute AI visual screening first.
              </p>
            </div>
          )}

          {/* Selected Analysis Snapshot Card */}
          {selectedAnalysis && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  Screening Summary &bull; Analysis #{selectedAnalysis.id}
                </span>
                <span className="text-slate-400">
                  {formatDate(selectedAnalysis.analyzedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-sans">Category</span>
                  <span className="font-bold text-slate-800">{selectedAnalysis.screeningCategory || 'NORMAL'}</span>
                </div>
                <div className="rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-sans">Crack Detected</span>
                  <span className={`font-bold ${selectedAnalysis.crackDetected ? 'text-red-600' : 'text-emerald-600'}`}>
                    {selectedAnalysis.crackDetected ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-sans">Crack Area</span>
                  <span className="font-bold text-slate-800">
                    {selectedAnalysis.crackAreaPercentage != null ? `${selectedAnalysis.crackAreaPercentage.toFixed(2)}%` : '0.00%'}
                  </span>
                </div>
                <div className="rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-sans">Regions</span>
                  <span className="font-bold text-slate-800">
                    {selectedAnalysis.regionsCount ?? 0} paths
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Decision Selection Cards */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-800">
              Professional Determination (Required)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {REVIEW_DECISIONS.map((item) => {
                const isSelected = decision === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDecision(item.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.badgeClass}`}>
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      {item.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Engineer Comments Textarea */}
          <div className="space-y-1">
            <label htmlFor="review-comments" className="block text-xs font-semibold text-slate-800">
              Engineer Comments & Recommendations (Required)
            </label>
            <textarea
              id="review-comments"
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Record structural observations, crack propagation risks, testing recommendations, or intervention plans..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            <span className="text-[10px] text-slate-400">
              Comments are preserved permanently with your authenticated reviewer identity.
            </span>
          </div>

          {/* Statutory / Accountability Notice */}
          <div className="rounded-xl bg-slate-900 text-slate-300 p-3 text-[11px] leading-relaxed border border-slate-800 flex items-start gap-2">
            <svg className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              By submitting this review, you attest that you are an authorized site engineer or administrator.
              AI screening outputs are advisory; this entry represents your certified engineering determination.
            </span>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedAnalysisId || !comments.trim() || analyses.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Submitting Review...</span>
                </>
              ) : (
                <span>Submit Official Determination</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
