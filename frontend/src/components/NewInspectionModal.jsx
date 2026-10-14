import { useState, useEffect, useCallback } from 'react'
import InspectionPhotoUploader from './InspectionPhotoUploader'

function parseArrayResponse(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.content)) return data.content
    if (Array.isArray(data.data)) return data.data
    if (data.id) return [data]
  }
  return []
}

function getLocalDateTimeLocal() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
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

export default function NewInspectionModal({
  token,
  onClose,
  onSuccess,
  onAnalyze,
}) {
  // Cascading data lists
  const [projects, setProjects] = useState([])
  const [buildings, setBuildings] = useState([])
  const [floors, setFloors] = useState([])
  const [components, setComponents] = useState([])

  // Selected values
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [selectedFloorId, setSelectedFloorId] = useState('')
  const [selectedComponentId, setSelectedComponentId] = useState('')

  // Form fields
  const [inspectionDate, setInspectionDate] = useState(() => getLocalDateTimeLocal())
  const [notes, setNotes] = useState('')

  // Loading states
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [loadingFloors, setLoadingFloors] = useState(false)
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Error states
  const [errorProjects, setErrorProjects] = useState(null)
  const [errorBuildings, setErrorBuildings] = useState(null)
  const [errorFloors, setErrorFloors] = useState(null)
  const [errorComponents, setErrorComponents] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  // Success state
  const [createdInspection, setCreatedInspection] = useState(null)

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // 1. Fetch Projects on mount
  useEffect(() => {
    let active = true
    const fetchProjects = async () => {
      setLoadingProjects(true)
      setErrorProjects(null)
      try {
        const res = await fetch('/api/projects', {
          headers: authHeaders(),
        })
        if (!res.ok) {
          throw new Error(`Failed to load projects (HTTP ${res.status})`)
        }
        const data = await res.json()
        if (active) {
          setProjects(parseArrayResponse(data))
        }
      } catch (err) {
        if (active) {
          setErrorProjects(err.message || 'Error loading projects')
        }
      } finally {
        if (active) {
          setLoadingProjects(false)
        }
      }
    }

    fetchProjects()
    return () => {
      active = false
    }
  }, [authHeaders])

  // 2. Fetch Buildings when Project changes
  const handleProjectChange = async (projectId) => {
    setSelectedProjectId(projectId)
    setSelectedBuildingId('')
    setSelectedFloorId('')
    setSelectedComponentId('')
    setBuildings([])
    setFloors([])
    setComponents([])
    setErrorBuildings(null)
    setErrorFloors(null)
    setErrorComponents(null)

    if (!projectId) return

    setLoadingBuildings(true)
    try {
      const res = await fetch(`/api/buildings/project/${projectId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        throw new Error(`Failed to load buildings (HTTP ${res.status})`)
      }
      const data = await res.json()
      setBuildings(parseArrayResponse(data))
    } catch (err) {
      setErrorBuildings(err.message || 'Error loading buildings')
    } finally {
      setLoadingBuildings(false)
    }
  }

  // 3. Fetch Floors when Building changes
  const handleBuildingChange = async (buildingId) => {
    setSelectedBuildingId(buildingId)
    setSelectedFloorId('')
    setSelectedComponentId('')
    setFloors([])
    setComponents([])
    setErrorFloors(null)
    setErrorComponents(null)

    if (!buildingId) return

    setLoadingFloors(true)
    try {
      const res = await fetch(`/api/floors/building/${buildingId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        throw new Error(`Failed to load floors (HTTP ${res.status})`)
      }
      const data = await res.json()
      setFloors(parseArrayResponse(data))
    } catch (err) {
      setErrorFloors(err.message || 'Error loading floors')
    } finally {
      setLoadingFloors(false)
    }
  }

  // 4. Fetch Components when Floor changes
  const handleFloorChange = async (floorId) => {
    setSelectedFloorId(floorId)
    setSelectedComponentId('')
    setComponents([])
    setErrorComponents(null)

    if (!floorId) return

    setLoadingComponents(true)
    try {
      const res = await fetch(`/api/components/floor/${floorId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        throw new Error(`Failed to load components (HTTP ${res.status})`)
      }
      const data = await res.json()
      setComponents(parseArrayResponse(data))
    } catch (err) {
      setErrorComponents(err.message || 'Error loading components')
    } finally {
      setLoadingComponents(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedComponentId) {
      setSubmitError('Please select a structural component.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Backend expects exact entity structure: component { id }, inspectionDate, notes
      const payload = {
        component: {
          id: Number(selectedComponentId),
        },
        inspectionDate: inspectionDate || undefined,
        notes: notes.trim() || undefined,
      }

      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let msg = `Server error creating inspection (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) msg = errData.error
          else if (errData?.message) msg = errData.message
        } catch {
          // Ignore JSON parsing failure
        }
        throw new Error(msg)
      }

      const created = await res.json()
      setCreatedInspection(created)

      // Notify parent to refresh inspections list
      if (onSuccess) {
        onSuccess(created)
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit inspection.')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset to create another inspection
  const handleCreateAnother = () => {
    setCreatedInspection(null)
    setSelectedComponentId('')
    setNotes('')
    setInspectionDate(getLocalDateTimeLocal())
    setSubmitError(null)
  }

  // Lookup selected item names for confirmation summary
  const selectedProject = projects.find((p) => String(p.id) === String(selectedProjectId))
  const selectedBuilding = buildings.find((b) => String(b.id) === String(selectedBuildingId))
  const selectedFloor = floors.find((f) => String(f.id) === String(selectedFloorId))
  const selectedComponent = components.find((c) => String(c.id) === String(selectedComponentId))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 id="modal-title" className="text-base font-bold text-white tracking-tight">
                New Structural Inspection
              </h3>
              <p className="text-xs text-slate-400">
                Record an on-site structural component survey
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        {createdInspection ? (
          /* Confirmation Success State */
          <div className="p-6 space-y-5">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-emerald-900 tracking-tight">
                Inspection Created Successfully!
              </h4>
              <p className="text-xs text-emerald-700 mt-1">
                Inspection record has been registered in the database with ID{' '}
                <span className="font-mono font-bold text-emerald-900">
                  #{createdInspection.id}
                </span>
                .
              </p>
            </div>

            {/* Inspection Details Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Inspection ID</span>
                <span className="font-mono font-bold text-slate-900">
                  #{createdInspection.id}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  {createdInspection.status || 'PENDING_AI_ANALYSIS'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Component</span>
                <span className="font-semibold text-slate-900 text-right">
                  {selectedComponent?.name || createdInspection.component?.name || 'Component'} (
                  {selectedComponent?.type || createdInspection.component?.type || 'STRUCTURE'})
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Location</span>
                <span className="text-slate-700 text-right">
                  {[selectedProject?.name, selectedBuilding?.name, selectedFloor?.name]
                    .filter(Boolean)
                    .join(' / ') || 'Recorded Location'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Inspection Date</span>
                <span className="text-slate-700 font-mono">
                  {formatDate(createdInspection.inspectionDate || createdInspection.createdAt)}
                </span>
              </div>
              {createdInspection.notes && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block mb-1">Notes:</span>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    {createdInspection.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Photo Upload Section for this Created Inspection */}
            <div className="pt-2 border-t border-slate-200">
              <InspectionPhotoUploader
                inspectionId={createdInspection.id}
                token={token}
                onUploadSuccess={() => {
                  if (onSuccess) onSuccess(createdInspection)
                }}
                onDone={onClose}
                onTriggerAnalysis={(imgData) => {
                  onClose()
                  if (onAnalyze) onAnalyze(createdInspection, imgData?.id)
                }}
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCreateAnother}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                + Create Another Inspection
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Form Inputs */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {submitError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">Creation Error: </span>
                  <span>{submitError}</span>
                </div>
              </div>
            )}

            {/* Cascading Hierarchy Section */}
            <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Structural Hierarchy
              </span>

              {/* 1. Project */}
              <div>
                <label htmlFor="project-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Project <span className="text-red-500">*</span>
                  {loadingProjects && (
                    <span className="text-[10px] text-blue-600 font-normal ml-2">Loading projects...</span>
                  )}
                </label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  disabled={loadingProjects}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  <option value="">
                    {loadingProjects ? 'Loading projects...' : '-- Select Project --'}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.location ? `(${p.location})` : ''}
                    </option>
                  ))}
                </select>
                {errorProjects && (
                  <p className="text-[11px] text-red-600 mt-1">{errorProjects}</p>
                )}
              </div>

              {/* 2. Building */}
              <div>
                <label htmlFor="building-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Building <span className="text-red-500">*</span>
                  {loadingBuildings && (
                    <span className="text-[10px] text-blue-600 font-normal ml-2">Loading buildings...</span>
                  )}
                </label>
                <select
                  id="building-select"
                  value={selectedBuildingId}
                  onChange={(e) => handleBuildingChange(e.target.value)}
                  disabled={!selectedProjectId || loadingBuildings}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  <option value="">
                    {!selectedProjectId
                      ? 'Select a project first'
                      : loadingBuildings
                      ? 'Loading buildings...'
                      : buildings.length === 0
                      ? 'No buildings found for this project'
                      : '-- Select Building --'}
                  </option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errorBuildings && (
                  <p className="text-[11px] text-red-600 mt-1">{errorBuildings}</p>
                )}
              </div>

              {/* 3. Floor */}
              <div>
                <label htmlFor="floor-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Floor <span className="text-red-500">*</span>
                  {loadingFloors && (
                    <span className="text-[10px] text-blue-600 font-normal ml-2">Loading floors...</span>
                  )}
                </label>
                <select
                  id="floor-select"
                  value={selectedFloorId}
                  onChange={(e) => handleFloorChange(e.target.value)}
                  disabled={!selectedBuildingId || loadingFloors}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  <option value="">
                    {!selectedBuildingId
                      ? 'Select a building first'
                      : loadingFloors
                      ? 'Loading floors...'
                      : floors.length === 0
                      ? 'No floors found for this building'
                      : '-- Select Floor --'}
                  </option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {errorFloors && (
                  <p className="text-[11px] text-red-600 mt-1">{errorFloors}</p>
                )}
              </div>

              {/* 4. Component */}
              <div>
                <label htmlFor="component-target-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  4. Structural Component <span className="text-red-500">*</span>
                  {loadingComponents && (
                    <span className="text-[10px] text-blue-600 font-normal ml-2">Loading components...</span>
                  )}
                </label>
                <select
                  id="component-target-select"
                  value={selectedComponentId}
                  onChange={(e) => setSelectedComponentId(e.target.value)}
                  disabled={!selectedFloorId || loadingComponents}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  <option value="">
                    {!selectedFloorId
                      ? 'Select a floor first'
                      : loadingComponents
                      ? 'Loading components...'
                      : components.length === 0
                      ? 'No components found on this floor'
                      : '-- Select Component --'}
                  </option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type || 'STRUCTURE'})
                    </option>
                  ))}
                </select>
                {errorComponents && (
                  <p className="text-[11px] text-red-600 mt-1">{errorComponents}</p>
                )}
              </div>
            </div>

            {/* Date and Time */}
            <div>
              <label htmlFor="inspection-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Inspection Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                id="inspection-date"
                type="datetime-local"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            {/* Notes Field */}
            <div>
              <label htmlFor="inspection-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Inspection Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="inspection-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record physical observations, visible cracks, weather conditions, or remarks..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedComponentId}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{submitting ? 'Creating Inspection...' : 'Create Inspection'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
