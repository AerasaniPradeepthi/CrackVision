import { useState, useEffect, useRef } from 'react'

function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id))
}

export default function RegisterView({ onLoginSuccess, onSwitchToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [warmingUp, setWarmingUp] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [progress, setProgress] = useState(0)
  const countdownRef = useRef(null)

  useEffect(() => {
    fetchWithTimeout('/api/health', {}, 60000).catch(() => {})
  }, [])

  const startCountdown = (seconds) => {
    setCountdown(seconds)
    setProgress(0)
    clearInterval(countdownRef.current)
    const start = Date.now()
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      const remaining = Math.max(0, seconds - elapsed)
      setCountdown(Math.ceil(remaining))
      setProgress(Math.min(100, (elapsed / seconds) * 100))
      if (remaining <= 0) clearInterval(countdownRef.current)
    }, 250)
  }

  const stopCountdown = () => {
    clearInterval(countdownRef.current)
    setCountdown(0)
    setProgress(100)
  }

  useEffect(() => () => clearInterval(countdownRef.current), [])

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setWarmingUp(false)
    stopCountdown()

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    const payload = JSON.stringify({ name: name.trim(), email: email.trim(), password })

    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          setWarmingUp(true)
          startCountdown(60)
        }

        const response = await fetchWithTimeout(
          '/api/auth/register',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
          90000
        )

        stopCountdown()
        setWarmingUp(false)
        const data = await response.json()

        if (!response.ok) {
          setError(data?.error || 'Registration failed. Please check your information.')
          setLoading(false)
          return
        }

        setSuccess('Account created! Signing you in...')

        try {
          const loginRes = await fetchWithTimeout(
            '/api/auth/login',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) },
            90000
          )
          const loginData = await loginRes.json()
          if (loginRes.ok && onLoginSuccess) {
            sessionStorage.setItem('crackvision_token', loginData.token)
            sessionStorage.setItem('crackvision_user', JSON.stringify({ id: loginData.id, name: loginData.name, email: loginData.email, role: loginData.role }))
            onLoginSuccess({ id: loginData.id, name: loginData.name, email: loginData.email, role: loginData.role }, loginData.token)
            return
          }
        } catch { /* fall back */ }

        setLoading(false)
        if (onSwitchToLogin) setTimeout(() => onSwitchToLogin(email), 1200)
        return

      } catch {
        stopCountdown()
        setWarmingUp(false)
        if (attempt < maxAttempts) {
          setWarmingUp(true)
          startCountdown(10)
          await new Promise((res) => setTimeout(res, 10000))
          stopCountdown()
          setWarmingUp(false)
        } else {
          setLoading(false)
          setError('The cloud server is taking too long to respond. This happens on first use after inactivity. Please wait 30 seconds and try again.')
        }
      }
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans antialiased selection:bg-blue-600 selection:text-white">
      <div className="relative w-full lg:w-1/2 min-h-[460px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-14 overflow-hidden bg-slate-900 text-white">
        <img src="/construction-site.jpg" alt="Active construction site" className="absolute inset-0 h-full w-full object-cover object-center transform scale-105 transition-transform duration-1000 ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-slate-900/65" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 shrink-0">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 9 3 3-2 3 5 3" />
              <path d="M15 6v3" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block leading-tight">CrackVision</span>
            <span className="text-xs font-medium text-blue-300 block tracking-wide mt-0.5">Structural Crack Detection and Monitoring System</span>
          </div>
        </div>
        <div className="relative z-10 space-y-6 max-w-lg mt-auto">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">Join the Future of Structural Health.</h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">Create an account to start cataloging buildings, uploading inspections, and detecting cracks with AI precision.</p>
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 4.75a.75.75 0 00-1.5 0v4.5a.75.75 0 00.75.75h4.5a.75.75 0 000-1.5h-3.75V6.75z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Instant Account Activation</h4>
                <p className="text-[11px] text-slate-300">Start uploading inspections immediately upon registration.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v4a1 1 0 102 0V7z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Role-Based Security</h4>
                <p className="text-[11px] text-slate-300">Protected workflows for site engineers, project managers, and administrators.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 min-h-screen bg-slate-50 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="my-auto max-w-sm sm:max-w-md w-full mx-auto py-8">
          <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl mb-6">
            <button type="button" onClick={() => onSwitchToLogin && onSwitchToLogin()} className="py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer">Sign In</button>
            <button type="button" className="py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-sm transition-all">Register</button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Create an Account</h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">Register to access CrackVision inspections and monitoring</p>
          </div>

          {success && (
            <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
              <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
              <div className="flex-1 font-medium">{success}</div>
            </div>
          )}

          {warmingUp && (
            <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              <div className="flex items-start gap-2.5 mb-3">
                <svg className="animate-spin h-4 w-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">Server waking up…</p>
                  <p className="mt-0.5 text-amber-700">
                    The cloud server was asleep (free tier). Connecting now{countdown > 0 ? ` — about ${countdown}s remaining` : '…'}
                  </p>
                </div>
              </div>
              <div className="w-full bg-amber-200 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-amber-600">Please keep this tab open — do not click again.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
              <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
              <div className="flex-1"><span className="font-semibold text-red-800">Error: </span>{error}</div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg>
                </div>
                <input id="name" type="text" required disabled={loading} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Rivera" className="block w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400" />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                </div>
                <input id="register-email" type="email" autoComplete="email" required disabled={loading} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engineer@crackvision.com" className="block w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400" />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Password (min. 6 characters)</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                </div>
                <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6} disabled={loading} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className="block w-full rounded-lg border border-slate-300 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading} className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.375l1.091 1.092a4 4 0 00-5.557-5.56z" clipRule="evenodd" /><path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 014.16 5.882l2.128 2.128a4 4 0 004.46 5.92z" /></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                </div>
                <input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required disabled={loading} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••••••" className="block w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-white transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400" />
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-[11px] text-blue-700 leading-relaxed">
              New accounts are registered as <span className="font-semibold">Site Worker</span>. An Admin can upgrade your role to <span className="font-semibold">Site Engineer</span> or <span className="font-semibold">Project Manager</span>.
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading} id="register-submit-btn" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed">
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{warmingUp ? 'Server waking up…' : 'Creating account…'}</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button type="button" onClick={() => onSwitchToLogin && onSwitchToLogin()} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer">Sign In</button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>&copy; 2026 CrackVision. All rights reserved.</span>
          <div className="flex gap-3">
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Privacy</span>
            <span>&bull;</span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Terms</span>
            <span>&bull;</span>
            <span className="hover:text-slate-600 transition-colors cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </div>
  )
}
