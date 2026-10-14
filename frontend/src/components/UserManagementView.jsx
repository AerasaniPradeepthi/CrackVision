import { useState, useEffect, useMemo, useCallback } from 'react'

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

function getRoleBadge(role) {
  switch (role) {
    case 'ADMIN':
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

export default function UserManagementView({ token, onRefresh }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(() => Boolean(token))
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [pendingRoles, setPendingRoles] = useState({})

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  const fetchUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() })
      if (!res.ok) {
        throw new Error(`Failed to load users (HTTP ${res.status})`)
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Error fetching system users')
    } finally {
      setLoading(false)
    }
  }, [token, authHeaders])

  useEffect(() => {
    if (!token) return
    let active = true

    fetch('/api/admin/users', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load users (HTTP ${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        if (active) {
          setUsers(Array.isArray(data) ? data : [])
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Error fetching system users')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [token, authHeaders])


  const handleRoleSelect = (userId, newRole) => {
    setPendingRoles((prev) => ({
      ...prev,
      [userId]: newRole,
    }))
  }

  const handleSaveRole = async (userId) => {
    const targetRole = pendingRoles[userId]
    if (!targetRole) return

    setUpdatingUserId(userId)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ role: targetRole }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to update role (HTTP ${res.status})`)
      }

      const updatedUser = await res.json()
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updatedUser.role } : u))
      )
      setPendingRoles((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setSuccessMsg(`Successfully updated role for ${updatedUser.email} to ${updatedUser.role}`)
      if (onRefresh) onRefresh()
    } catch (err) {
      setError(err.message || 'Error updating user role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  // Calculate role statistics
  const stats = useMemo(() => {
    const counts = {
      TOTAL: users.length,
      ADMIN: 0,
      SITE_ENGINEER: 0,
      SITE_WORKER: 0,
      PROJECT_MANAGER: 0,
    }
    users.forEach((u) => {
      if (u.role && counts[u.role] !== undefined) {
        counts[u.role]++
      }
    })
    return counts
  }, [users])

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (!search.trim()) return true
      const term = search.toLowerCase()
      const name = (u.name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return name.includes(term) || email.includes(term)
    })
  }, [users, roleFilter, search])

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            User Accounts & Role Permissions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage system access levels, assign roles, and audit registered accounts across CrackVision.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Role Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Users</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{stats.TOTAL}</span>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-purple-600 block">Administrators</span>
          <span className="text-xl font-bold text-purple-900 mt-1 block">{stats.ADMIN}</span>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-blue-600 block">Site Engineers</span>
          <span className="text-xl font-bold text-blue-900 mt-1 block">{stats.SITE_ENGINEER}</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-amber-600 block">Site Workers</span>
          <span className="text-xl font-bold text-amber-900 mt-1 block">{stats.SITE_WORKER}</span>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-indigo-600 block">Project Managers</span>
          <span className="text-xl font-bold text-indigo-900 mt-1 block">{stats.PROJECT_MANAGER}</span>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center justify-between">
          <span>✕ {error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-900 text-xs font-bold">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user name or email..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-slate-50 focus:bg-white transition-colors"
          />
          <svg className="h-4 w-4 text-slate-400 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Role Filter:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SITE_ENGINEER">SITE_ENGINEER</option>
            <option value="SITE_WORKER">SITE_WORKER</option>
            <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">User Profile</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Registered Date</th>
                <th className="px-4 py-3">Current Role</th>
                <th className="px-4 py-3 text-right">Assign Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    Loading registered user accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    No user accounts match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const initial = u.name ? u.name.charAt(0).toUpperCase() : 'U'
                  const isUpdating = updatingUserId === u.id
                  const selectedRole = pendingRoles[u.id] || u.role
                  const hasChanged = selectedRole !== u.role

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {initial}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{u.name || 'User'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: #{u.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <select
                            value={selectedRole}
                            disabled={isUpdating}
                            onChange={(e) => handleRoleSelect(u.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer disabled:opacity-50"
                          >
                            <option value="SITE_WORKER">SITE_WORKER</option>
                            <option value="SITE_ENGINEER">SITE_ENGINEER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                          </select>
                          {hasChanged && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSaveRole(u.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
