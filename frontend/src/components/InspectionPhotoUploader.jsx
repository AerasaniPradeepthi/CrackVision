import { useState, useEffect, useRef } from 'react'
import { resolveImageUrl } from '../api/config'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'Please choose an image file to upload.' }
  }

  const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : ''
  const hasValidType = file.type ? ALLOWED_TYPES.includes(file.type.toLowerCase()) : false
  const hasValidExt = ALLOWED_EXTENSIONS.includes(ext)

  if (!hasValidType && !hasValidExt) {
    return {
      valid: false,
      error: 'Unsupported image format. Allowed formats are JPEG, PNG, and WebP.',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 10 MB maximum limit.`,
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'Selected file is empty (0 bytes).',
    }
  }

  return { valid: true }
}

export default function InspectionPhotoUploader({
  inspectionId,
  token,
  onUploadSuccess,
  onDone,
  onTriggerAnalysis,
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteSuccess, setDeleteSuccess] = useState(null)
  const [uploadTab, setUploadTab] = useState('file') // 'file' or 'url'
  const [cloudinaryUrl, setCloudinaryUrl] = useState('')
  const [customFilename, setCustomFilename] = useState('')

  const fileInputRef = useRef(null)

  const SAMPLE_CLOUDINARY_PHOTOS = [
    { name: 'Pillar Crack', filename: 'pillarcrack.png', url: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack' },
    { name: 'Beam Crack', filename: 'beam.png', url: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/beam' },
    { name: 'Stock Crack 1', filename: 'istockphoto-693649778-170667a.jpg', url: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-693649778-170667a' },
    { name: 'Stock Crack 2', filename: 'istockphoto-821516444-1024x1024.jpg', url: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-821516444-1024x1024' },
  ]

  // Revoke preview object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelect = (file) => {
    setUploadError(null)
    const check = validateFile(file)
    if (!check.valid) {
      setUploadError(check.error)
      return
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleClearSelected = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !inspectionId) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`/api/inspections/${inspectionId}/images`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Note: Content-Type is NOT set manually so browser specifies multipart boundary
        },
        body: formData,
      })

      if (!res.ok) {
        let errorMsg = `Server error uploading image (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) errorMsg = errData.error
          else if (errData?.message) errorMsg = errData.message
        } catch {
          // Fallback to default message
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      setUploadedImage(data)

      if (onUploadSuccess) {
        onUploadSuccess(data)
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to upload photo. Please retry.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteUploadedPhoto = async () => {
    if (!uploadedImage || !inspectionId) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/inspections/${inspectionId}/images/${uploadedImage.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        let msg = `Failed to delete photo (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) msg = errData.error
        } catch {
          // fallback
        }
        throw new Error(msg)
      }

      setIsDeleteConfirmOpen(false)
      setUploadedImage(null)
      handleClearSelected()
      setDeleteSuccess('Photo deleted successfully.')
      setTimeout(() => setDeleteSuccess(null), 3000)
    } catch (err) {
      setDeleteError(err.message || 'Error occurred while deleting photo.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUploadAnother = () => {
    handleClearSelected()
    setUploadedImage(null)
    setCloudinaryUrl('')
    setCustomFilename('')
  }

  const handleLinkCloudinary = async (e) => {
    if (e) e.preventDefault()
    if (!cloudinaryUrl || !inspectionId) return

    const trimmedUrl = cloudinaryUrl.trim()
    if (!trimmedUrl.toLowerCase().startsWith('https://') || !trimmedUrl.toLowerCase().includes('.cloudinary.com/')) {
      setUploadError('Please provide a valid, secure HTTPS Cloudinary URL (e.g., https://res.cloudinary.com/...)')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const res = await fetch(`/api/inspections/${inspectionId}/images/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageUrl: trimmedUrl,
          originalFilename: customFilename.trim() || undefined,
        }),
      })

      if (!res.ok) {
        let errorMsg = `Server error linking image (HTTP ${res.status})`
        try {
          const errData = await res.json()
          if (errData?.error) errorMsg = errData.error
          else if (errData?.message) errorMsg = errData.message
        } catch {}
        throw new Error(errorMsg)
      }

      const data = await res.json()
      setUploadedImage(data)
      if (onUploadSuccess) {
        onUploadSuccess(data)
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to link Cloudinary image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Uploaded Success State */}
      {uploadedImage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h5 className="text-xs font-bold text-emerald-900">
                Photo Uploaded Successfully
              </h5>
              <p className="text-[11px] text-emerald-700">
                Stored and linked to Inspection #{inspectionId}
              </p>
            </div>
          </div>

          {/* Visual Image Preview of Uploaded Photo */}
          {(() => {
            const uploadPreviewSrc =
              (uploadedImage.imageUrl && /^https?:\/\//i.test(uploadedImage.imageUrl))
                ? uploadedImage.imageUrl
                : (uploadedImage.storagePath && /^https?:\/\//i.test(uploadedImage.storagePath))
                ? uploadedImage.storagePath
                : (previewUrl || resolveImageUrl(uploadedImage.imageUrl))

            if (!uploadPreviewSrc) return null

            return (
              <div className="relative w-full h-48 rounded-lg bg-slate-900 border border-emerald-300/40 overflow-hidden flex items-center justify-center">
                <img
                  src={uploadPreviewSrc}
                  alt={uploadedImage.originalFilename || 'Uploaded inspection photo'}
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white backdrop-blur-xs truncate max-w-[200px]">
                  {uploadedImage.originalFilename}
                </span>
              </div>
            )
          })()}

          {/* Returned Image Metadata Grid */}
          <div className="rounded-lg border border-emerald-200/80 bg-white p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
              <span className="text-slate-500 font-medium">Image ID</span>
              <span className="font-mono font-bold text-slate-900">
                #{uploadedImage.id}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
              <span className="text-slate-500 font-medium">Original Filename</span>
              <span className="font-medium text-slate-800 truncate max-w-[220px]" title={uploadedImage.originalFilename}>
                {uploadedImage.originalFilename}
              </span>
            </div>
            {uploadedImage.fileSize && (
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">File Size</span>
                <span className="font-mono text-slate-700">
                  {formatFileSize(uploadedImage.fileSize)}
                </span>
              </div>
            )}
            {uploadedImage.contentType && (
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-medium">Format</span>
                <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {uploadedImage.contentType}
                </span>
              </div>
            )}
            {uploadedImage.storedFilename && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-medium">Server Identifier</span>
                <span className="font-mono text-slate-500 truncate max-w-[200px]" title={uploadedImage.storedFilename}>
                  {uploadedImage.storedFilename}
                </span>
              </div>
            )}
          </div>

          {/* Delete Error Banner */}
          {deleteError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              <span className="font-semibold">Error: </span>{deleteError}
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setDeleteError(null)
                setIsDeleteConfirmOpen(true)
              }}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              title="Delete this uploaded photo"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
              <span>Delete Photo</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUploadAnother}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                Upload Another Photo
              </button>
              {onTriggerAnalysis && (
                <button
                  type="button"
                  onClick={() => onTriggerAnalysis(uploadedImage)}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-8-5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.343 4.343a.75.75 0 011.06 0l1.061 1.061a.75.75 0 01-1.06 1.06L4.343 5.404a.75.75 0 010-1.06zm9.193 9.193a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zm-9.193 7.071a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm9.193-9.193a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0z" />
                  </svg>
                  <span>Analyze with AI &rarr;</span>
                </button>
              )}
              {onDone && !onTriggerAnalysis && (
                <button
                  type="button"
                  onClick={onDone}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Upload & File Selection Section */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Attach Inspection Photo
              </span>
              <span className="text-[11px] text-slate-500">
                JPEG, PNG, or WebP &bull; Cloudinary or Local
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              Inspection #{inspectionId}
            </span>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex border-b border-slate-200 gap-4 pt-1">
            <button
              type="button"
              onClick={() => {
                setUploadTab('file')
                setUploadError(null)
              }}
              className={`pb-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                uploadTab === 'file'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Upload Local File
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadTab('url')
                setUploadError(null)
              }}
              className={`pb-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                uploadTab === 'url'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Link Cloudinary Image URL
            </button>
          </div>

          {/* Validation or API Error Banner */}
          {uploadError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div className="min-w-0">
                  <span className="font-semibold">Upload Error: </span>
                  <span>{uploadError}</span>
                </div>
              </div>
              {uploadTab === 'file' && selectedFile && (
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="text-xs font-semibold text-red-800 hover:text-red-900 underline shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {uploadTab === 'file' ? (
            /* File Upload Tab */
            selectedFile && previewUrl ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs">
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono">{formatFileSize(selectedFile.size)}</span>
                      <span>&bull;</span>
                      <span className="uppercase text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                        {selectedFile.type.replace('image/', '') || 'IMAGE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Ready to attach to Inspection #{inspectionId}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={uploading}
                    className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={uploading}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-50"
                  >
                    Choose Different File
                  </button>

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading && (
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{uploading ? 'Uploading Photo...' : 'Upload Photo'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="mx-auto h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    <line x1="16" x2="22" y1="5" y2="5" />
                    <line x1="19" x2="19" y1="2" y2="8" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>

                <div className="text-xs font-semibold text-slate-800">
                  <span className="text-blue-600 hover:underline">Click to upload photo</span> or drag and drop
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  JPEG, PNG, or WebP up to 10 MB
                </p>
              </div>
            )
          ) : (
            /* Cloudinary URL Linking Tab */
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Cloudinary Image URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={cloudinaryUrl}
                  onChange={(e) => setCloudinaryUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/dudhz46j/image/upload/..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Original Filename / Label (Optional)
                </label>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="e.g., pillarcrack.png or column-beam-joint.jpg"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Quick Sample Photos */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-500 block">
                  Quick attach accessible Cloudinary sample:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_CLOUDINARY_PHOTOS.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => {
                        setCloudinaryUrl(sample.url)
                        setCustomFilename(sample.filename)
                        setUploadError(null)
                      }}
                      className="px-2.5 py-1 text-[11px] rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL Preview if valid */}
              {cloudinaryUrl && cloudinaryUrl.startsWith('https://') && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center gap-3">
                  <img
                    src={cloudinaryUrl}
                    alt="Cloudinary preview"
                    className="h-16 w-16 object-cover rounded-md border border-slate-200 bg-white shrink-0"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-slate-800">Preview Available</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-xs">{cloudinaryUrl}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleLinkCloudinary}
                  disabled={uploading || !cloudinaryUrl.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  <span>{uploading ? 'Linking Photo...' : 'Link Cloudinary Photo'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Success Alert */}
      {deleteSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <span>{deleteSuccess}</span>
          <button
            type="button"
            onClick={() => setDeleteSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {isDeleteConfirmOpen && uploadedImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="uploader-delete-dialog-title"
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
                  <h3 id="uploader-delete-dialog-title" className="text-base font-bold text-slate-900">
                    Delete Photo
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to delete this photo? This action cannot be undone.
                  </p>
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono truncate">
                    {uploadedImage.originalFilename || `Image #${uploadedImage.id}`}
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <span className="font-bold">Error: </span>
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false)
                    setDeleteError(null)
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUploadedPhoto}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
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
    </div>
  )
}
