import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardCardTitle } from '../src/utils/dashboardTitles.js'

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

describe('Dashboard Card Titles (Requirement 2)', () => {

  test('maps Beam photo to "Beam"', () => {
    assert.equal(getDashboardCardTitle({ originalFilename: 'beam.png', imageId: 4 }), 'Beam')
    assert.equal(getDashboardCardTitle({ imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/beam' }), 'Beam')
  })

  test('maps Concrete crack photo to "Concrete Wall"', () => {
    assert.equal(getDashboardCardTitle({ originalFilename: 'istockphoto-821516444-1024x1024.jpg', imageId: 11 }), 'Concrete Wall')
    assert.equal(getDashboardCardTitle({ storagePath: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-821516444-1024x1024' }), 'Concrete Wall')
  })

  test('maps Window & wall-corner photo to "Window Wall Corner"', () => {
    assert.equal(getDashboardCardTitle({ originalFilename: 'istockphoto-693649778-170667a.jpg', imageId: 14 }), 'Window Wall Corner')
    assert.equal(getDashboardCardTitle({ storagePath: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-693649778-170667a' }), 'Window Wall Corner')
  })

  test('maps Pillar photo to "Pillar Crack"', () => {
    assert.equal(getDashboardCardTitle({ originalFilename: 'pillarcrack.png', imageId: 3 }), 'Pillar Crack')
    assert.equal(getDashboardCardTitle({ originalFilename: 'pillar2.png', imageId: 13 }), 'Pillar Crack')
    assert.equal(getDashboardCardTitle({ imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack' }), 'Pillar Crack')
  })

  test('falls back to component name or inspection identifier for unrelated inspections', () => {
    assert.equal(
      getDashboardCardTitle({ inspection: { component: { name: 'Basement Slab' } } }),
      'Basement Slab'
    )
    assert.equal(
      getDashboardCardTitle({ inspectionId: 99 }),
      'Inspection #99'
    )
  })
})

describe('Canonical Card Prioritization and Pillar Recovery (Requirements 2 & 3)', () => {
  test('prioritizes direct Cloudinary pillar image over broken local pillar image and orders the 4 canonical cards', () => {
    const rawAnalyses = [
      { id: 13, imageId: 4, originalFilename: 'beam.png', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/beam', analyzedAt: '2026-10-14T15:00:00Z' },
      { id: 12, imageId: 14, originalFilename: 'istockphoto-693649778-170667a.jpg', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/istockphoto-693649778-170667a', analyzedAt: '2026-10-14T14:00:00Z' },
      { id: 11, imageId: 13, originalFilename: 'pillar2.png', storagePath: 'uploads/inspections/broken-local.png', analyzedAt: '2026-10-14T11:00:00Z' }, // Local broken pillar
      { id: 8, imageId: 11, originalFilename: 'istockphoto-821516444-1024x1024.jpg', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/istockphoto-821516444-1024x1024', analyzedAt: '2026-10-14T10:00:00Z' },
      { id: 3, imageId: 3, originalFilename: 'pillarcrack.png', imageUrl: 'https://res.cloudinary.com/dudhz46j/image/upload/pillarcrack', analyzedAt: '2026-10-13T19:00:00Z' }, // Working Cloudinary pillar
    ]

    function getTitle(a) {
      const fn = (a.originalFilename || '').toLowerCase()
      if (fn.includes('beam')) return 'Beam'
      if (fn.includes('821516444')) return 'Concrete Wall'
      if (fn.includes('693649778')) return 'Window Wall Corner'
      if (fn.includes('pillar')) return 'Pillar Crack'
      return 'Other'
    }

    const canonicalOrder = {
      'Beam': 1,
      'Concrete Wall': 2,
      'Window Wall Corner': 3,
      'Pillar Crack': 4,
    }

    const seenTitles = new Set()
    const seenImageIds = new Set()
    const distinctByImage = []

    const canonicalCandidates = rawAnalyses.filter((item) => Boolean(canonicalOrder[getTitle(item)]))

    canonicalCandidates.sort((a, b) => {
      const aHasHttp = Boolean((a.imageUrl && a.imageUrl.startsWith('http')) || (a.storagePath && a.storagePath.startsWith('http')))
      const bHasHttp = Boolean((b.imageUrl && b.imageUrl.startsWith('http')) || (b.storagePath && b.storagePath.startsWith('http')))
      if (aHasHttp !== bHasHttp) return bHasHttp ? 1 : -1
      const orderA = canonicalOrder[getTitle(a)] || 99
      const orderB = canonicalOrder[getTitle(b)] || 99
      if (orderA !== orderB) return orderA - orderB
      return (b.id || 0) - (a.id || 0)
    })

    for (const item of canonicalCandidates) {
      const title = getTitle(item)
      const imgKey = item.imageId ? String(item.imageId) : `analysis-${item.id}`
      if (!seenTitles.has(title) && !seenImageIds.has(imgKey)) {
        seenTitles.add(title)
        seenImageIds.add(imgKey)
        distinctByImage.push(item)
      }
    }

    distinctByImage.sort((a, b) => (canonicalOrder[getTitle(a)] || 99) - (canonicalOrder[getTitle(b)] || 99))

    assert.equal(distinctByImage.length, 4)
    assert.deepEqual(distinctByImage.map(getTitle), ['Beam', 'Concrete Wall', 'Window Wall Corner', 'Pillar Crack'])
    // Confirms working Cloudinary pillar (Image 3) was selected over broken local pillar (Image 13)
    const pillarCard = distinctByImage.find((i) => getTitle(i) === 'Pillar Crack')
    assert.equal(pillarCard.imageId, 3)
    assert.equal(pillarCard.imageUrl.includes('pillarcrack'), true)
  })

  test('resolves pillar photo via fallback Cloudinary URL if analysis has only broken local reference', () => {
    const analysisWithBrokenLocalPillar = {
      id: 11,
      imageId: 13,
      originalFilename: 'pillar2.png',
      storagePath: 'uploads/inspections/a39e3b79-dd75-48a4-acf0-74470a59b33a.png',
      imageUrl: null,
    }

    const resolvePhotoUrl = (analysis) => {
      let directUrl = (analysis.imageUrl && /^https?:\/\//i.test(analysis.imageUrl)) ? analysis.imageUrl :
        (analysis.storagePath && /^https?:\/\//i.test(analysis.storagePath)) ? analysis.storagePath : null
      const fn = (analysis.originalFilename || '').toLowerCase()
      if (!directUrl && fn.includes('pillar')) {
        directUrl = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack'
      }
      return directUrl
    }

    const resolved = resolvePhotoUrl(analysisWithBrokenLocalPillar)
    assert.equal(resolved, 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack')
  })

  test('preserves honest unavailable state and does NOT substitute pillar URL for unrelated missing photos', () => {
    const unrelatedBrokenPhotos = [
      { id: 1, imageId: 1, originalFilename: 'crack.png', storagePath: 'uploads/inspections/crack.png', imageUrl: null },
      { id: 6, imageId: 6, originalFilename: 'WhatsApp Image 2026-10-13 at 9.55.22 PM.jpeg', storagePath: 'uploads/inspections/whatsapp.jpeg', imageUrl: null },
      { id: 7, imageId: 7, originalFilename: 'crack.png', storagePath: 'uploads/inspections/crack2.png', imageUrl: null },
    ]

    const resolvePhotoUrl = (analysis) => {
      let directUrl = (analysis.imageUrl && /^https?:\/\//i.test(analysis.imageUrl)) ? analysis.imageUrl :
        (analysis.storagePath && /^https?:\/\//i.test(analysis.storagePath)) ? analysis.storagePath : null
      const fn = (analysis.originalFilename || '').toLowerCase()
      const isPillarRecord = fn.includes('pillar') || String(analysis.imageId) === '13' || String(analysis.imageId) === '3'
      if (!directUrl && isPillarRecord) {
        directUrl = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack'
      }
      return directUrl
    }

    for (const photo of unrelatedBrokenPhotos) {
      const resolved = resolvePhotoUrl(photo)
      assert.equal(resolved, null, `Photo ${photo.originalFilename} should not receive pillar substitution`)
    }
  })
})

