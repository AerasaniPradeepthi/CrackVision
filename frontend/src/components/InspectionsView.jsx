import { useState } from 'react'
import NewInspectionModal from './NewInspectionModal'
import UploadPhotoModal from './UploadPhotoModal'
import AiAnalysisModal from './AiAnalysisModal'
import InspectionReportModal from './InspectionReportModal'

export default function InspectionsView({
  inspections = [],
  loading = false,
  error = null,
  onSelectComponentForMonitoring,
  token,
  onRefresh,
  userRole = '',
}) {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [photoModalInspection, setPhotoModalInspection] = useState(null)
  const [analysisTarget, setAnalysisTarget] = useState(null)
  const [reportInspection, setReportInspection] = useState(null)

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'PENDING_AI_ANALYSIS':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'PENDING_REVIEW':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const formatDate = (dateStr) => {
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

  const filtered = inspections.filter((insp) => {
    const term = search.toLowerCase()
    const compName = insp.component?.name?.toLowerCase() || ''
    const status = insp.status?.toLowerCase() || ''
    const notes = insp.notes?.toLowerCase() || ''
    return compName.includes(term) || status.includes(term) || notes.includes(term)
  })

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px] text-slate-500">
        <span className="text-sm">Loading inspection logs...</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Structural Inspections
          </h2>
          <p className="text-xs text-slate-500">
            Recorded surveys, physical notes, and inspection statuses
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search component, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* + New Inspection Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span>+ New Inspection</span>
          </button>
        </div>
      </div>

      {error && inspections.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
          <h3 className="text-base font-semibold text-red-800">Unable to Load Inspections</h3>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-base font-semibold text-slate-800">No Inspections Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Try adjusting your search criteria.' : 'Inspections logged in the database will appear here.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>+ New Inspection</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3 min-w-[140px]">Component</th>
                  <th className="px-4 py-3">Structural Location</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3">Inspection Notes</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((insp) => {
                  const comp = insp.component
                  const floorName = comp?.floor?.name || ''
                  const bldgName = comp?.floor?.building?.name || ''
                  return (
                    <tr key={insp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                        #{insp.id}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 break-words">
                          {comp?.name || 'Unnamed'}
                        </div>
                        <div className="mt-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {comp?.type || 'STRUCTURE'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {floorName && bldgName ? (
                          <div>
                            <div className="font-medium text-slate-700">{bldgName}</div>
                            <div className="text-[11px] text-slate-400">{floorName}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                            insp.status
                          )}`}
                        >
                          {insp.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(insp.inspectionDate || insp.createdAt)}
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {insp.notes || 'No notes entered for this inspection.'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setAnalysisTarget({ inspection: insp, imageId: null })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors cursor-pointer"
                            title="AI Crack Screening Analysis"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-8-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.343 4.343a.75.75 0 011.06 0l1.061 1.061a.75.75 0 01-1.06 1.06L4.343 5.404a.75.75 0 010-1.06zm9.193 9.193a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zm-9.193 7.071a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm9.193-9.193a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0z" />
                            </svg>
                            <span>Analyze</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoModalInspection(insp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            title="Upload inspection photo"
                          >
                            <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                            <span>Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportInspection(insp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                            title="Generate official structural inspection report"
                          >
                            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Report</span>
                          </button>
                          {comp?.id && onSelectComponentForMonitoring && (
                            <button
                              type="button"
                              onClick={() => onSelectComponentForMonitoring(comp.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <span>Timeline</span>
                              <span>&rarr;</span>
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
        </div>
      )}

      {/* New Inspection Modal */}
      {isModalOpen && (
        <NewInspectionModal
          token={token}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh()
          }}
          onAnalyze={(inspection, imageId) => {
            setIsModalOpen(false)
            setAnalysisTarget({ inspection, imageId })
          }}
        />
      )}

      {/* Upload Photo Modal for existing inspection */}
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

      {/* AI Crack Screening Modal */}
      {analysisTarget && (
        <AiAnalysisModal
          inspection={analysisTarget.inspection}
          initialImageId={analysisTarget.imageId}
          token={token}
          userRole={userRole}
          onClose={() => setAnalysisTarget(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh()
          }}
        />
      )}

      {/* Official Inspection Report Modal */}
      {reportInspection && (
        <InspectionReportModal
          isOpen={Boolean(reportInspection)}
          onClose={() => setReportInspection(null)}
          inspection={reportInspection}
          token={token}
        />
      )}
    </div>
  )
}
