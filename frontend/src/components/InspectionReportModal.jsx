import { useState, useEffect, useCallback } from 'react'
import { resolveImageUrl } from '../api/config'

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

function formatHighlightedImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/outputs/')) return resolveImageUrl(url)
  if (url.startsWith('outputs/')) return resolveImageUrl(`/${url}`)
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/outputs')) {
      return resolveImageUrl(parsed.pathname)
    }
  } catch {
    // not full url
  }
  return resolveImageUrl(url)
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

export default function InspectionReportModal({
  isOpen,
  onClose,
  inspection,
  token,
}) {
  const [analyses, setAnalyses] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Report image preview blob
  const [originalBlobUrl, setOriginalBlobUrl] = useState(null)
  const [attemptOverlayFailed, setAttemptOverlayFailed] = useState(false)
  const [imageError, setImageError] = useState(false)

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Load inspection analysis, review, and image records
  useEffect(() => {
    if (!inspection?.id || !token || !isOpen) return

    let active = true
    let blobUrlToRevoke = null
    const loadReportData = async () => {
      setAttemptOverlayFailed(false)
      setImageError(false)
      setLoading(true)
      setError(null)

      try {
        const [aRes, rRes, iRes] = await Promise.all([
          fetch(`/api/inspections/${inspection.id}/analysis`, { headers: authHeaders() }),
          fetch(`/api/inspections/${inspection.id}/reviews`, { headers: authHeaders() }),
          fetch(`/api/inspections/${inspection.id}/images`, { headers: authHeaders() }),
        ])

        const [aData, rData, iData] = await Promise.all([
          aRes.ok ? aRes.json() : [],
          rRes.ok ? rRes.json() : [],
          iRes.ok ? iRes.json() : [],
        ])

        if (active) {
          const normA = parseArrayResponse(aData)
          const normR = parseArrayResponse(rData)
          const normI = parseArrayResponse(iData)
          setAnalyses(normA)
          setReviews(normR)

          // If images exist, match the image from latest analysis or prefer persistent cloud photo
          if (normI.length > 0) {
            const latestA = normA.length > 0 ? normA[normA.length - 1] : null
            const targetImg = (latestA?.imageId
              ? normI.find((img) => String(img.id) === String(latestA.imageId))
              : null) || normI.find((img) => (img.imageUrl && img.imageUrl.startsWith('http')) || (img.storagePath && img.storagePath.startsWith('http'))) || normI[0]

            const directUrl = (targetImg.imageUrl && targetImg.imageUrl.startsWith('http'))
              ? targetImg.imageUrl
              : (targetImg.storagePath && targetImg.storagePath.startsWith('http') ? targetImg.storagePath : null)

            if (directUrl) {
              setOriginalBlobUrl(directUrl)
            } else {
              fetch(`/api/inspections/${inspection.id}/images/${targetImg.id}`, {
                headers: authHeaders(),
              })
                .then((res) => (res.ok ? res.blob() : null))
                .then((blob) => {
                  if (active && blob) {
                    blobUrlToRevoke = URL.createObjectURL(blob)
                    setOriginalBlobUrl(blobUrlToRevoke)
                  }
                })
                .catch(() => {})
            }
          }
        }
      } catch (err) {
        if (active) setError(err.message || 'Error loading report details')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReportData()

    return () => {
      active = false
      if (blobUrlToRevoke && blobUrlToRevoke.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlToRevoke)
      }
    }
  }, [inspection?.id, token, isOpen, authHeaders])

  const reportDateStr = formatDate(inspection?.inspectionDate || inspection?.createdAt)
  const reportYear = (inspection?.inspectionDate || inspection?.createdAt || '2026').slice(0, 4)
  const reportId = `CV-RPT-${String(inspection?.id || 1).padStart(4, '0')}-${reportYear}`

  if (!isOpen || !inspection) return null

  const latestAnalysis = analyses.length > 0 ? analyses[analyses.length - 1] : null
  const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null
  const highlightedUrl = latestAnalysis ? formatHighlightedImageUrl(latestAnalysis.highlightedImageUrl) : null
  const candidateImageSrc = (!attemptOverlayFailed && highlightedUrl) ? highlightedUrl : originalBlobUrl

  const comp = inspection.component
  const floor = comp?.floor
  const building = floor?.building
  const project = building?.project

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-8 flex flex-col">
        {/* Actions Bar (Hidden during print) */}
        <div className="print:hidden flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold text-sm">Official Inspection Report Preview</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print / Export PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div id="printable-inspection-report" className="p-8 sm:p-12 space-y-6 text-slate-900 bg-white">
          {/* Document Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                  CV
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950">CrackVision</h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                    Structural Crack Detection & Monitoring System
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-mono">
                Document Ref: <strong className="text-slate-900">{reportId}</strong>
              </p>
            </div>

            <div className="text-right text-xs text-slate-600 space-y-0.5">
              <div className="font-bold text-slate-900 text-sm">STRUCTURAL INSPECTION REPORT</div>
              <div>Generated: {reportDateStr}</div>
              <div>System Version: 1.0.0-PROD</div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Compiling inspection findings and review audit trail...
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Structure Location & Survey Details */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  1. Structural Identification & Location
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Project</span>
                    <strong className="text-slate-800">{project?.name || 'Main Construction Site'}</strong>
                    <div className="text-[11px] text-slate-500">{project?.location || 'General Site'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Building & Level</span>
                    <strong className="text-slate-800">{building?.name || 'Primary Structure'}</strong>
                    <div className="text-[11px] text-slate-500">Floor {floor?.floorNumber ?? 'N/A'} {floor?.name ? `(${floor.name})` : ''}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Structural Component</span>
                    <strong className="text-slate-800">{comp?.name || 'Structural Component'}</strong>
                    <div className="text-[11px] text-slate-500">Type: {comp?.type || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Survey Timestamp</span>
                    <strong className="text-slate-800">{formatDate(inspection.inspectionDate || inspection.createdAt)}</strong>
                    <div className="text-[11px] text-slate-500">Status: {inspection.status}</div>
                  </div>
                </div>
              </div>

              {/* Physical Inspection Field Notes */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Field Observations & Inspector Notes
                </span>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 leading-relaxed italic">
                  &ldquo;{inspection.notes || 'No manual field survey notes recorded at the time of inspection.'}&rdquo;
                </div>
              </div>

              {/* Section 2: AI Computer Vision Screening Findings */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  2. Automated Visual Crack Screening Findings
                </h2>

                {latestAnalysis ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Findings Metrics Table */}
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                          <span className="text-[10px] text-slate-500 block uppercase">Screening Category</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 ${getCategoryBadge(latestAnalysis.screeningCategory)}`}>
                            {latestAnalysis.screeningCategory || 'NORMAL'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                          <span className="text-[10px] text-slate-500 block uppercase">Crack Indication</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 ${latestAnalysis.crackDetected ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {latestAnalysis.crackDetected ? 'CRACK DETECTED' : 'CLEAR'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                          <span className="text-[10px] text-slate-500 block uppercase">Surface Area %</span>
                          <span className="font-mono text-sm font-bold text-slate-900 mt-1 block">
                            {latestAnalysis.crackAreaPercentage != null ? `${latestAnalysis.crackAreaPercentage.toFixed(2)}%` : '0.00%'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                          <span className="text-[10px] text-slate-500 block uppercase">Detected Regions</span>
                          <span className="font-mono text-sm font-bold text-slate-900 mt-1 block">
                            {latestAnalysis.regionsCount ?? 0} candidate paths
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1 p-2 rounded bg-slate-50 border border-slate-200/80">
                        <div><strong>Model:</strong> {latestAnalysis.modelName || 'OpenCV Classical CV Baseline'}</div>
                        <div><strong>Pipeline:</strong> Classical Edge Morphology & Contour Filtering</div>
                        <div><strong>Statistical Confidence:</strong> <span className="italic">Not available (Handcrafted heuristic baseline)</span></div>
                        <div><strong>Analysis Timestamp:</strong> {formatDate(latestAnalysis.analyzedAt)}</div>
                      </div>
                    </div>

                    {/* Visual Evidence Photo */}
                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-900 flex items-center justify-center aspect-4/3">
                      {candidateImageSrc && !imageError ? (
                        <img
                          src={candidateImageSrc}
                          alt="Inspection visual evidence"
                          className="max-h-full max-w-full object-contain"
                          onError={() => {
                            if (!attemptOverlayFailed && highlightedUrl && originalBlobUrl) {
                              setAttemptOverlayFailed(true)
                            } else {
                              setImageError(true)
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
                          <svg className="h-6 w-6 text-slate-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">Photo record unavailable</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No automated AI screening has been run for this inspection survey yet.
                  </div>
                )}
              </div>

              {/* Section 3: Certified Site Engineer Determination */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                  3. Certified Engineer Determination & Action Plan
                </h2>

                {latestReview ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">Official Determination:</span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getDecisionBadge(latestReview.decision)}`}>
                          {latestReview.decision}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Certified: {formatDate(latestReview.reviewedAt || latestReview.createdAt)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Professional Recommendations & Findings
                      </span>
                      <p className="text-slate-800 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200">
                        &ldquo;{latestReview.comments}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>
                        Certifying Engineer: <strong>{latestReview.reviewer?.name || latestReview.reviewerName || 'Site Engineer'}</strong> ({latestReview.reviewer?.email || latestReview.reviewerEmail || ''})
                      </span>
                      <span>Review Record ID: #{latestReview.id}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    <strong>Pending Review:</strong> This inspection has not yet received official certified engineering verification.
                  </div>
                )}
              </div>

              {/* Section 4: Engineering Seal & Disclaimer */}
              <div className="rounded-xl border border-slate-300 p-4 bg-slate-50 text-[11px] text-slate-600 space-y-2">
                <span className="font-bold text-slate-800 uppercase block">
                  Mandatory Engineering & Statutory Advisory
                </span>
                <p className="leading-relaxed">
                  Screening metrics are 2D image indicators only. Variations may result from lighting, camera angle, distance, or surface moisture. Numeric deltas do not constitute certified physical crack growth rates or structural safety certifications. All detections must be confirmed on-site by a qualified structural engineer prior to structural remediation or load modifications.
                </p>
                <div className="pt-4 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200">
                  <span>CrackVision Structural Integrity Platform</span>
                  <span>End of Official Report</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
