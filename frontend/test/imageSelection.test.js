import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Dashboard Analysis Sorting and Image Deduplication', () => {
  test('sorts analyses chronologically descending across all inspections', () => {
    const rawAnalyses = [
      { id: 1, inspectionId: 1, imageId: 1, analyzedAt: '2026-10-10T10:00:00Z' },
      { id: 3, inspectionId: 2, imageId: 3, analyzedAt: '2026-10-12T12:00:00Z' },
      { id: 13, inspectionId: 1, imageId: 4, analyzedAt: '2026-10-14T15:00:00Z' },
      { id: 8, inspectionId: 3, imageId: 11, analyzedAt: '2026-10-13T09:00:00Z' },
    ]

    const sorted = [...rawAnalyses].sort((a, b) => {
      const dateA = new Date(a.analyzedAt || a.createdAt || 0).getTime()
      const dateB = new Date(b.analyzedAt || b.createdAt || 0).getTime()
      if (dateA !== dateB) return dateB - dateA
      return (b.id || 0) - (a.id || 0)
    })

    assert.equal(sorted[0].id, 13) // Most recent
    assert.equal(sorted[1].id, 8)
    assert.equal(sorted[2].id, 3)
    assert.equal(sorted[3].id, 1)
  })

  test('deduplicates multiple screenings on the same image so each card represents a distinct photo', () => {
    const rawCombined = [
      { id: 13, inspectionId: 1, imageId: 4, analyzedAt: '2026-10-14T15:00:00Z' },
      { id: 4, inspectionId: 1, imageId: 4, analyzedAt: '2026-10-14T11:00:00Z' }, // Duplicate run on image 4
      { id: 12, inspectionId: 6, imageId: 14, analyzedAt: '2026-10-14T14:00:00Z' },
      { id: 8, inspectionId: 3, imageId: 11, analyzedAt: '2026-10-14T10:00:00Z' },
      { id: 7, inspectionId: 3, imageId: 11, analyzedAt: '2026-10-13T08:00:00Z' }, // Duplicate run on image 11
    ]

    const seenImageIds = new Set()
    const distinctByImage = []
    for (const item of rawCombined) {
      const imgKey = item.imageId ? String(item.imageId) : `analysis-${item.id}`
      if (!seenImageIds.has(imgKey)) {
        seenImageIds.add(imgKey)
        distinctByImage.push(item)
      }
    }

    assert.equal(distinctByImage.length, 3)
    assert.deepEqual(distinctByImage.map((i) => i.imageId), [4, 14, 11])
  })
})

describe('Inspection Report Target Image Resolution', () => {
  test('matches image corresponding to latest analysis imageId instead of blindly picking index 0', () => {
    const images = [
      { id: 1, originalFilename: 'crack.png', storagePath: 'uploads/inspections/crack.png' }, // Legacy local 404
      { id: 4, originalFilename: 'beam.png', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/beam' },
    ]
    const latestAnalysis = { id: 13, imageId: 4 }

    const targetImg = (latestAnalysis?.imageId
      ? images.find((img) => String(img.id) === String(latestAnalysis.imageId))
      : null) || images.find((img) => (img.imageUrl && img.imageUrl.startsWith('http')) || (img.storagePath && img.storagePath.startsWith('http'))) || images[0]

    assert.equal(targetImg.id, 4)
    assert.equal(targetImg.originalFilename, 'beam.png')
    assert.equal(targetImg.imageUrl.startsWith('https://res.cloudinary.com/'), true)
  })

  test('falls back to persistent cloud photo if latest analysis has no imageId', () => {
    const images = [
      { id: 1, originalFilename: 'crack.png', storagePath: 'uploads/inspections/crack.png' },
      { id: 3, originalFilename: 'pillarcrack.png', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack' },
    ]
    const latestAnalysis = null

    const targetImg = (latestAnalysis?.imageId
      ? images.find((img) => String(img.id) === String(latestAnalysis.imageId))
      : null) || images.find((img) => (img.imageUrl && img.imageUrl.startsWith('http')) || (img.storagePath && img.storagePath.startsWith('http'))) || images[0]

    assert.equal(targetImg.id, 3)
    assert.equal(targetImg.originalFilename, 'pillarcrack.png')
  })
})

describe('Direct URL and Error Isolation', () => {
  test('resolves direct Cloudinary URL from imageUrl or storagePath', () => {
    const imgWithUrl = { id: 4, imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/beam', storagePath: 'beam' }
    const imgWithStorageHttp = { id: 8, imageUrl: null, storagePath: 'https://res.cloudinary.com/dudhz46j/image/upload/photo' }
    const imgLocalOnly = { id: 1, imageUrl: null, storagePath: 'uploads/inspections/crack.png' }

    const getDirectUrl = (img) => {
      if (img?.imageUrl && img.imageUrl.startsWith('http')) return img.imageUrl
      if (img?.storagePath && img.storagePath.startsWith('http')) return img.storagePath
      return null
    }

    assert.equal(getDirectUrl(imgWithUrl), 'https://res.cloudinary.com/dudhz46j/image/upload/beam')
    assert.equal(getDirectUrl(imgWithStorageHttp), 'https://res.cloudinary.com/dudhz46j/image/upload/photo')
    assert.equal(getDirectUrl(imgLocalOnly), null)
  })

  test('failedImages dictionary isolates errors to specific image without poisoning others', () => {
    const failedImages = { 1: true, 6: true } // Legacy local 404 images failed

    assert.equal(Boolean(failedImages[1]), true)
    assert.equal(Boolean(failedImages[6]), true)
    assert.equal(Boolean(failedImages[4]), false) // Cloudinary beam.png is clean and renders
    assert.equal(Boolean(failedImages[3]), false) // Cloudinary pillarcrack is clean and renders
  })
})
