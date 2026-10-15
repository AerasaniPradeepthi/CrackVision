import { useState, useEffect, useCallback } from 'react'
import SubmitReviewModal from './SubmitReviewModal'
import { resolveImageUrl } from '../api/config'

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
    // not a full url
  }
  return resolveImageUrl(url)
}

export default function AiAnalysisModal({
  inspection,
  initialImageId = null,
  token,
  userRole = '',
  onClose,
  onRefresh,
}) {
  const [images, setImages] = useState([])
  const [selectedImageId, setSelectedImageId] = useState(initialImageId)
  const [loadingImages, setLoadingImages] = useState(false)
  const [imagesError, setImagesError] = useState(null)

  // Original image state loaded securely via Bearer token
  const [originalBlobUrl, setOriginalBlobUrl] = useState(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [failedImages, setFailedImages] = useState({})
  const [failedThumbnails, setFailedThumbnails] = useState({})

  // Analysis result state
  const [analysis, setAnalysis] = useState(null)
  const [loadingExistingAnalysis, setLoadingExistingAnalysis] = useState(false)
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [overlayError, setOverlayError] = useState(false)

  // Engineer review state
  const [latestReview, setLatestReview] = useState(null)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // View comparison mode: 'original' | 'highlighted' | 'side-by-side'
  const [viewMode, setViewMode] = useState('original')

  // Delete photo state
  const [photoToDelete, setPhotoToDelete] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState(null)
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState(null)

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // 1. Fetch all images for this inspection
  useEffect(() => {
    if (!inspection?.id) return
    let active = true

    const fetchImages = async () => {
      setLoadingImages(true)
      setImagesError(null)
      try {
        const res = await fetch(`/api/inspections/${inspection.id}/images`, {
          headers: authHeaders(),
        })
        if (!res.ok) {
          throw new Error(`Failed to load images (HTTP ${res.status})`)
        }
        const data = await res.json()
        const norm = parseArrayResponse(data)
        if (active) {
          setImages(norm)
          // If no initial image selected, pick the latest one
          setSelectedImageId((prev) => (prev ? prev : (norm.length > 0 ? norm[norm.length - 1].id : null)))
        }
      } catch (err) {
        if (active) {
          setImagesError(err.message || 'Error loading inspection images')
        }
      } finally {
        if (active) {
          setLoadingImages(false)
        }
      }
    }

    fetchImages()
    return () => {
      active = false
    }
  }, [inspection?.id, authHeaders])

  // 2. Fetch or load original image (support direct Cloudinary HTTPS URL or Bearer endpoint)
  useEffect(() => {
    let active = true
    let currentBlobUrl = null

    if (!inspection?.id || !selectedImageId || !token) {
      return
    }

    // Do not attempt to fetch original photo before images list has loaded
    if (loadingImages || images.length === 0) {
      return
    }

    const currentImageObj = images.find((i) => String(i.id) === String(selectedImageId))
    if (!currentImageObj) {
      return
    }

    const directUrl = (currentImageObj.imageUrl && currentImageObj.imageUrl.startsWith('http'))
      ? currentImageObj.imageUrl
      : (currentImageObj.storagePath && currentImageObj.storagePath.startsWith('http') ? currentImageObj.storagePath : null)

    if (directUrl) {
      // Direct Cloudinary / HTTPS URL is rendered directly in <img> without network fetch
      return
    }

    // Otherwise, fetch authenticated blob from backend endpoint
    const fetchOriginalImage = async () => {
      setLoadingImage(true)
      try {
        const res = await fetch(`/api/inspections/${inspection.id}/images/${selectedImageId}`, {
          headers: authHeaders(),
        })
        if (!res.ok) {
          throw new Error('Original photo unavailable')
        }
        const blob = await res.blob()
        if (active) {
          currentBlobUrl = URL.createObjectURL(blob)
          setOriginalBlobUrl(currentBlobUrl)
        }
      } catch {
        if (active) {
          setFailedImages((prev) => ({ ...prev, [selectedImageId]: true }))
          setOriginalBlobUrl(null)
        }
      } finally {
        if (active) {
          setLoadingImage(false)
        }
      }
    }

    fetchOriginalImage()

    return () => {
      active = false
      if (currentBlobUrl && currentBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [inspection?.id, selectedImageId, token, images, loadingImages, authHeaders])

  // 3. Check for existing analysis when selectedImageId changes
  useEffect(() => {
    let active = true

    if (!inspection?.id || !selectedImageId) {
      return
    }

    const fetchExistingAnalysis = async () => {
      setLoadingExistingAnalysis(true)
      setAnalysisError(null)
      setOverlayError(false)
      try {
        const res = await fetch(`/api/inspections/${inspection.id}/images/${selectedImageId}/analysis`, {
          headers: authHeaders(),
        })
        if (res.ok) {
          const data = await res.json()
          if (active) {
            setAnalysis(data)
            setOverlayError(false)
          }
        } else if (res.status === 404) {
          if (active) {
            setAnalysis(null)
            setOverlayError(false)
          }
        } else {
          throw new Error(`Failed to check existing analysis (HTTP ${res.status})`)
        }
      } catch {
        if (active) {
          // Non-blocking: simply leave analysis null so user can run it
          setAnalysis(null)
          setOverlayError(false)
        }
      } finally {
        if (active) {
          setLoadingExistingAnalysis(false)
        }
      }
    }

    fetchExistingAnalysis()
    return () => {
      active = false
    }
  }, [inspection?.id, selectedImageId, authHeaders])

  // Fetch latest review whenever analysis changes
  useEffect(() => {
    if (!inspection?.id || !analysis?.id || !token) {
      return
    }

    let active = true
    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `/api/inspections/${inspection.id}/analysis/${analysis.id}/reviews/latest`,
          { headers: authHeaders() }
        )
        if (res.ok) {
          const data = await res.json()
          if (active) setLatestReview(data)
        } else {
          if (active) setLatestReview(null)
        }
      } catch {
        if (active) setLatestReview(null)
      }
    }

    fetchLatest()
    return () => {
      active = false
    }
  }, [inspection?.id, analysis?.id, token, authHeaders])

  // 4. Trigger AI screening
  const handleRunAnalysis = async () => {
    if (!inspection?.id || !selectedImageId || runningAnalysis) return

    setRunningAnalysis(true)
    setAnalysisError(null)

    try {
      const res = await fetch(
        `/api/inspections/${inspection.id}/images/${selectedImageId}/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
        }
      )

      if (!res.ok) {
        let msg = `AI Analysis failed (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) msg = errData.error
          else if (errData?.message) msg = errData.message
        } catch {
          // ignore parsing error
        }

        if (res.status === 503 || res.status === 504) {
          msg = `AI Service Unavailable: ${msg}. Please verify the OpenCV AI service is running on port 8000.`
        }
        throw new Error(msg)
      }

      const data = await res.json()
      setAnalysis(data)
      setOverlayError(false)
      if (data.highlightedImageUrl) {
        setViewMode('highlighted')
      } else {
        setViewMode('original')
      }

      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      setAnalysisError(err.message || 'Error occurred while communicating with the AI service.')
    } finally {
      setRunningAnalysis(false)
    }
  }

  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !inspection?.id) return
    const idToDelete = photoToDelete.id
    setDeletingPhoto(true)
    setDeleteErrorMessage(null)

    try {
      const res = await fetch(`/api/inspections/${inspection.id}/images/${idToDelete}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!res.ok) {
        let msg = `Failed to delete photo (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) msg = errData.error
          else if (errData?.message) msg = errData.message
        } catch {
          // fallback
        }
        throw new Error(msg)
      }

      // 1. Immediately remove from local images state
      const updatedImages = images.filter((img) => img.id !== idToDelete)
      setImages(updatedImages)

      // 2. Clear stale preview and analysis if the deleted photo was currently active
      if (selectedImageId === idToDelete) {
        if (originalBlobUrl) {
          URL.revokeObjectURL(originalBlobUrl)
          setOriginalBlobUrl(null)
        }
        setFailedImages((prev) => {
          const next = { ...prev }
          delete next[idToDelete]
          return next
        })
        setAnalysis(null)
        setLatestReview(null)
        setOverlayError(false)
        setViewMode('original')
        if (updatedImages.length > 0) {
          setSelectedImageId(updatedImages[0].id)
        } else {
          setSelectedImageId(null)
        }
      }

      setPhotoToDelete(null)
      setDeleteSuccessMessage('Photo deleted successfully.')
      setTimeout(() => {
        setDeleteSuccessMessage(null)
      }, 4000)

      // 3. Notify parent components to refresh counts/statuses
      if (onRefresh) {
        onRefresh()
      }
    } catch (err) {
      setDeleteErrorMessage(err.message || 'Error occurred while deleting photo.')
    } finally {
      setDeletingPhoto(false)
    }
  }

  const selectedImageMeta = images.find((img) => String(img.id) === String(selectedImageId))
  const directImageUrl = (selectedImageMeta?.imageUrl && selectedImageMeta.imageUrl.startsWith('http'))
    ? selectedImageMeta.imageUrl
    : (selectedImageMeta?.storagePath?.startsWith('http') ? selectedImageMeta.storagePath : null)
  const effectiveOriginalUrl = directImageUrl || originalBlobUrl
  const isImageUnavailable = Boolean(failedImages[selectedImageId])
  const highlightedUrl = analysis ? formatHighlightedImageUrl(analysis.highlightedImageUrl) : null

  const getCategoryBadgeClass = (category) => {
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
        return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      aria-labelledby="analysis-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 id="analysis-modal-title" className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>AI Crack Screening</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  OpenCV Baseline
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Inspection #{inspection?.id} &bull; {inspection?.component?.name || 'Structural Component'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Images Load Error Banner */}
          {imagesError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700">
              <span className="font-bold">Error loading inspection photos: </span>
              <span>{imagesError}</span>
            </div>
          )}

          {/* Photo Deletion Success Banner */}
          {deleteSuccessMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold">{deleteSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold text-xs"
              >
                &times;
              </button>
            </div>
          )}

          {/* Photo Deletion Error Banner */}
          {deleteErrorMessage && !photoToDelete && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 001.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-bold">Delete Photo Failed: </span>
                  <span>{deleteErrorMessage}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteErrorMessage(null)}
                className="text-red-700 hover:text-red-900 cursor-pointer font-bold text-xs"
              >
                &times;
              </button>
            </div>
          )}

          {/* Uploaded Photos Cards Grid with Delete Photo Option */}
          {images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Uploaded Photos ({images.length})
                </span>
                {images.length > 1 && (
                  <span className="text-[11px] text-slate-400">
                    Click a photo to switch view or delete
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {images.map((img) => {
                  const isSelected = String(img.id) === String(selectedImageId)
                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        if (!runningAnalysis && !deletingPhoto) {
                          if (originalBlobUrl) {
                            URL.revokeObjectURL(originalBlobUrl)
                            setOriginalBlobUrl(null)
                          }
                          setLoadingImage(false)
                          setOverlayError(false)
                          setSelectedImageId(img.id)
                        }
                      }}
                      className={`group relative p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {(() => {
                            const isDirectHttp = (img.imageUrl && img.imageUrl.startsWith('http')) || (img.storagePath && img.storagePath.startsWith('http'))
                            const thumbUrl = isDirectHttp
                              ? (img.imageUrl || img.storagePath)
                              : (isSelected && originalBlobUrl ? originalBlobUrl : null)
                            const isBroken = failedThumbnails[img.id]

                            if (thumbUrl && !isBroken) {
                              return (
                                <img
                                  src={thumbUrl}
                                  alt={img.originalFilename}
                                  onError={() => setFailedThumbnails((prev) => ({ ...prev, [img.id]: true }))}
                                  className={`h-7 w-7 rounded-lg object-cover shrink-0 border ${
                                    isSelected ? 'border-blue-600' : 'border-slate-200'
                                  }`}
                                />
                              )
                            }

                            return (
                              <div
                                className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                                }`}
                                title={!isDirectHttp ? 'Local storage photo (unauthenticated thumbnail unavailable)' : 'Photo preview unavailable'}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )
                          })()}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate" title={img.originalFilename}>
                              {img.originalFilename}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              #{img.id} &bull; {formatDate(img.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* Delete Photo Button on photo card */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteErrorMessage(null)
                            setPhotoToDelete(img)
                          }}
                          disabled={runningAnalysis || deletingPhoto}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                          title={`Delete photo #${img.id}`}
                          aria-label={`Delete photo ${img.originalFilename}`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* No Images Warning */}
          {!loadingImages && images.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              <svg className="mx-auto h-12 w-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h4 className="text-sm font-bold text-slate-800">No Photos Attached</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No inspection photos have been uploaded for Inspection #{inspection?.id} yet. Upload a photo first to run AI crack detection.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {analysisError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-bold">Analysis Error: </span>
                  <span>{analysisError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={runningAnalysis}
                className="font-semibold text-red-800 hover:text-red-900 underline shrink-0 cursor-pointer disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Image & Overlay Visual Area */}
          {selectedImageId && (
            <div className="space-y-3">
              {/* Visual Display Switcher */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setViewMode('original')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'original'
                        ? 'bg-white text-blue-600 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Original Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('highlighted')}
                    disabled={!highlightedUrl}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'highlighted'
                        ? 'bg-white text-blue-600 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    AI Overlay
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('side-by-side')}
                    disabled={!highlightedUrl}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'side-by-side'
                        ? 'bg-white text-blue-600 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline truncate max-w-[200px]" title={selectedImageMeta?.originalFilename}>
                    {selectedImageMeta?.originalFilename || `Image #${selectedImageId}`}
                  </span>

                  {/* Delete Photo Button on active image preview */}
                  {selectedImageMeta && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteErrorMessage(null)
                        setPhotoToDelete(selectedImageMeta)
                      }}
                      disabled={runningAnalysis || deletingPhoto}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      title="Delete this photo"
                      aria-label="Delete this photo"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                      <span>Delete Photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Image Container */}
              <div className="rounded-xl border border-slate-200 bg-slate-950/5 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px]">
                {viewMode === 'side-by-side' && highlightedUrl ? (
                  <div className="grid grid-cols-2 gap-2 w-full h-full p-2">
                    {/* Left Column: Original Photo */}
                    <div className="flex flex-col items-center justify-center h-full min-h-[240px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Original Photo</span>
                      {loadingImage && !directImageUrl ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[180px] max-h-[320px] w-full rounded-lg bg-slate-900 p-4 text-center text-slate-400">
                          <svg className="animate-spin h-5 w-5 text-blue-500 mb-2" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-xs">Loading photo...</span>
                        </div>
                      ) : effectiveOriginalUrl && !isImageUnavailable ? (
                        <img
                          src={effectiveOriginalUrl}
                          alt="Original structural inspection"
                          className="rounded-lg object-contain max-h-[320px] w-full bg-slate-900"
                          onError={() => setFailedImages((prev) => ({ ...prev, [selectedImageId]: true }))}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[180px] max-h-[320px] w-full rounded-lg bg-slate-900 p-4 text-center text-slate-400">
                          <span className="text-xs font-semibold">Original photo unavailable</span>
                          <span className="text-[10px] text-slate-500 mt-1">
                            {selectedImageMeta?.originalFilename
                              ? `"${selectedImageMeta.originalFilename}" is a local disk reference not in cloud storage`
                              : 'Local file not found in storage'}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Right Column: AI Detected Anomalies */}
                    <div className="flex flex-col items-center justify-center h-full min-h-[240px]">
                      <span className="text-[10px] font-bold text-blue-600 uppercase mb-1">AI Detected Anomalies</span>
                      {overlayError ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[180px] max-h-[320px] w-full rounded-lg bg-slate-900 p-4 text-center text-slate-400">
                          <span className="text-xs font-semibold">AI overlay unavailable</span>
                          <span className="text-[10px] text-slate-500 mt-1">Detection overlay not found</span>
                        </div>
                      ) : (
                        <img
                          src={highlightedUrl}
                          alt="AI highlighted anomalies"
                          className="rounded-lg object-contain max-h-[320px] w-full bg-slate-900"
                          onError={() => setOverlayError(true)}
                        />
                      )}
                    </div>
                  </div>
                ) : viewMode === 'highlighted' ? (
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    {highlightedUrl && !overlayError ? (
                      <img
                        src={highlightedUrl}
                        alt="AI highlighted crack detection overlay"
                        className="rounded-lg object-contain max-h-[350px] w-full bg-slate-900"
                        onError={() => setOverlayError(true)}
                      />
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">AI Detection Overlay Unavailable</span>
                        <span className="text-slate-500 max-w-xs">Detection overlay not found for this photo.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Original Photo View (Default) */
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    {loadingImage && !directImageUrl ? (
                      <div className="p-8 flex flex-col items-center justify-center text-slate-400">
                        <svg className="animate-spin h-6 w-6 text-blue-600 mb-2" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-xs">Loading photo from secure storage...</span>
                      </div>
                    ) : effectiveOriginalUrl && !isImageUnavailable ? (
                      <img
                        src={effectiveOriginalUrl}
                        alt="Original structural photo"
                        className="rounded-lg object-contain max-h-[350px] w-full bg-slate-900"
                        onError={() => setFailedImages((prev) => ({ ...prev, [selectedImageId]: true }))}
                      />
                    ) : (
                      <div className="p-8 text-center text-xs flex flex-col items-center justify-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">Original photo unavailable</span>
                        <span className="text-slate-500 max-w-xs">
                          {selectedImageMeta?.originalFilename
                            ? `The file "${selectedImageMeta.originalFilename}" is stored as a local disk reference that was not persisted to cloud storage.`
                            : 'The original file for this inspection photo is stored on local disk and is not available in cloud storage.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analysis Results / Status Section */}
          {loadingExistingAnalysis ? (
            <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Checking previous screening results...</span>
            </div>
          ) : analysis ? (
            /* Structured Analysis Results Grid */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Visual Screening Findings
                </h4>
                <span className="text-[11px] text-slate-500">
                  Analyzed: {formatDate(analysis.analyzedAt || analysis.createdAt)}
                </span>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Crack Detection */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Detection Status
                  </span>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                        analysis.crackDetected
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {analysis.crackDetected ? 'CRACK DETECTED' : 'CLEAR / NORMAL'}
                    </span>
                  </div>
                </div>

                {/* Screening Category */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Category
                  </span>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getCategoryBadgeClass(
                        analysis.screeningCategory
                      )}`}
                    >
                      {analysis.screeningCategory || 'NORMAL'}
                    </span>
                  </div>
                </div>

                {/* Crack Area % */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Crack Area %
                  </span>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {analysis.crackAreaPercentage !== null && analysis.crackAreaPercentage !== undefined
                      ? `${(analysis.crackAreaPercentage * 100).toFixed(2)}%`
                      : '0.00%'}
                  </div>
                </div>

                {/* Region Count */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Regions Found
                  </span>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {analysis.regionsCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Technical Model Metadata */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Model Pipeline</span>
                  <span className="font-semibold text-slate-800">
                    {analysis.modelName || 'CrackVision-CV-Baseline'} (v{analysis.modelVersion || '0.1.0'})
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Statistical Confidence</span>
                  <span className="font-mono font-medium text-slate-700">
                    {analysis.confidence !== null && analysis.confidence !== undefined
                      ? `${(analysis.confidence * 100).toFixed(1)}%`
                      : 'Not available'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Pipeline Type</span>
                  <span className="font-mono text-slate-600">
                    {analysis.modelType || 'experimental_computer_vision_baseline'}
                  </span>
                </div>
              </div>

              {/* Mandatory Preliminary Disclaimer */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3 text-xs text-amber-900">
                <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-bold block uppercase tracking-wide text-[10px] text-amber-800">
                    Preliminary Visual Screening Notice
                  </span>
                  <p className="mt-0.5 text-amber-800 leading-relaxed text-[11px]">
                    {analysis.disclaimer ||
                      'Automated visual screening aid only. This computer-vision baseline does not provide a structural safety assessment or structural engineering certification. All detections must be reviewed and verified on-site by a qualified structural engineer.'}
                  </p>
                </div>
              </div>

              {/* Engineer Review Status Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">
                      Site Engineer Review Status
                    </span>
                    {latestReview ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getDecisionBadge(latestReview.decision)}`}>
                        {latestReview.decision}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Pending Engineer Review
                      </span>
                    )}
                  </div>

                  {(userRole === 'SITE_ENGINEER' || userRole === 'ADMIN' || userRole === 'SITE_ADMIN') && (
                    <button
                      type="button"
                      onClick={() => setIsReviewModalOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      {latestReview ? 'Update Review' : '+ Submit Determination'}
                    </button>
                  )}
                </div>

                {latestReview ? (
                  <div className="text-xs space-y-1.5 pt-1 border-t border-slate-100">
                    <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                      &ldquo;{latestReview.comments}&rdquo;
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Reviewer: {latestReview.reviewer?.name || latestReview.reviewerName || 'Site Engineer'}
                      </span>
                      <span>Certified: {formatDate(latestReview.reviewedAt || latestReview.createdAt)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    This AI screening run has not yet received a certified engineering review determination.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Prompt to run analysis */
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center space-y-2">
              <h4 className="text-sm font-bold text-slate-800">Ready for Crack Screening</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No visual screening has been performed on Image #{selectedImageId} yet. Click below to execute OpenCV edge, contour, and morphological analysis.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={runningAnalysis}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Close
          </button>

          {selectedImageId && (
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={runningAnalysis}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runningAnalysis && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>
                {runningAnalysis
                  ? 'Running Crack Screening...'
                  : analysis
                  ? 'Re-analyze Photo'
                  : 'Run AI Analysis'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Photo Confirmation Dialog */}
      {photoToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-dialog-title"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 id="delete-photo-dialog-title" className="text-base font-bold text-slate-900">
                    Delete Photo
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to delete this photo? This action cannot be undone.
                  </p>
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono truncate">
                    {photoToDelete.originalFilename || `Image #${photoToDelete.id}`}
                  </div>
                </div>
              </div>

              {deleteErrorMessage && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <span className="font-bold">Error: </span>
                  <span>{deleteErrorMessage}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPhotoToDelete(null)
                    setDeleteErrorMessage(null)
                  }}
                  disabled={deletingPhoto}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePhoto}
                  disabled={deletingPhoto}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingPhoto ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                      <span>Delete Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Review Modal */}
      {isReviewModalOpen && analysis && (
        <SubmitReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          initialInspection={inspection}
          initialAnalysisId={analysis.id}
          inspections={[inspection]}
          token={token}
          onSuccess={(newReview) => {
            setLatestReview(newReview)
            if (onRefresh) onRefresh()
          }}
        />
      )}
    </div>
  )
}
