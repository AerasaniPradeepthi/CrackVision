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

function getComponentTypeBadge(type) {
  switch (type?.toUpperCase()) {
    case 'COLUMN':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'BEAM':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'SLAB':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'WALL':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'FOUNDATION':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getInspectionStatusBadge(status) {
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

export default function ProjectsView({
  projects = [],
  loading = false,
  error = null,
  token,
  userRole = '',
  onSelectComponentForMonitoring,
  onSelectTab,
  onRefresh,
}) {
  const [search, setSearch] = useState('')

  // Drilldown hierarchy selections
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [selectedFloor, setSelectedFloor] = useState(null)
  const [expandedComponentId, setExpandedComponentId] = useState(null)

  // Loaded child records
  const [buildings, setBuildings] = useState([])
  const [loadingBuildings, setLoadingBuildings] = useState(false)
  const [buildingsError, setBuildingsError] = useState(null)

  const [floors, setFloors] = useState([])
  const [loadingFloors, setLoadingFloors] = useState(false)
  const [floorsError, setFloorsError] = useState(null)

  const [components, setComponents] = useState([])
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [componentsError, setComponentsError] = useState(null)

  const [componentInspections, setComponentInspections] = useState([])
  const [loadingInspections, setLoadingInspections] = useState(false)
  const [inspectionsError, setInspectionsError] = useState(null)

  // Creation modal states
  const [modalType, setModalType] = useState(null) // 'project' | 'building' | 'floor' | 'component'
  const [modalForm, setModalForm] = useState({})
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalError, setModalError] = useState(null)

  const isManagerOrAdmin = userRole === 'ADMIN' || userRole === 'SITE_ADMIN' || userRole === 'PROJECT_MANAGER'

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Fetch Buildings when selectedProject changes
  useEffect(() => {
    if (!selectedProject || !token) {
      return
    }

    let active = true
    const fetchBuildings = async () => {
      setLoadingBuildings(true)
      setBuildingsError(null)
      try {
        const res = await fetch(`/api/buildings/project/${selectedProject.id}`, {
          headers: authHeaders(),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active) setBuildings(parseArrayResponse(data))
      } catch (err) {
        if (active) setBuildingsError(err.message || 'Failed to load buildings')
      } finally {
        if (active) setLoadingBuildings(false)
      }
    }

    fetchBuildings()
    return () => {
      active = false
    }
  }, [selectedProject, token, authHeaders])

  // Fetch Floors when selectedBuilding changes
  useEffect(() => {
    if (!selectedBuilding || !token) {
      return
    }

    let active = true
    const fetchFloors = async () => {
      setLoadingFloors(true)
      setFloorsError(null)
      try {
        const res = await fetch(`/api/floors/building/${selectedBuilding.id}`, {
          headers: authHeaders(),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active) setFloors(parseArrayResponse(data))
      } catch (err) {
        if (active) setFloorsError(err.message || 'Failed to load floors')
      } finally {
        if (active) setLoadingFloors(false)
      }
    }

    fetchFloors()
    return () => {
      active = false
    }
  }, [selectedBuilding, token, authHeaders])

  // Fetch Components when selectedFloor changes
  useEffect(() => {
    if (!selectedFloor || !token) {
      return
    }

    let active = true
    const fetchComponents = async () => {
      setLoadingComponents(true)
      setComponentsError(null)
      try {
        const res = await fetch(`/api/components/floor/${selectedFloor.id}`, {
          headers: authHeaders(),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (active) setComponents(parseArrayResponse(data))
      } catch (err) {
        if (active) setComponentsError(err.message || 'Failed to load components')
      } finally {
        if (active) setLoadingComponents(false)
      }
    }

    fetchComponents()
    return () => {
      active = false
    }
  }, [selectedFloor, token, authHeaders])

  // Fetch Inspections for expanded component
  const handleToggleComponentInspections = async (componentId) => {
    if (expandedComponentId === componentId) {
      setExpandedComponentId(null)
      setComponentInspections([])
      return
    }

    setExpandedComponentId(componentId)
    setLoadingInspections(true)
    setInspectionsError(null)

    try {
      const res = await fetch(`/api/inspections/component/${componentId}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setComponentInspections(parseArrayResponse(data))
    } catch (err) {
      setInspectionsError(err.message || 'Failed to load inspections for component')
    } finally {
      setLoadingInspections(false)
    }
  }

  // Navigation resets
  const handleResetToProjects = () => {
    setSelectedProject(null)
    setSelectedBuilding(null)
    setSelectedFloor(null)
    setExpandedComponentId(null)
    setBuildings([])
    setFloors([])
    setComponents([])
  }

  const handleSelectBuilding = (b) => {
    setSelectedBuilding(b)
    setSelectedFloor(null)
    setExpandedComponentId(null)
    setFloors([])
    setComponents([])
  }

  const handleSelectFloor = (f) => {
    setSelectedFloor(f)
    setExpandedComponentId(null)
    setComponents([])
  }

  // Handle entity creation submission
  const handleModalSubmit = async (e) => {
    e.preventDefault()
    setModalSubmitting(true)
    setModalError(null)

    try {
      let endpoint = ''
      let payload = {}

      if (modalType === 'project') {
        endpoint = '/api/projects'
        payload = {
          name: modalForm.name?.trim(),
          location: modalForm.location?.trim(),
          description: modalForm.description?.trim(),
          status: 'ACTIVE',
        }
      } else if (modalType === 'building') {
        endpoint = '/api/buildings'
        payload = {
          name: modalForm.name?.trim(),
          description: modalForm.description?.trim(),
          project: { id: selectedProject.id },
        }
      } else if (modalType === 'floor') {
        endpoint = '/api/floors'
        payload = {
          floorNumber: Number(modalForm.floorNumber),
          name: modalForm.name?.trim() || `Floor ${modalForm.floorNumber}`,
          building: { id: selectedBuilding.id },
        }
      } else if (modalType === 'component') {
        endpoint = '/api/components'
        payload = {
          name: modalForm.name?.trim(),
          type: modalForm.type || 'COLUMN',
          description: modalForm.description?.trim(),
          floor: { id: selectedFloor.id },
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Failed to create item (HTTP ${res.status})`)
      }

      const created = await res.json()

      // Update state locally
      if (modalType === 'project') {
        if (onRefresh) onRefresh()
      } else if (modalType === 'building') {
        setBuildings((prev) => [...prev, created])
      } else if (modalType === 'floor') {
        setFloors((prev) => [...prev, created])
      } else if (modalType === 'component') {
        setComponents((prev) => [...prev, created])
      }

      setModalType(null)
      setModalForm({})
    } catch (err) {
      setModalError(err.message || 'Creation error occurred.')
    } finally {
      setModalSubmitting(false)
    }
  }

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects
    const term = search.toLowerCase()
    return projects.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.location || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
    )
  }, [projects, search])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px] text-slate-500">
        <span className="text-sm font-medium">Loading project hierarchy records...</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header and Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Structure Hierarchy Explorer
          </h2>
          <p className="text-xs text-slate-500">
            Interactive drilldown: Projects &bull; Buildings &bull; Floors &bull; Structural Components &bull; Inspection Logs
          </p>
        </div>

        {/* Action Button: Create New Node based on current level */}
        {isManagerOrAdmin && (
          <div>
            {!selectedProject && (
              <button
                type="button"
                onClick={() => {
                  setModalForm({ name: '', location: '', description: '' })
                  setModalType('project')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>+ New Project</span>
              </button>
            )}
            {selectedProject && !selectedBuilding && (
              <button
                type="button"
                onClick={() => {
                  setModalForm({ name: '', description: '' })
                  setModalType('building')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>+ Add Building</span>
              </button>
            )}
            {selectedBuilding && !selectedFloor && (
              <button
                type="button"
                onClick={() => {
                  setModalForm({ floorNumber: 1, name: '' })
                  setModalType('floor')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>+ Add Floor</span>
              </button>
            )}
            {selectedFloor && (
              <button
                type="button"
                onClick={() => {
                  setModalForm({ name: '', type: 'COLUMN', description: '' })
                  setModalType('component')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>+ Add Component</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb Trail */}
      <nav aria-label="Breadcrumb" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs text-xs font-medium text-slate-600 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleResetToProjects}
          className={`hover:text-blue-600 transition-colors cursor-pointer ${
            !selectedProject ? 'font-bold text-blue-600' : ''
          }`}
        >
          Projects ({projects.length})
        </button>

        {selectedProject && (
          <>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={() => {
                setSelectedBuilding(null)
                setSelectedFloor(null)
                setExpandedComponentId(null)
                setFloors([])
                setComponents([])
              }}
              className={`hover:text-blue-600 transition-colors cursor-pointer ${
                !selectedBuilding ? 'font-bold text-blue-600' : ''
              }`}
            >
              {selectedProject.name}
            </button>
          </>
        )}

        {selectedBuilding && (
          <>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={() => {
                setSelectedFloor(null)
                setExpandedComponentId(null)
                setComponents([])
              }}
              className={`hover:text-blue-600 transition-colors cursor-pointer ${
                !selectedFloor ? 'font-bold text-blue-600' : ''
              }`}
            >
              {selectedBuilding.name}
            </button>
          </>
        )}

        {selectedFloor && (
          <>
            <span className="text-slate-400">/</span>
            <span className="font-bold text-blue-600">
              Floor {selectedFloor.floorNumber} {selectedFloor.name ? `(${selectedFloor.name})` : ''}
            </span>
          </>
        )}
      </nav>

      {/* LEVEL 1: PROJECTS GRID */}
      {!selectedProject && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search projects by name, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-400">
              Showing {filteredProjects.length} sites
            </span>
          </div>

          {error && projects.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
              <h3 className="text-base font-semibold text-red-800">Unable to Load Projects</h3>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-base font-semibold text-slate-800">No Projects Found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {search ? 'Try adjusting your search criteria.' : 'Create a project to start building your structural hierarchy.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono font-medium text-slate-400">
                        ID #{project.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {project.status || 'ACTIVE'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-slate-900 tracking-tight">
                      {project.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <svg className="h-4 w-4 text-slate-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span>{project.location || 'Location Not Specified'}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {project.description || 'No project description provided.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Created: {formatDate(project.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      <span>Explore Hierarchy</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2: BUILDINGS IN SELECTED PROJECT */}
      {selectedProject && !selectedBuilding && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Selected Project
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                {selectedProject.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Location: {selectedProject.location || 'Not Specified'} &bull; {selectedProject.description}
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
              {buildings.length} Registered Building{buildings.length === 1 ? '' : 's'}
            </div>
          </div>

          {loadingBuildings ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading buildings...</div>
          ) : buildingsError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
              {buildingsError}
            </div>
          ) : buildings.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-3">
              <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h4 className="text-sm font-semibold text-slate-800">No Buildings in this Project</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No buildings have been registered for {selectedProject.name} yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buildings.map((building) => (
                <div
                  key={building.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-400">ID #{building.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        BUILDING
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">{building.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {building.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSelectBuilding(building)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <span>View Floors &rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 3: FLOORS IN SELECTED BUILDING */}
      {selectedBuilding && !selectedFloor && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Selected Building
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                {selectedBuilding.name} &bull; {selectedProject.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedBuilding.description || 'Monitored building structure'}
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
              {floors.length} Registered Floor{floors.length === 1 ? '' : 's'}
            </div>
          </div>

          {loadingFloors ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading floors...</div>
          ) : floorsError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
              {floorsError}
            </div>
          ) : floors.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-3">
              <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h4 className="text-sm font-semibold text-slate-800">No Floors in this Building</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No floor levels have been configured for {selectedBuilding.name} yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {floors.map((floor) => (
                <div
                  key={floor.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-400">ID #{floor.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        FLOOR {floor.floorNumber}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-2">
                      {floor.name || `Floor Level ${floor.floorNumber}`}
                    </h4>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Elevation Index: {floor.floorNumber}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSelectFloor(floor)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <span>View Structural Components &rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 4: COMPONENTS IN SELECTED FLOOR */}
      {selectedFloor && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Selected Floor Level
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                Floor {selectedFloor.floorNumber} &bull; {selectedBuilding.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Project: {selectedProject.name}
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
              {components.length} Structural Component{components.length === 1 ? '' : 's'}
            </div>
          </div>

          {loadingComponents ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading components...</div>
          ) : componentsError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
              {componentsError}
            </div>
          ) : components.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-3">
              <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h4 className="text-sm font-semibold text-slate-800">No Components on this Floor</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No pillars, beams, or slabs have been registered on Floor {selectedFloor.floorNumber} yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {components.map((comp) => {
                const isExpanded = expandedComponentId === comp.id
                return (
                  <div
                    key={comp.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden"
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                            {comp.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getComponentTypeBadge(
                              comp.type
                            )}`}
                          >
                            {comp.type || 'COMPONENT'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {comp.description || 'Monitored structural component'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleComponentInspections(comp.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                            isExpanded
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {isExpanded ? 'Hide Inspections' : 'Inspection Logs'}
                        </button>

                        {onSelectComponentForMonitoring && (
                          <button
                            type="button"
                            onClick={() => onSelectComponentForMonitoring(comp.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>Monitor Timeline</span>
                            <span>&rarr;</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Inspection Logs Drawer */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Recorded Inspections for {comp.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {componentInspections.length} Total Logs
                          </span>
                        </div>

                        {loadingInspections ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Loading inspections...
                          </div>
                        ) : inspectionsError ? (
                          <div className="text-xs text-red-600">{inspectionsError}</div>
                        ) : componentInspections.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-200">
                            No inspections logged for this component yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {componentInspections.map((insp) => (
                              <div
                                key={insp.id}
                                className="bg-white rounded-lg border border-slate-200 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900">
                                      Inspection #{insp.id}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getInspectionStatusBadge(
                                        insp.status
                                      )}`}
                                    >
                                      {insp.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 text-[11px] mt-0.5">
                                    Notes: {insp.notes || 'No physical notes recorded.'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] text-slate-400 self-start sm:self-auto">
                                  <span>{formatDate(insp.inspectionDate)}</span>
                                  {onSelectTab && (
                                    <button
                                      type="button"
                                      onClick={() => onSelectTab('inspections')}
                                      className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                    >
                                      View in Inspections &rarr;
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Creation Modal for Project, Building, Floor, Component */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setModalType(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                Create New {modalType}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              {/* Form fields for Project */}
              {modalType === 'project' && (
                <>
                  <div>
                    <label htmlFor="create-project-name" className="block font-semibold text-slate-700 mb-1">
                      Project Name *
                    </label>
                    <input
                      id="create-project-name"
                      type="text"
                      required
                      value={modalForm.name || ''}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      placeholder="e.g. Metro Line Phase 2"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-project-location" className="block font-semibold text-slate-700 mb-1">
                      Location *
                    </label>
                    <input
                      id="create-project-location"
                      type="text"
                      required
                      value={modalForm.location || ''}
                      onChange={(e) => setModalForm({ ...modalForm, location: e.target.value })}
                      placeholder="e.g. North Sector, Sector 62"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-project-desc" className="block font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="create-project-desc"
                      rows={2}
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                      placeholder="Project scope and details..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form fields for Building */}
              {modalType === 'building' && (
                <>
                  <div>
                    <label htmlFor="create-building-name" className="block font-semibold text-slate-700 mb-1">
                      Building Name *
                    </label>
                    <input
                      id="create-building-name"
                      type="text"
                      required
                      value={modalForm.name || ''}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      placeholder="e.g. Tower B, South Pier"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-building-desc" className="block font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="create-building-desc"
                      rows={2}
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                      placeholder="Building details..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form fields for Floor */}
              {modalType === 'floor' && (
                <>
                  <div>
                    <label htmlFor="create-floor-number" className="block font-semibold text-slate-700 mb-1">
                      Floor Number *
                    </label>
                    <input
                      id="create-floor-number"
                      type="number"
                      required
                      value={modalForm.floorNumber || 1}
                      onChange={(e) => setModalForm({ ...modalForm, floorNumber: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-floor-name" className="block font-semibold text-slate-700 mb-1">
                      Floor Label / Name
                    </label>
                    <input
                      id="create-floor-name"
                      type="text"
                      value={modalForm.name || ''}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      placeholder="e.g. Mezzanine, Basement 1"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Form fields for Component */}
              {modalType === 'component' && (
                <>
                  <div>
                    <label htmlFor="create-comp-name" className="block font-semibold text-slate-700 mb-1">
                      Component Name *
                    </label>
                    <input
                      id="create-comp-name"
                      type="text"
                      required
                      value={modalForm.name || ''}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      placeholder="e.g. Column C-12, Girder G-4"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-comp-type" className="block font-semibold text-slate-700 mb-1">
                      Structural Type *
                    </label>
                    <select
                      id="create-comp-type"
                      value={modalForm.type || 'COLUMN'}
                      onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="COLUMN">COLUMN</option>
                      <option value="BEAM">BEAM</option>
                      <option value="SLAB">SLAB</option>
                      <option value="WALL">WALL</option>
                      <option value="FOUNDATION">FOUNDATION</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="create-comp-desc" className="block font-semibold text-slate-700 mb-1">
                      Description / Location Detail
                    </label>
                    <textarea
                      id="create-comp-desc"
                      rows={2}
                      value={modalForm.description || ''}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                      placeholder="Structural notes, rebar spec..."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? 'Creating...' : `Create ${modalType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
