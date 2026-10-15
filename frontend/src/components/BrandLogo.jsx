import React from 'react'

/**
 * BuildingLogoIcon renders the stylized architectural high-rise building
 * with vertical facade lines, civil foundation base, and CrackVision scan accent.
 */
export function BuildingLogoIcon({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform ${className}`}
      aria-label="CrackVision Architectural Building Logo"
    >
      {/* Dark Navy Blueprint Container */}
      <rect width="48" height="48" rx="10" fill="#0B132B" />
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="9.25"
        stroke="#1E293B"
        strokeWidth="1.5"
      />

      {/* Subtle Structural Alignment Grid Lines */}
      <line x1="24" y1="4" x2="24" y2="44" stroke="#1E293B" strokeWidth="0.6" strokeDasharray="1 3" />
      <line x1="4" y1="26" x2="44" y2="26" stroke="#1E293B" strokeWidth="0.6" strokeDasharray="1 3" />

      {/* Left Wing (Stepped Silhouette) */}
      <path
        d="M11 20L18 16V35H11V20Z"
        fill="#CBD5E1"
      />
      {/* Left Wing Vertical Architectural Line */}
      <line x1="14.5" y1="20" x2="14.5" y2="33" stroke="#0B132B" strokeWidth="1.2" strokeLinecap="round" />

      {/* Main High-Rise Center Tower (Monolithic Architectural Crown) */}
      <path
        d="M19 12L24 7L29 12V35H19V12Z"
        fill="#FFFFFF"
      />
      {/* Tower Vertical Architectural Facade Slits */}
      <line x1="22.5" y1="13.5" x2="22.5" y2="33" stroke="#0B132B" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="25.5" y1="13.5" x2="25.5" y2="33" stroke="#0B132B" strokeWidth="1.2" strokeLinecap="round" />

      {/* Right Wing (Stepped Silhouette) */}
      <path
        d="M30 18L37 22V35H30V18Z"
        fill="#E2E8F0"
      />
      {/* Right Wing Vertical Architectural Line */}
      <line x1="33.5" y1="21.5" x2="33.5" y2="33" stroke="#0B132B" strokeWidth="1.2" strokeLinecap="round" />

      {/* Active CrackVision Inspection Scanline */}
      <line
        x1="8"
        y1="26"
        x2="40"
        y2="26"
        stroke="#38BDF8"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
      />
      <circle cx="24" cy="26" r="1.75" fill="#38BDF8" />
      <circle cx="24" cy="26" r="3.5" stroke="#38BDF8" strokeWidth="0.6" opacity="0.6" />

      {/* Dual Reinforced Foundation Base (Plinths) */}
      <rect x="9" y="36.5" width="30" height="2.5" rx="0.8" fill="#F8FAFC" />
      <rect x="7" y="40.5" width="34" height="2.5" rx="0.8" fill="#64748B" />
    </svg>
  )
}

/**
 * BrandLogo provides flexible, responsive branding lockups across CrackVision.
 *
 * Variants:
 *  - 'hero' / 'login': For auth/welcome cards (large, bold, high-contrast).
 *  - 'sidebar': Compact horizontal lockup for navigation sidebar.
 *  - 'header': Compact lockup with dark typography for light top bars.
 *  - 'icon': Building icon only.
 */
export default function BrandLogo({
  variant = 'sidebar',
  theme = 'dark',
  subtitle = null,
  size = null,
  className = '',
}) {
  if (variant === 'icon') {
    return <BuildingLogoIcon size={size || 40} className={className} />
  }

  // Hero / Auth screens (Login & Register)
  if (variant === 'hero' || variant === 'login') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        <BuildingLogoIcon size={size || 46} className="shadow-lg shadow-blue-950/40" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight font-sans">
              Crack<span className="text-blue-400">Vision</span>
            </span>
          </div>
          <span className="text-xs font-medium text-slate-300 block tracking-wide mt-0.5 leading-snug">
            {subtitle || 'Structural Crack Detection and Monitoring System'}
          </span>
        </div>
      </div>
    )
  }

  // Header lockup (typically on light backgrounds)
  if (variant === 'header') {
    const isDark = theme === 'dark'
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <BuildingLogoIcon size={size || 34} />
        <div className="min-w-0">
          <span
            className={`text-base font-bold tracking-tight block leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Crack<span className="text-blue-600">Vision</span>
          </span>
          <span
            className={`text-[10px] font-medium tracking-tight block truncate ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {subtitle || 'Structural Crack Detection and Monitoring System'}
          </span>
        </div>
      </div>
    )
  }

  // Default: Sidebar variant (compact, dark background)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BuildingLogoIcon size={size || 38} className="ring-1 ring-blue-500/20 rounded-xl" />
      <div className="min-w-0">
        <span className="text-base font-bold tracking-tight text-white block leading-tight">
          Crack<span className="text-blue-400">Vision</span>
        </span>
        <span className="text-[10px] font-medium tracking-tight text-slate-400 block truncate">
          Structural Monitoring
        </span>
        {subtitle && (
          <span className="text-[9px] font-mono text-blue-400 block uppercase">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
