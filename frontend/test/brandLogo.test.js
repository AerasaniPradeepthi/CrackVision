import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Brand Logo & Favicon Assets', () => {
  test('favicon.svg exists and contains stylized high-rise building with foundation and scanline', () => {
    const faviconPath = path.resolve(__dirname, '../public/favicon.svg')
    assert.ok(fs.existsSync(faviconPath), 'favicon.svg must exist')

    const svg = fs.readFileSync(faviconPath, 'utf8')
    assert.ok(svg.includes('#0B132B'), 'Favicon must use dark navy background (#0B132B)')
    assert.ok(svg.includes('#38BDF8'), 'Favicon must include cyan inspection scanline (#38BDF8)')
    assert.ok(svg.includes('<rect width="48" height="48"'), 'Favicon must have square viewbox geometry')
    assert.ok(svg.includes('#F8FAFC'), 'Favicon must include foundation plinth base (#F8FAFC)')
  })

  test('BrandLogo.jsx component defines hero, sidebar, header, and icon variants', () => {
    const brandLogoPath = path.resolve(__dirname, '../src/components/BrandLogo.jsx')
    assert.ok(fs.existsSync(brandLogoPath), 'BrandLogo.jsx must exist')

    const code = fs.readFileSync(brandLogoPath, 'utf8')
    assert.ok(code.includes('BuildingLogoIcon'), 'Must export BuildingLogoIcon')
    assert.ok(code.includes('export default function BrandLogo'), 'Must default export BrandLogo')
    assert.ok(code.includes('Structural Crack Detection and Monitoring System'), 'Must include full subtitle')
    assert.ok(code.includes("variant === 'hero'"), 'Must support hero/login variant')
    assert.ok(code.includes("variant = 'sidebar'"), 'Must support sidebar variant as default')
    assert.ok(code.includes('#0B132B'), 'Must use dark navy aesthetic')
  })
})
