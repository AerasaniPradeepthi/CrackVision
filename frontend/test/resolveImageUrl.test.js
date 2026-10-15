import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveImageUrl, apiUrl } from '../src/api/config.js'

describe('resolveImageUrl and apiUrl utilities', () => {
  test('returns direct HTTPS Cloudinary URLs untouched', () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/beam'
    assert.equal(resolveImageUrl(cloudinaryUrl), cloudinaryUrl)
  })

  test('returns direct HTTP URLs untouched', () => {
    const httpUrl = 'http://example.com/inspections/photo.jpg'
    assert.equal(resolveImageUrl(httpUrl), httpUrl)
  })

  test('returns blob URLs untouched', () => {
    const blobUrl = 'blob:http://localhost:5173/77dfd83e-329b-4497-b5f7-41ec92a01ceb'
    assert.equal(resolveImageUrl(blobUrl), blobUrl)
  })

  test('returns data URLs untouched', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    assert.equal(resolveImageUrl(dataUrl), dataUrl)
  })

  test('returns clean relative path when API_BASE_URL is not set', () => {
    assert.equal(resolveImageUrl('/api/inspections/1/images/4'), '/api/inspections/1/images/4')
    assert.equal(resolveImageUrl('api/inspections/1/images/4'), '/api/inspections/1/images/4')
    assert.equal(resolveImageUrl('/outputs/highlighted_1760453303.png'), '/outputs/highlighted_1760453303.png')
  })

  test('handles null, undefined, and empty string safely', () => {
    assert.equal(resolveImageUrl(null), null)
    assert.equal(resolveImageUrl(undefined), null)
    assert.equal(resolveImageUrl(''), null)
    assert.equal(resolveImageUrl('   '), null)
    assert.equal(resolveImageUrl(123), null)
  })

  test('apiUrl resolves relative endpoints and absolute URLs safely', () => {
    assert.equal(apiUrl('https://external.com/api'), 'https://external.com/api')
    assert.equal(apiUrl('/api/inspections'), '/api/inspections')
    assert.equal(apiUrl(''), '')
  })
})
