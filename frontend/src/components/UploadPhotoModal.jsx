import InspectionPhotoUploader from './InspectionPhotoUploader'

export default function UploadPhotoModal({
  inspection,
  token,
  onClose,
  onSuccess,
  onAnalyze,
}) {
  if (!inspection) return null

  const compName = inspection.component?.name || 'Structure'
  const compType = inspection.component?.type || 'COMPONENT'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      aria-labelledby="upload-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 id="upload-modal-title" className="text-base font-bold text-white tracking-tight">
                Upload Inspection Photo
              </h3>
              <p className="text-xs text-slate-400">
                Inspection #{inspection.id} &bull; {compName} ({compType})
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

        {/* Modal Body */}
        <div className="p-6">
          <InspectionPhotoUploader
            inspectionId={inspection.id}
            token={token}
            onUploadSuccess={(imgData) => {
              if (onSuccess) onSuccess(imgData)
            }}
            onDone={onClose}
            onTriggerAnalysis={(imgData) => {
              onClose()
              if (onAnalyze) onAnalyze(inspection, imgData?.id)
            }}
          />
        </div>
      </div>
    </div>
  )
}
