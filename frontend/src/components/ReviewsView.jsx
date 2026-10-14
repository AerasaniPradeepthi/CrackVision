import { useState, useMemo } from 'react'
import SubmitReviewModal from './SubmitReviewModal'

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
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ReviewsView({
  reviews = [],
  inspections = [],
  loading = false,
  error = null,
  userRole = '',
  token,
  onRefresh,
}) {
  const [activeSubTab, setActiveSubTab] = useState('audit') // 'audit' | 'pending'
  const [search, setSearch] = useState('')
  const [selectedDecisionFilter, setSelectedDecisionFilter] = useState('ALL')

  // Optimistically submitted reviews to provide instant feedback upon submission
  const [submittedReviews, setSubmittedReviews] = useState([])
  const [successBanner, setSuccessBanner] = useState(null)

  // Merge server reviews with optimistically submitted reviews
  const localReviews = useMemo(() => {
    if (submittedReviews.length === 0) return reviews
    const existingIds = new Set(reviews.map((r) => r.id))
    const fresh = submittedReviews.filter((r) => !existingIds.has(r.id))
    return [...fresh, ...reviews]
  }, [reviews, submittedReviews])

  // Review submission modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [modalTargetInspection, setModalTargetInspection] = useState(null)
  const [selectedReviewDetails, setSelectedReviewDetails] = useState(null)

  const canSubmitReview = userRole === 'SITE_ENGINEER' || userRole === 'ADMIN'

  // Set of inspection IDs that already possess certified reviews
  const reviewedInspectionIds = useMemo(() => {
    return new Set(localReviews.map((r) => String(r.inspectionId)).filter(Boolean))
  }, [localReviews])

  // Pending inspections: inspections requiring engineer verification that are NOT completed and have NOT yet been reviewed
  const pendingInspections = useMemo(() => {
    return inspections.filter((i) => {
      if (i.status === 'COMPLETED') return false
      if (reviewedInspectionIds.has(String(i.id))) return false
      return (
        i.status === 'PENDING_REVIEW' ||
        i.status === 'PENDING_AI_ANALYSIS' ||
        i.status === 'IN_PROGRESS'
      )
    })
  }, [inspections, reviewedInspectionIds])

  // Summary statistics
  const stats = useMemo(() => {
    const total = localReviews.length
    const byDecision = {
      MONITOR: 0,
      INSPECT_FURTHER: 0,
      REQUIRES_FURTHER_ASSESSMENT: 0,
      NO_ACTION_REQUIRED: 0,
      REPAIR_REQUIRED: 0,
    }

    localReviews.forEach((r) => {
      if (r.decision && byDecision[r.decision] !== undefined) {
        byDecision[r.decision]++
      }
    })

    return { total, byDecision, pendingCount: pendingInspections.length }
  }, [localReviews, pendingInspections])

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return localReviews.filter((r) => {
      const matchDecision =
        selectedDecisionFilter === 'ALL' || r.decision === selectedDecisionFilter
      if (!matchDecision) return false

      if (!search.trim()) return true
      const term = search.toLowerCase()
      const revId = String(r.id || '')
      const inspId = String(r.inspectionId || '')
      const anaId = String(r.analysisId || '')
      const comments = (r.comments || '').toLowerCase()
      const reviewer = (r.reviewer?.name || r.reviewerName || '').toLowerCase()

      return (
        revId.includes(term) ||
        inspId.includes(term) ||
        anaId.includes(term) ||
        comments.includes(term) ||
        reviewer.includes(term)
      )
    })
  }, [localReviews, search, selectedDecisionFilter])

  const handleOpenSubmitModal = (inspection = null) => {
    setModalTargetInspection(inspection)
    setIsSubmitModalOpen(true)
  }

  const handleReviewSuccess = (newReview) => {
    if (newReview) {
      setSubmittedReviews((prev) => [newReview, ...prev.filter((r) => r.id !== newReview.id)])
      setSuccessBanner({
        message: `Official Determination for Inspection #${newReview.inspectionId} (Review #${newReview.id}) successfully recorded.`,
        decision: newReview.decision,
      })
      // Switch active sub-tab to 'audit' so engineer immediately sees the new record in the audit log
      setActiveSubTab('audit')
    }
    if (onRefresh) {
      onRefresh()
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px] text-slate-500">
        <span className="text-sm font-medium">Loading engineer review audit records...</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Engineer Review Audit Trail & Determinations
          </h2>
          <p className="text-xs text-slate-500">
            Certified engineer evaluations, maintenance decisions, and immutable audit logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Active Role:</span>
            <span className="px-2.5 py-1 rounded font-mono text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {userRole || 'SITE_ENGINEER'}
            </span>
          </div>

          {canSubmitReview ? (
            <button
              type="button"
              onClick={() => handleOpenSubmitModal(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Record Review</span>
            </button>
          ) : (
            <span
              title="Review submission restricted to Site Engineers and Administrators"
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-medium border border-slate-200 cursor-not-allowed"
            >
              Review Read-Only
            </span>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Total Reviews Logged
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
          <span className="text-[11px] text-slate-400">Append-only certified determinations</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
            Periodic Monitoring
          </span>
          <div className="mt-1 text-2xl font-bold text-blue-900">
            {stats.byDecision.MONITOR}
          </div>
          <span className="text-[11px] text-blue-600">Observation recommended</span>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-700">
            Intervention / Assessment
          </span>
          <div className="mt-1 text-2xl font-bold text-red-900">
            {stats.byDecision.REQUIRES_FURTHER_ASSESSMENT + stats.byDecision.REPAIR_REQUIRED}
          </div>
          <span className="text-[11px] text-red-600">Structural action warranted</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Awaiting Review
          </span>
          <div className="mt-1 text-2xl font-bold text-amber-900">{stats.pendingCount}</div>
          <span className="text-[11px] text-amber-600">Inspections pending verification</span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
              ✓
            </div>
            <div>
              <p className="font-semibold text-emerald-900">{successBanner.message}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Official Determination: <span className="font-bold font-mono">{successBanner.decision}</span> &bull; Successfully appended to the permanent audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 text-sm cursor-pointer rounded hover:bg-emerald-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('audit')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Review Audit Log ({localReviews.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('pending')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Pending Verification</span>
          {stats.pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {stats.pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: AUDIT LOG */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search reviewer, notes, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Decision Filter */}
              <select
                value={selectedDecisionFilter}
                onChange={(e) => setSelectedDecisionFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus:border-blue-600 focus:outline-none"
              >
                <option value="ALL">All Decisions</option>
                <option value="MONITOR">MONITOR</option>
                <option value="INSPECT_FURTHER">INSPECT_FURTHER</option>
                <option value="REQUIRES_FURTHER_ASSESSMENT">REQUIRES_FURTHER_ASSESSMENT</option>
                <option value="NO_ACTION_REQUIRED">NO_ACTION_REQUIRED</option>
                <option value="REPAIR_REQUIRED">REPAIR_REQUIRED</option>
              </select>
            </div>

            <span className="text-xs text-slate-400">
              Showing {filteredReviews.length} of {reviews.length} reviews
            </span>
          </div>

          {error && reviews.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
              <h3 className="text-base font-semibold text-red-800">Unable to Load Reviews</h3>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-800">No Reviews Matching Criteria</h3>
              <p className="text-xs text-slate-400 mt-1">
                {reviews.length === 0
                  ? 'No engineer reviews have been submitted yet.'
                  : 'Try adjusting your search or decision filter.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Review ID</th>
                      <th className="px-5 py-3.5">Analysis / Inspection</th>
                      <th className="px-5 py-3.5">Engineer Verdict</th>
                      <th className="px-5 py-3.5">Reviewer</th>
                      <th className="px-5 py-3.5">Professional Observations</th>
                      <th className="px-5 py-3.5">Timestamp</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredReviews.map((rev) => (
                      <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-medium text-slate-900">
                          #{rev.id}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            Analysis #{rev.analysisId}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Inspection #{rev.inspectionId} &bull; Image #{rev.imageId || rev.inspectionImageId || '1'}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getDecisionBadge(
                              rev.decision
                            )}`}
                          >
                            {rev.decision}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">
                            {rev.reviewer?.name || rev.reviewerName || 'Site Engineer'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {rev.reviewer?.email || rev.reviewerEmail || 'engineer@crackvision.local'}
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-sm">
                          <p className="text-xs text-slate-600 line-clamp-2 italic">
                            &ldquo;{rev.comments || 'No comment recorded'}&rdquo;
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {formatDate(rev.reviewedAt || rev.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedReviewDetails(rev)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING VERIFICATION */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <span className="font-semibold text-slate-800">
                Pending Engineer Verification Queue:
              </span>{' '}
              Inspections marked `PENDING_REVIEW` or `PENDING_AI_ANALYSIS` require qualified structural engineering determination. Selecting &ldquo;Review Now&rdquo; opens the review certification modal.
            </div>
          </div>

          {pendingInspections.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <svg className="mx-auto h-12 w-12 text-emerald-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-800">All Inspections Verified</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are no inspections currently waiting for engineer review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingInspections.map((insp) => (
                <div key={insp.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        Inspection #{insp.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {insp.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {formatDate(insp.inspectionDate)}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">
                      Component: {insp.component?.name || 'Structural Component'} ({insp.component?.type || 'N/A'})
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-2">
                      Notes: {insp.notes || 'No physical inspection notes provided.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Inspector: {insp.inspector?.name || 'Site Worker'}
                    </span>
                    {canSubmitReview && (
                      <button
                        type="button"
                        onClick={() => handleOpenSubmitModal(insp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                      >
                        <span>Review Now</span> &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal for Selected Review */}
      {selectedReviewDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedReviewDetails(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Review Determination #{selectedReviewDetails.id}
                </h3>
                <span className="text-xs text-slate-400">
                  Analysis #{selectedReviewDetails.analysisId} &bull; Inspection #{selectedReviewDetails.inspectionId}
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${getDecisionBadge(
                  selectedReviewDetails.decision
                )}`}
              >
                {selectedReviewDetails.decision}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Engineer Observations:
                </span>
                <div className="rounded-xl bg-slate-50 p-4 text-slate-800 leading-relaxed italic border border-slate-200">
                  &ldquo;{selectedReviewDetails.comments}&rdquo;
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-slate-600 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block">Reviewer</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReviewDetails.reviewer?.name || selectedReviewDetails.reviewerName || 'Site Engineer'}
                  </span>
                  <span className="text-slate-500 block font-mono">
                    {selectedReviewDetails.reviewer?.email || selectedReviewDetails.reviewerEmail || ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Certified At</span>
                  <span className="font-semibold text-slate-900">
                    {formatDate(selectedReviewDetails.reviewedAt || selectedReviewDetails.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedReviewDetails(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Review Modal */}
      {isSubmitModalOpen && (
        <SubmitReviewModal
          key={modalTargetInspection?.id || 'new-review'}
          isOpen={isSubmitModalOpen}
          onClose={() => {
            setIsSubmitModalOpen(false)
            setModalTargetInspection(null)
          }}
          initialInspection={modalTargetInspection}
          inspections={inspections}
          token={token}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  )
}
