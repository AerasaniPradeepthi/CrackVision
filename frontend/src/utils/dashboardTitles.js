/**
 * Helper utility to determine explicit, user-friendly titles for AI screening cards.
 *
 * Requirements:
 * - Beam photo (beam.png / Image #4) -> "Beam"
 * - Concrete crack photo (istockphoto-821516444... / Image #11) -> "Concrete Wall"
 * - Window & wall-corner photo (istockphoto-693649778... / Image #14) -> "Window Wall Corner"
 * - Pillar photo (pillarcrack.png, pillar2.png / Image #3, #10, #13) -> "Pillar Crack"
 * - Fallback to database component name or inspection identifier
 */
export function getDashboardCardTitle(analysis) {
  if (!analysis) return 'Structural Inspection'

  const fn = (
    analysis.originalFilename ||
    analysis.inspectionImage?.originalFilename ||
    ''
  ).toLowerCase()

  const url = (
    analysis.imageUrl ||
    analysis.storagePath ||
    analysis.inspectionImage?.storagePath ||
    ''
  ).toLowerCase()

  const imageId = String(analysis.imageId || analysis.inspectionImage?.id || '')

  // 1. Beam photo (beam.png / Image #4) -> Beam
  if (fn.includes('beam') || url.includes('/beam') || imageId === '4') {
    return 'Beam'
  }

  // 2. Concrete crack photo (istockphoto-821516444... / Image #11) -> Concrete Wall
  if (fn.includes('821516444') || url.includes('821516444') || imageId === '11') {
    return 'Concrete Wall'
  }

  // 3. Window & wall-corner photo (istockphoto-693649778... / Image #14) -> Window Wall Corner
  if (fn.includes('693649778') || url.includes('693649778') || imageId === '14') {
    return 'Window Wall Corner'
  }

  // 4. Pillar photo (pillarcrack.png, pillar2.png / Image #3, #10, #13) -> Pillar Crack
  if (
    fn.includes('pillar') ||
    url.includes('pillar') ||
    imageId === '3' ||
    imageId === '10' ||
    imageId === '13'
  ) {
    return 'Pillar Crack'
  }

  return (
    analysis.inspection?.component?.name ||
    analysis.componentName ||
    `Inspection #${analysis.inspectionId || analysis.inspection?.id || analysis.id}`
  )
}
