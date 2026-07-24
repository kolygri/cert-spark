import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CircleAlert,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilePlus2,
  Files,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Menu,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
  X,
  Zap,
  Download,
  Mail,
  PenTool,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Page = 'home' | 'certificate' | 'certificates'
type VoiceState = 'idle' | 'listening' | 'review' | 'applied'
type LoginState = 'idle' | 'sending' | 'sent' | 'error'

type FormValues = Record<string, string>
type VoiceMapping = { field: keyof FormValues; label: string; value: string; confidence: number; evidence: string }

const invalidVoiceValues = new Set(['', 'n/a', 'none', 'unknown', 'unspecified', 'not mentioned', 'not provided', 'not specified', 'not stated'])

const initialValues: FormValues = {
  clientName: 'Maya Patel',
  certificateNo: 'EIC-2026-0042',
  address: '',
  postcode: '',
  installationType: 'New installation',
  description: '',
  extent: '',
  departures: '',
  clientAddress: '',
  clientPostcode: '',
  clientReference: '',
  amendmentDate: '15 April 2026',
  designerName: 'Alex Jones',
  constructorName: 'Alex Jones',
  inspectorName: 'Alex Jones',
  nextInspection: '5 years',
  designerCompany: 'AJ Electrical',
  constructorCompany: 'AJ Electrical',
  inspectorCompany: 'AJ Electrical',
  signatoryAddress: '18 Park View, Birmingham',
  signatoryPostcode: 'B13 9DE',
  signatoryPhone: '0121 555 0188',
  earthingArrangement: 'TN-C-S (PME)',
  supplyPhase: '1-phase, 2-wire',
  nominalVoltage: '230',
  nominalFrequency: '50',
  prospectiveFaultCurrent: '',
  externalLoopImpedance: '',
  mainSwitchType: 'RCD main switch',
  mainSwitchRating: '100',
  earthingConductor: '16',
  bondingConductor: '10',
  maxDemand: '',
  distributionBoard: 'CU-01',
  boardLocation: 'Hallway cupboard',
  existingComments: '',
  circuit1Description: 'Kitchen ring final circuit',
  circuit1Ocpd: '32',
  circuit1Zs: '',
  circuit1Rcd: '30',
  circuit2Description: 'Kitchen lighting',
  circuit2Ocpd: '6',
  circuit2Zs: '',
  circuit2Rcd: '30',
}

const certificateSections = [
  { id: 'A', title: 'Client details', summary: 'The person or organisation commissioning the work.' },
  { id: 'B', title: 'Installation details', summary: 'Describe the installation and its certified extent.' },
  { id: 'C', title: 'Certification', summary: 'Confirm the accountable design, construction and inspection roles.' },
  { id: 'D', title: 'Next inspection', summary: 'Set the recommended maximum interval.' },
  { id: 'E', title: 'Signatories', summary: 'Company details for the accountable people.' },
  { id: 'F', title: 'Supply & earthing', summary: 'Supply characteristics, earthing and protective conductors.' },
  { id: 'G', title: 'Installation', summary: 'Distribution equipment and connected installation particulars.' },
  { id: 'H', title: 'Inspections', summary: 'Record inspection outcomes before issuing.' },
  { id: 'I', title: 'Comments', summary: 'Comment on an existing installation where relevant.' },
  { id: 'J', title: 'Schedules', summary: 'Circuit details and measured test results.' },
] as const

type CertificateSectionId = (typeof certificateSections)[number]['id']

function App() {
  const [page, setPage] = useState<Page>('certificate')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [mobileVoiceOpen, setMobileVoiceOpen] = useState(false)
  const [values, setValues] = useState<FormValues>(initialValues)
  const [activeSection, setActiveSection] = useState<CertificateSectionId>('B')
  const [saved, setSaved] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [loginMessage, setLoginMessage] = useState('')
  const [voiceMappings, setVoiceMappings] = useState<VoiceMapping[]>([])
  const [appliedVoiceFieldCount, setAppliedVoiceFieldCount] = useState(0)
  const [appliedLowConfidenceCount, setAppliedLowConfidenceCount] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [toast, setToast] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRecordersRef = useRef(new WeakSet<MediaRecorder>())

  useEffect(() => {
    if (!supabase) return

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const completedFields = useMemo(
    () => Object.values(values).filter((value) => value.trim()).length,
    [values],
  )

  const updateValue = (key: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const startVoice = async (mobile = false) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setToast('Voice capture is not supported by this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => chunks.push(event.data)
      recorder.onstop = async () => {
        if (cancelledRecordersRef.current.has(recorder)) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        try {
          setToast('Turning your site note into certificate fields…')
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
          const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
          if (!data.session?.access_token) throw new Error('Sign in before using voice capture')
          const result = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': audio.type, Authorization: `Bearer ${data.session.access_token}` },
            body: audio,
          })
          const payload = await result.json()
          if (!result.ok) throw new Error(payload.error || 'Voice processing failed')
          setTranscript(payload.transcript)
          setVoiceMappings(payload.suggestions)
          setVoiceState('review')
          if (!payload.suggestions.length) setToast('No certificate fields were found — try a more specific note')
        } catch (error) {
          setVoiceState('idle')
          setToast(error instanceof Error ? error.message : 'Voice processing failed')
        } finally {
          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          recorderRef.current = null
        }
      }
      recorder.start()
      setVoiceState('listening')
      if (mobile) setMobileVoiceOpen(true)
    } catch {
      setToast('Microphone access was not granted')
    }
  }

  const stopVoice = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const cancelVoice = () => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      cancelledRecordersRef.current.add(recorder)
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setVoiceState('idle')
  }

  const applyVoiceFields = () => {
    const applicableMappings = voiceMappings.filter(
      (mapping) => !invalidVoiceValues.has(mapping.value.trim().toLowerCase()),
    )
    if (!applicableMappings.length) {
      setToast('No valid certificate fields to apply')
      return
    }
    setValues((current) => ({ ...current, ...Object.fromEntries(applicableMappings.map((mapping) => [mapping.field, mapping.value])) }))
    setAppliedVoiceFieldCount(applicableMappings.length)
    setAppliedLowConfidenceCount(applicableMappings.filter((mapping) => mapping.confidence < 93).length)
    setVoiceState('applied')
    setSaved(false)
    setToast(`${applicableMappings.length} fields added — you’re still in control`)
  }

  const signIn = async (email: string) => {
    if (!supabase) {
      setLoginState('error')
      setLoginMessage('Sign-in is not configured yet.')
      return
    }

    setLoginState('sending')
    setLoginMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setLoginState('error')
      setLoginMessage(error.message)
      return
    }
    setLoginState('sent')
    setLoginMessage(`We sent a secure sign-in link to ${email.trim()}.`)
  }

  const saveDraft = async () => {
    if (!supabase) {
      setSaved(true)
      setToast('Demo draft saved on this device')
      return
    }

    if (!session) {
      setToast('Sign in before saving this certificate')
      return
    }

    setIsSaving(true)
    try {
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError

      let organizationId = membership?.organization_id
      if (!organizationId) {
        const { data: newOrganizationId, error: organizationError } = await supabase.rpc(
          'create_organization_with_owner',
          { organization_name: 'AJ Electrical' },
        )
        if (organizationError) throw organizationError
        organizationId = newOrganizationId
      }

      const { data: existingClient, error: clientLookupError } = await supabase
        .from('clients')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', values.clientName || 'Unassigned client')
        .limit(1)
        .maybeSingle()
      if (clientLookupError) throw clientLookupError

      let clientId = existingClient?.id
      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            organization_id: organizationId,
            name: values.clientName || 'Unassigned client',
            address: { address: values.clientAddress, postcode: values.clientPostcode },
          })
          .select('id')
          .single()
        if (clientError) throw clientError
        clientId = newClient.id
      }

      const { error: certificateError } = await supabase.from('certificates').upsert(
        {
          organization_id: organizationId,
          client_id: clientId,
          certificate_number: values.certificateNo || 'DRAFT',
          title: values.address ? `${values.address} electrical installation` : 'Untitled electrical installation',
          installation_address: { address: values.address, postcode: values.postcode },
          certificate_data: values,
          created_by: session.user.id,
        },
        { onConflict: 'organization_id,certificate_number' },
      )
      if (certificateError) throw certificateError

      setSaved(true)
      setToast('Draft saved securely to your FieldCert workspace')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not save the draft')
    } finally {
      setIsSaving(false)
    }
  }

  if (!authReady) return <AuthLoading />

  if (isSupabaseConfigured && !session) {
    return (
      <LoginPage
        state={loginState}
        message={loginMessage}
        onSubmit={signIn}
        onReset={() => {
          setLoginState('idle')
          setLoginMessage('')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <DesktopRail page={page} onNavigate={setPage} onVoice={() => void startVoice(false)} />

      <div className="app-stage">
        <TopBar
          page={page}
          saved={saved}
          certificateNo={values.certificateNo}
          onBack={() => setPage('home')}
          onSave={saveDraft}
          isSaving={isSaving}
        />

        {page === 'certificate' ? (
          <CertificateWorkspace
            values={values}
            completedFields={completedFields}
            voiceState={voiceState}
            onChange={updateValue}
            onStartVoice={() => void startVoice(false)}
            onRestartVoice={() => void startVoice(false)}
            onCancelVoice={cancelVoice}
            onApplyVoice={applyVoiceFields}
            onStopVoice={stopVoice}
            voiceMappings={voiceMappings}
            appliedVoiceFieldCount={appliedVoiceFieldCount}
            appliedLowConfidenceCount={appliedLowConfidenceCount}
            transcript={transcript}
            onSave={saveDraft}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />
        ) : page === 'home' ? (
          <HomePage onOpenCertificate={() => setPage('certificate')} onStartVoice={() => void startVoice(true)} />
        ) : (
          <CertificatesPage onOpenCertificate={() => setPage('certificate')} />
        )}
      </div>

      <MobileNavigation page={page} onNavigate={setPage} onVoice={() => void startVoice(true)} />

      {mobileVoiceOpen && (
        <MobileVoiceSheet
          state={voiceState}
          onClose={() => setMobileVoiceOpen(false)}
          onRestart={() => void startVoice(true)}
          onReview={stopVoice}
          voiceMappings={voiceMappings}
          appliedVoiceFieldCount={appliedVoiceFieldCount}
          appliedLowConfidenceCount={appliedLowConfidenceCount}
          transcript={transcript}
          onApply={() => {
            applyVoiceFields()
            window.setTimeout(() => setMobileVoiceOpen(false), 900)
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  )
}

function AuthLoading() {
  return (
    <main className="auth-loading" aria-label="Loading FieldCert">
      <BrandMark />
      <span className="auth-loading__pulse" />
      <p>Opening your secure workspace…</p>
    </main>
  )
}

function LoginPage({
  state,
  message,
  onSubmit,
  onReset,
}: {
  state: LoginState
  message: string
  onSubmit: (email: string) => Promise<void>
  onReset: () => void
}) {
  const [email, setEmail] = useState('')
  const isSending = state === 'sending'
  const isSent = state === 'sent'

  return (
    <main className="login-page">
      <section className="login-story" aria-label="FieldCert">
        <BrandMark />
        <div className="login-story__content">
          <span className="login-eyebrow"><Sparkles size={15} /> Voice-first certification</span>
          <h1>Finish the paperwork while you’re still on site.</h1>
          <p>Speak your inspection notes, review every matched field, and keep your certificates moving.</p>
          <div className="login-proof">
            <span><CheckCircle2 size={18} /><strong>Review before anything changes</strong></span>
            <span><ShieldCheck size={18} /><strong>Secure workspace access</strong></span>
            <span><Mic size={18} /><strong>Built for phones and tablets</strong></span>
          </div>
        </div>
        <p className="login-story__foot">Electrical certificates, without the end-of-day admin.</p>
      </section>

      <section className="login-panel">
        <div className="login-mobile-brand"><BrandMark /></div>
        <div className="login-card">
          <span className="login-lock"><LockKeyhole size={22} /></span>
          <p className="login-kicker">Secure sign in</p>
          <h2>{isSent ? 'Check your inbox' : 'Welcome back'}</h2>
          <p className="login-intro">{isSent
            ? 'Open the link on this device to return to your FieldCert workspace.'
            : 'Enter your work email. We’ll send you a secure, password-free sign-in link.'}</p>

          {isSent ? (
            <>
              <div className="login-sent" role="status">
                <Mail size={20} />
                <span><strong>Link sent</strong>{message}</span>
              </div>
              <button className="button button--soft button--full login-secondary" onClick={onReset}>Use a different email</button>
            </>
          ) : (
            <form
              className="login-form"
              onSubmit={(event) => {
                event.preventDefault()
                void onSubmit(email)
              }}
            >
              <label htmlFor="login-email">Work email</label>
              <div className="login-input">
                <Mail size={19} />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.co.uk"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isSending}
                />
              </div>
              {state === 'error' && <p className="login-error" role="alert">{message}</p>}
              <button className="button button--primary button--full login-submit" type="submit" disabled={isSending}>
                {isSending ? 'Sending secure link…' : 'Email me a sign-in link'} <ArrowRight size={17} />
              </button>
            </form>
          )}

          <p className="login-help"><ShieldCheck size={15} /> The link expires shortly and can only be used once.</p>
        </div>
      </section>
    </main>
  )
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <button className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="FieldCert home">
      <span className="brand__mark">
        <Zap size={19} strokeWidth={2.7} />
      </span>
      {!compact && <span>FieldCert</span>}
    </button>
  )
}

function DesktopRail({
  page,
  onNavigate,
  onVoice,
}: {
  page: Page
  onNavigate: (page: Page) => void
  onVoice: () => void
}) {
  return (
    <aside className="desktop-rail">
      <BrandMark />
      <nav className="rail-nav" aria-label="Primary navigation">
        <RailItem active={page === 'home'} icon={<Home size={19} />} label="Home" onClick={() => onNavigate('home')} />
        <RailItem
          active={page === 'certificates' || page === 'certificate'}
          icon={<Files size={19} />}
          label="Certificates"
          badge="3"
          onClick={() => onNavigate('certificates')}
        />
        <RailItem active={false} icon={<Building2 size={19} />} label="Clients" />
      </nav>

      <button className="rail-talk" onClick={onVoice}>
        <span className="rail-talk__icon"><Mic size={20} /></span>
        <span>
          <strong>Talk to FieldCert</strong>
          <small>Fill any section</small>
        </span>
      </button>

      <nav className="rail-nav rail-nav--bottom">
        <RailItem active={false} icon={<HelpCircle size={19} />} label="Help & feedback" />
        <RailItem active={false} icon={<Settings size={19} />} label="Settings" />
      </nav>
      <div className="rail-user">
        <span className="avatar">AJ</span>
        <span>
          <strong>Alex Jones</strong>
          <small>AJ Electrical</small>
        </span>
        <MoreHorizontal size={18} />
      </div>
    </aside>
  )
}

function RailItem({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  badge?: string
  onClick?: () => void
}) {
  return (
    <button className={`rail-item ${active ? 'is-active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {badge && <em>{badge}</em>}
    </button>
  )
}

function TopBar({
  page,
  saved,
  certificateNo,
  onBack,
  onSave,
  isSaving,
}: {
  page: Page
  saved: boolean
  certificateNo: string
  onBack: () => void
  onSave: () => void
  isSaving: boolean
}) {
  const label = page === 'certificate' ? certificateNo : page === 'home' ? 'Home' : 'Certificates'
  return (
    <header className="topbar">
      <div className="mobile-brand"><BrandMark /><button className="mobile-menu" aria-label="Open menu"><Menu size={22} /></button></div>
      <div className="topbar__trail">
        {page === 'certificate' && (
          <button className="back-button" onClick={onBack} aria-label="Back to certificates">
            <ArrowLeft size={18} />
          </button>
        )}
        <span>{page === 'certificate' ? 'Certificates' : 'Workspace'}</span>
        <ChevronRight size={14} />
        <strong>{label}</strong>
      </div>
      <div className="topbar__actions">
        {page === 'certificate' && (
          <>
            <span className={`save-state ${saved ? '' : 'save-state--pending'}`}>
              <span /> {isSaving ? 'Saving…' : saved ? 'Saved' : 'Unsaved changes'}
            </span>
            <button className="button button--soft" onClick={onSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save draft'}</button>
          </>
        )}
        {!isSupabaseConfigured && <span className="demo-state">Demo mode</span>}
        <button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button>
        <span className="top-avatar">AJ</span>
      </div>
    </header>
  )
}

function CertificateWorkspace({
  values,
  completedFields,
  voiceState,
  onChange,
  onStartVoice,
  onRestartVoice,
  onCancelVoice,
  onApplyVoice,
  onStopVoice,
  voiceMappings,
  appliedVoiceFieldCount,
  appliedLowConfidenceCount,
  transcript,
  onSave,
  activeSection,
  onSelectSection,
}: {
  values: FormValues
  completedFields: number
  voiceState: VoiceState
  onChange: (key: keyof FormValues, value: string) => void
  onStartVoice: () => void
  onRestartVoice: () => void
  onCancelVoice: () => void
  onApplyVoice: () => void
  onStopVoice: () => void
  voiceMappings: VoiceMapping[]
  appliedVoiceFieldCount: number
  appliedLowConfidenceCount: number
  transcript: string
  onSave: () => void
  activeSection: CertificateSectionId
  onSelectSection: (section: CertificateSectionId) => void
}) {
  const sectionIndex = certificateSections.findIndex((section) => section.id === activeSection)
  const activeMeta = certificateSections[sectionIndex]
  const progress = Math.max(18, Math.min(82, Math.round((completedFields / 80) * 100)))
  const nextSection = certificateSections[Math.min(sectionIndex + 1, certificateSections.length - 1)]
  const previousSection = certificateSections[Math.max(sectionIndex - 1, 0)]

  return (
    <div className="certificate-layout">
      <CertificateOutline activeSection={activeSection} onSelectSection={onSelectSection} progress={progress} />
      <main className="form-canvas">
        <div className="certificate-identity">
          <div>
            <div className="eyebrow">Electrical Installation Certificate</div>
            <h1>Willow Lane rewire</h1>
            <div className="identity-meta">
              <span><MapPin size={15} /> Birmingham</span>
              <span><Clock3 size={15} /> Edited just now</span>
            </div>
          </div>
          <div className="completion-ring" aria-label={`${progress} percent complete`}>
            <svg viewBox="0 0 42 42"><circle className="ring-bg" cx="21" cy="21" r="16" /><circle className="ring-value" cx="21" cy="21" r="16" /></svg>
            <span>{progress}%</span>
          </div>
        </div>

        <div className="mobile-progress">
          <div><span>Section {activeSection} of 10</span><strong>{progress}% complete</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <section className="form-card">
          <div className="section-heading">
            <span className="section-letter">{activeSection}</span>
            <div>
              <span className="section-kicker">Section {activeSection}</span>
              <h2>{activeMeta.title}</h2>
              <p>{activeMeta.summary}</p>
            </div>
            <span className="field-count"><Check size={14} /> Full EIC</span>
          </div>

          <div className="context-hint">
            <Sparkles size={18} />
            <span><strong>Speak naturally.</strong> FieldCert maps your site notes to the right fields, then leaves you to check every value before it is used.</span>
            <button onClick={onStartVoice}><Mic size={17} /> Start talking</button>
          </div>

          <CertificateSectionFields section={activeSection} values={values} onChange={onChange} onStartVoice={onStartVoice} />
        </section>

        <div className="form-footer">
          <button className="button button--soft" onClick={onSave}>Save & close</button>
          <div>
            <button className="button button--ghost" disabled={sectionIndex === 0} onClick={() => onSelectSection(previousSection.id)}><ChevronLeft size={17} /> Previous</button>
            <button className="button button--primary" disabled={sectionIndex === certificateSections.length - 1} onClick={() => onSelectSection(nextSection.id)}>Continue to {nextSection.title.toLowerCase()} <ArrowRight size={17} /></button>
          </div>
        </div>

        <section className="issue-card">
          <div><LockKeyhole size={18} /><span><strong>Issue controls</strong><small>Available after the checks, signing and email services are connected.</small></span></div>
          <div className="issue-card__actions">
            <button className="button button--pending" disabled><CircleAlert size={15} /> Review required</button>
            <button className="button button--pending" disabled><PenTool size={15} /> Sign certificate</button>
            <button className="button button--pending" disabled><Mail size={15} /> Email client</button>
            <button className="button button--pending" disabled><Download size={15} /> Download PDF</button>
          </div>
        </section>
      </main>

      <VoiceDock
        state={voiceState}
        onStart={onStartVoice}
        onRestart={onRestartVoice}
        onReview={onStopVoice}
        onCancel={onCancelVoice}
        onApply={onApplyVoice}
        voiceMappings={voiceMappings}
        appliedVoiceFieldCount={appliedVoiceFieldCount}
        appliedLowConfidenceCount={appliedLowConfidenceCount}
        transcript={transcript}
      />
    </div>
  )
}

function CertificateOutline({ activeSection, onSelectSection, progress }: { activeSection: CertificateSectionId; onSelectSection: (section: CertificateSectionId) => void; progress: number }) {
  return (
    <aside className="certificate-outline">
      <div className="outline-heading">
        <span>Certificate sections</span>
        <button aria-label="Collapse certificate sections"><ChevronLeft size={16} /></button>
      </div>
      <div className="outline-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="outline-progress-copy"><strong>{progress}% complete</strong><span>Full certificate</span></div>
      <nav>
        {certificateSections.map((section) => (
          <button key={section.id} onClick={() => onSelectSection(section.id)} className={`outline-item ${section.id === activeSection ? 'outline-item--current' : ''}`}>
            <span>{section.id}</span>
            <strong>{section.title}</strong>
            {section.id === activeSection && <ChevronRight size={15} />}
          </button>
        ))}
      </nav>
      <div className="outline-info">
        <ShieldCheck size={18} />
        <p><strong>BS 7671:2018+A4:2026</strong><span>Latest certificate format</span></p>
      </div>
    </aside>
  )
}

function CertificateSectionFields({ section, values, onChange, onStartVoice }: { section: CertificateSectionId; values: FormValues; onChange: (key: string, value: string) => void; onStartVoice: () => void }) {
  const input = (key: string, placeholder = '') => <TextInput value={values[key]} placeholder={placeholder} onChange={(value) => onChange(key, value)} />
  const text = (key: string, placeholder: string, compact = false) => <TextArea value={values[key]} placeholder={placeholder} onChange={(value) => onChange(key, value)} onMic={onStartVoice} compact={compact} />

  if (section === 'A') return <div className="form-grid">
    <Field label="Certificate number" className="span-half" hint="Generated automatically">{input('certificateNo')}</Field>
    <Field label="Client reference" className="span-half">{input('clientReference', 'Optional reference')}</Field>
    <Field label="Client name" className="span-full" required>{input('clientName', 'Individual or organisation')}</Field>
    <Field label="Client address" className="span-main" required>{text('clientAddress', 'Address for the certificate', true)}</Field>
    <Field label="Client postcode" className="span-side">{input('clientPostcode', 'e.g. B14 7QY')}</Field>
  </div>

  if (section === 'B') return <div className="form-grid">
    <Field label="Installation address" className="span-main" required><TextInput value={values.address} placeholder="Start typing or use voice" onChange={(value) => onChange('address', value)} icon={<MapPin size={18} />} onMic={onStartVoice} /></Field>
    <Field label="Postcode" className="span-side" required>{input('postcode', 'e.g. B14 7QY')}</Field>
    <Field label="Type of work" className="span-full" required><SegmentedControl value={values.installationType} options={['New installation', 'Addition', 'Alteration']} onChange={(value) => onChange('installationType', value)} /></Field>
    <Field label="Description of installation" className="span-full" required>{text('description', 'What was installed?')}</Field>
    <Field label="Extent covered by this certificate" className="span-full" required hint="Be specific about what is and isn't included.">{text('extent', 'e.g. Consumer unit and all final circuits')}</Field>
    <Field label="Departures from BS 7671" className="span-full" hint="Leave blank if there are no departures.">{text('departures', 'No departures recorded', true)}</Field>
  </div>

  if (section === 'C') return <div className="form-grid">
    <FormNotice text="Each person shown here certifies only the work for which they are responsible. Signing remains locked until the certificate is reviewed." />
    <Field label="BS 7671 amendment date" className="span-half" required>{input('amendmentDate')}</Field>
    <Field label="Risk assessment attached" className="span-half"><SegmentedControl value="No" options={['No', 'Yes']} onChange={() => undefined} /></Field>
    <Field label="Designer" className="span-full" required>{input('designerName')}</Field>
    <Field label="Constructor" className="span-full" required>{input('constructorName')}</Field>
    <Field label="Inspector" className="span-full" required>{input('inspectorName')}</Field>
  </div>

  if (section === 'D') return <div className="form-grid">
    <FormNotice text="This is a recommendation for further inspection and testing, not an automatic renewal date." />
    <Field label="Recommended maximum interval" className="span-half" required>{input('nextInspection', 'e.g. 5 years')}</Field>
    <Field label="Basis for recommendation" className="span-main">{text('inspectionBasis', 'Use, environment, maintenance and installation type', true)}</Field>
  </div>

  if (section === 'E') return <div className="form-grid">
    <FormNotice text="These details identify the people and organisations responsible for the statements in Section C." />
    <Field label="Designer — for/on behalf of" className="span-half" required>{input('designerCompany')}</Field>
    <Field label="Constructor — for/on behalf of" className="span-half" required>{input('constructorCompany')}</Field>
    <Field label="Inspector — for/on behalf of" className="span-full" required>{input('inspectorCompany')}</Field>
    <Field label="Business address" className="span-main" required>{text('signatoryAddress', 'Business address', true)}</Field>
    <Field label="Postcode" className="span-side" required>{input('signatoryPostcode')}</Field>
    <Field label="Telephone" className="span-half">{input('signatoryPhone')}</Field>
    <Field label="Registration / scheme number" className="span-half">{input('schemeNumber', 'Optional')}</Field>
  </div>

  if (section === 'F') return <div className="form-grid">
    <FormNotice text="Capture measured values from the site. FieldCert will flag missing test data before an issue can be signed." />
    <Field label="Earthing arrangement" className="span-half" required><SegmentedControl value={values.earthingArrangement} options={['TN-C-S (PME)', 'TN-S', 'TT']} onChange={(value) => onChange('earthingArrangement', value)} /></Field>
    <Field label="Supply conductors" className="span-half" required><SegmentedControl value={values.supplyPhase} options={['1-phase, 2-wire', '3-phase, 4-wire']} onChange={(value) => onChange('supplyPhase', value)} /></Field>
    <Field label="Nominal voltage (V)" className="span-half" required>{input('nominalVoltage', '230')}</Field>
    <Field label="Nominal frequency (Hz)" className="span-half" required>{input('nominalFrequency', '50')}</Field>
    <Field label="Prospective fault current Ipf (kA)" className="span-half">{input('prospectiveFaultCurrent', 'Measure or by enquiry')}</Field>
    <Field label="External earth fault loop impedance Ze (Ω)" className="span-half">{input('externalLoopImpedance', 'Measure or by enquiry')}</Field>
    <Field label="Main switch type" className="span-main">{input('mainSwitchType')}</Field>
    <Field label="Main switch rating (A)" className="span-side">{input('mainSwitchRating')}</Field>
    <Field label="Earthing conductor csa (mm²)" className="span-half">{input('earthingConductor')}</Field>
    <Field label="Main bonding csa (mm²)" className="span-half">{input('bondingConductor')}</Field>
  </div>

  if (section === 'G') return <div className="form-grid">
    <Field label="Maximum demand" className="span-half" required>{input('maxDemand', 'A or kVA')}</Field>
    <Field label="Distribution board / consumer unit reference" className="span-half" required>{input('distributionBoard')}</Field>
    <Field label="Distribution board location" className="span-full" required>{input('boardLocation')}</Field>
    <Field label="Main protective measures" className="span-full">{text('protectiveMeasures', 'Automatic disconnection, additional protection, isolation and switching', true)}</Field>
    <Field label="Other sources of supply" className="span-full">{text('otherSupply', 'PV, battery, generator, EV or none', true)}</Field>
  </div>

  if (section === 'H') return <InspectionSchedule />

  if (section === 'I') return <div className="form-grid">
    <FormNotice text="For additions or alterations, record any observations on the existing installation relevant to the safety of the new work." />
    <Field label="Comments on the existing installation" className="span-full">{text('existingComments', 'No comments recorded')}</Field>
    <Field label="Supporting continuation sheet" className="span-full"><PendingInline text="Attach photos and continuation sheets — coming soon" /></Field>
  </div>

  return <CircuitSchedules values={values} onChange={onChange} />
}

function FormNotice({ text }: { text: string }) {
  return <div className="form-notice span-full"><ShieldCheck size={17} /> <span>{text}</span></div>
}

function PendingInline({ text }: { text: string }) {
  return <span className="pending-inline"><LockKeyhole size={15} /> {text}</span>
}

function InspectionSchedule() {
  const items = ['Supply characteristics and earthing arrangements', 'Basic protection and automatic disconnection', 'Additional protection and RCD provision', 'Distribution equipment and circuit identification', 'Isolation, switching and functional checks', 'Current-using equipment and special locations']
  return <div className="inspection-list span-full">
    <FormNotice text="Work through the schedule at site. Detailed outcomes will be required before the certificate can be issued." />
    {items.map((item, index) => <div className="inspection-row" key={item}><span>{index + 1}.0</span><strong>{item}</strong><button className="inspection-outcome is-pending" disabled>Not checked</button></div>)}
  </div>
}

function CircuitSchedules({ values, onChange }: { values: FormValues; onChange: (key: string, value: string) => void }) {
  return <div className="schedule-wrap span-full">
    <FormNotice text="Add each circuit and its test result. More rows, board schedules and continuation sheets will be enabled with the data backend." />
    <div className="schedule-header"><div><span>Distribution board</span><strong>{values.distributionBoard || 'CU-01'}</strong></div><div><span>Location</span><strong>{values.boardLocation || 'Hallway cupboard'}</strong></div><button className="button button--pending" disabled><Plus size={15} /> Add circuit</button></div>
    <div className="circuit-table">
      <div className="circuit-table__head"><span>Circuit</span><span>Description</span><span>OCPD A</span><span>RCD mA</span><span>Measured Zs Ω</span></div>
      {[1, 2].map((number) => <div className="circuit-table__row" key={number}>
        <strong>{number}</strong>
        <input value={values[`circuit${number}Description`]} onChange={(event) => onChange(`circuit${number}Description`, event.target.value)} />
        <input value={values[`circuit${number}Ocpd`]} onChange={(event) => onChange(`circuit${number}Ocpd`, event.target.value)} />
        <input value={values[`circuit${number}Rcd`]} onChange={(event) => onChange(`circuit${number}Rcd`, event.target.value)} />
        <input value={values[`circuit${number}Zs`]} placeholder="Enter result" onChange={(event) => onChange(`circuit${number}Zs`, event.target.value)} />
      </div>)}
    </div>
    <div className="schedule-footer"><CircleAlert size={16} /><span><strong>Test results incomplete.</strong> Measured Zs values are still required for the circuits shown.</span></div>
  </div>
}

function Field({
  label,
  children,
  className = '',
  required,
  hint,
  status,
}: {
  label: string
  children: React.ReactNode
  className?: string
  required?: boolean
  hint?: string
  status?: string
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">
        {label} {required && <em>Required</em>}
        {status && <small><Check size={12} /> {status}</small>}
      </span>
      {children}
      {hint && <span className="field__hint"><Info size={13} /> {hint}</span>}
    </label>
  )
}

function TextInput({
  value,
  placeholder,
  onChange,
  icon,
  onMic,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  icon?: React.ReactNode
  onMic?: () => void
}) {
  return (
    <span className={`input-wrap ${icon ? 'input-wrap--icon' : ''} ${value ? 'has-value' : ''}`}>
      {icon && <span className="input-leading">{icon}</span>}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {onMic && <button type="button" className="field-mic" onClick={onMic} aria-label="Fill this field by voice"><Mic size={17} /></button>}
    </span>
  )
}

function TextArea({
  value,
  placeholder,
  onChange,
  onMic,
  compact,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onMic: () => void
  compact?: boolean
}) {
  return (
    <span className={`textarea-wrap ${compact ? 'textarea-wrap--compact' : ''} ${value ? 'has-value' : ''}`}>
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="field-mic" onClick={onMic} aria-label="Fill this field by voice"><Mic size={17} /></button>
    </span>
  )
}

function SegmentedControl({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <span className="segmented-control">
      {options.map((option) => (
        <button type="button" className={value === option ? 'is-selected' : ''} key={option} onClick={() => onChange(option)}>
          <span>{value === option && <Check size={13} />}</span>{option}
        </button>
      ))}
    </span>
  )
}

function VoiceDock({
  state,
  onStart,
  onRestart,
  onReview,
  onCancel,
  onApply,
  voiceMappings,
  appliedVoiceFieldCount,
  appliedLowConfidenceCount,
  transcript,
}: {
  state: VoiceState
  onStart: () => void
  onRestart: () => void
  onReview: () => void
  onCancel: () => void
  onApply: () => void
  voiceMappings: VoiceMapping[]
  appliedVoiceFieldCount: number
  appliedLowConfidenceCount: number
  transcript: string
}) {
  return (
    <aside className={`voice-dock voice-dock--${state}`}>
      {state === 'idle' && <VoiceIdle onStart={onStart} />}
      {state === 'listening' && <VoiceListening onCancel={onCancel} onReview={onReview} />}
      {state === 'review' && <VoiceReview onRestart={onRestart} onApply={onApply} mappings={voiceMappings} transcript={transcript} compact />}
      {state === 'applied' && <VoiceApplied onStart={onStart} fieldCount={appliedVoiceFieldCount} reviewCount={appliedLowConfidenceCount} />}
    </aside>
  )
}

function VoiceIdle({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="voice-dock__top"><span><Sparkles size={16} /> Voice assistant</span><button><MoreHorizontal size={18} /></button></div>
      <div className="voice-idle">
        <button className="voice-orb" onClick={onStart} aria-label="Start voice capture">
          <span className="voice-orb__ring" />
          <Mic size={29} />
        </button>
        <h3>Tell me what you’ve done</h3>
        <p>Speak naturally. I’ll find the right fields across the whole certificate.</p>
        <button className="button button--voice" onClick={onStart}><Mic size={18} /> Start talking</button>
      </div>
      <div className="voice-tips">
        <span>Try saying</span>
        <button onClick={onStart}>“New consumer unit at…”</button>
        <button onClick={onStart}>“Supply is TN-C-S…”</button>
        <button onClick={onStart}>“Kitchen ring tests…”</button>
      </div>
      <div className="voice-privacy"><ShieldCheck size={15} /><span>Audio is only processed while you speak.</span></div>
    </>
  )
}

function VoiceListening({ onCancel, onReview }: { onCancel: () => void; onReview: () => void }) {
  return (
    <>
      <div className="voice-dock__top"><span className="live-label"><i /> Listening</span><button onClick={onCancel}><X size={18} /></button></div>
      <div className="listening-content">
        <div className="listening-orb"><Mic size={27} /></div>
        <Waveform />
        <p>“This is a new installation at 24 Willow Lane, Birmingham…”</p>
        <span>Speak at your normal pace</span>
        <button className="stop-button" onClick={onReview}><span /> Stop & review</button>
      </div>
    </>
  )
}

function Waveform() {
  const bars = [9, 17, 24, 13, 32, 19, 38, 23, 29, 15, 35, 19, 27, 12, 22, 9]
  return <div className="waveform" aria-hidden="true">{bars.map((height, index) => <i key={index} style={{ height }} />)}</div>
}

function VoiceReview({ onRestart, onApply, mappings, transcript, compact = false }: { onRestart: () => void; onApply: () => void; mappings: VoiceMapping[]; transcript: string; compact?: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false)
  return (
    <>
      <div className="voice-dock__top">
        <span><Sparkles size={16} /> {mappings.length} fields found</span>
        <button onClick={onRestart} aria-label="Record again"><RotateCcw size={17} /></button>
      </div>
      <div className="review-summary">
        <div className="review-summary__icon"><CheckCircle2 size={22} /></div>
        <div><h3>Ready for your review</h3><p>Nothing changes until you apply it.</p></div>
      </div>
      <button className="transcript-toggle" onClick={() => setShowTranscript((current) => !current)}>
        <Volume2 size={16} /> View transcript <ChevronDown className={showTranscript ? 'rotate' : ''} size={16} />
      </button>
      {showTranscript && <p className="transcript">{transcript}</p>}
      <div className={`mapping-list ${compact ? 'mapping-list--compact' : ''}`}>
        {mappings.map((mapping) => (
          <div className="mapping-row" key={mapping.label}>
            <div><span>{mapping.label}</span><strong>{mapping.value}</strong></div>
            <span className={`confidence ${mapping.confidence < 93 ? 'confidence--check' : ''}`}>{mapping.confidence < 93 ? 'Check' : `${mapping.confidence}%`}</span>
            <button aria-label={`Edit ${mapping.label}`}><Pencil size={14} /></button>
          </div>
        ))}
      </div>
      <div className="review-actions">
        <button className="button button--primary button--full" onClick={onApply} disabled={!mappings.length}>Apply {mappings.length} fields <ArrowRight size={17} /></button>
        <button className="button button--ghost button--full" onClick={onRestart}><Mic size={16} /> Record again</button>
      </div>
    </>
  )
}

function VoiceApplied({ onStart, fieldCount, reviewCount }: { onStart: () => void; fieldCount: number; reviewCount: number }) {
  return (
    <div className="applied-state">
      <div className="applied-check"><Check size={28} /></div>
      <span>Details added</span>
      <h3>{fieldCount} {fieldCount === 1 ? 'field' : 'fields'} updated</h3>
      <p>{reviewCount
        ? `${reviewCount} lower-confidence ${reviewCount === 1 ? 'field is' : 'fields are'} marked for review before signing.`
        : 'All applied fields met the confidence threshold.'}</p>
      <button className="button button--voice" onClick={onStart}><Mic size={17} /> Add more by voice</button>
    </div>
  )
}

function MobileVoiceSheet({
  state,
  onClose,
  onRestart,
  onReview,
  onApply,
  voiceMappings,
  appliedVoiceFieldCount,
  appliedLowConfidenceCount,
  transcript,
}: {
  state: VoiceState
  onClose: () => void
  onRestart: () => void
  onReview: () => void
  onApply: () => void
  voiceMappings: VoiceMapping[]
  appliedVoiceFieldCount: number
  appliedLowConfidenceCount: number
  transcript: string
}) {
  return (
    <div className="voice-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Voice assistant">
      <div className={`mobile-voice-sheet mobile-voice-sheet--${state}`}>
        <button className="sheet-close" onClick={onClose} aria-label="Close voice assistant"><X size={20} /></button>
        {state === 'listening' && (
          <div className="mobile-listening">
            <span className="listening-label"><i /> Listening</span>
            <div className="mobile-listening__orb"><Mic size={34} /></div>
            <Waveform />
            <h2>Keep talking…</h2>
            <p>“This is a new installation at 24 Willow Lane, Birmingham…”</p>
            <span className="mobile-listening__hint">Speak naturally. Pause when you need to.</span>
            <button className="mobile-stop" onClick={onReview}><span /> Stop & review</button>
          </div>
        )}
        {state === 'review' && <div className="mobile-review"><VoiceReview onRestart={onRestart} onApply={onApply} mappings={voiceMappings} transcript={transcript} /></div>}
        {state === 'applied' && <VoiceApplied onStart={onRestart} fieldCount={appliedVoiceFieldCount} reviewCount={appliedLowConfidenceCount} />}
        {state === 'idle' && <VoiceIdle onStart={onRestart} />}
      </div>
    </div>
  )
}

function HomePage({ onOpenCertificate, onStartVoice }: { onOpenCertificate: () => void; onStartVoice: () => void }) {
  return (
    <main className="dashboard page-content">
      <div className="dashboard-heading">
        <div><span className="eyebrow">Thursday, 23 July</span><h1>Good morning, Alex</h1><p>Let’s get today’s paperwork out of the way.</p></div>
        <button className="button button--primary" onClick={onOpenCertificate}><Plus size={18} /> New certificate</button>
      </div>
      <button className="speak-banner" onClick={onStartVoice}>
        <span className="speak-banner__orb"><Mic size={25} /></span>
        <span><small>Fastest way to fill a certificate</small><strong>Tell FieldCert what you did on site</strong><em>Tap and speak naturally — we’ll sort the details.</em></span>
        <ArrowRight size={21} />
      </button>
      <div className="dashboard-grid">
        <section className="dashboard-main-card">
          <div className="card-title"><div><h2>Continue where you left off</h2><p>Your recent certificates</p></div><button>View all <ArrowRight size={15} /></button></div>
          <button className="job-card" onClick={onOpenCertificate}>
            <span className="job-icon"><FileCheck2 size={22} /></span>
            <span className="job-copy"><small>Electrical Installation Certificate</small><strong>Willow Lane rewire</strong><em><MapPin size={14} /> Birmingham · Edited 2 min ago</em></span>
            <span className="job-progress"><strong>18%</strong><i><b style={{ width: '18%' }} /></i><small>Section B</small></span>
            <ChevronRight size={18} />
          </button>
          <button className="job-card">
            <span className="job-icon job-icon--amber"><ClipboardCheck size={22} /></span>
            <span className="job-copy"><small>Minor Works Certificate</small><strong>Oakfield Road kitchen</strong><em><MapPin size={14} /> Solihull · Yesterday</em></span>
            <span className="job-progress"><strong>72%</strong><i><b style={{ width: '72%' }} /></i><small>Testing</small></span>
            <ChevronRight size={18} />
          </button>
        </section>
        <section className="dashboard-side-card">
          <div className="card-title"><div><h2>This week</h2><p>Your certification activity</p></div><button><MoreHorizontal size={18} /></button></div>
          <div className="activity-stat"><span><FileCheck2 size={19} /></span><div><strong>7</strong><small>Certificates</small></div><em>+2</em></div>
          <div className="activity-stat"><span><Clock3 size={19} /></span><div><strong>2h 14m</strong><small>Paperwork saved</small></div><em>↑ 18%</em></div>
          <div className="insight"><Lightbulb size={18} /><p><strong>Voice is saving you time</strong><span>You fill certificates 34% faster when you use voice.</span></p></div>
        </section>
      </div>
      <section className="quick-start">
        <div className="card-title"><div><h2>Start a certificate</h2><p>Choose the work you’ve completed</p></div></div>
        <div className="certificate-types">
          <button onClick={onOpenCertificate}><span><FilePlus2 /></span><strong>Electrical Installation</strong><small>New installations & rewires</small><ArrowRight size={16} /></button>
          <button><span><Zap /></span><strong>Minor Works</strong><small>Additions & alterations</small><ArrowRight size={16} /></button>
          <button><span><ClipboardCheck /></span><strong>Condition Report</strong><small>Periodic inspection & testing</small><ArrowRight size={16} /></button>
        </div>
      </section>
    </main>
  )
}

function CertificatesPage({ onOpenCertificate }: { onOpenCertificate: () => void }) {
  return (
    <main className="certificates-page page-content">
      <div className="dashboard-heading"><div><span className="eyebrow">Your work</span><h1>Certificates</h1><p>Drafts, completed certificates and reports in one place.</p></div><button className="button button--primary" onClick={onOpenCertificate}><Plus size={18} /> New certificate</button></div>
      <div className="certificate-toolbar"><div className="search-box"><Search size={18} /><input placeholder="Search certificates or clients" /></div><button className="filter-button">All statuses <ChevronDown size={16} /></button><button className="filter-button">Newest first <ChevronDown size={16} /></button></div>
      <section className="certificate-table">
        <div className="certificate-row certificate-row--head"><span>Certificate</span><span>Client</span><span>Status</span><span>Updated</span><span /></div>
        <button className="certificate-row" onClick={onOpenCertificate}><span><i className="table-icon"><FileCheck2 size={18} /></i><b>Willow Lane rewire</b><small>EIC-2026-0042</small></span><span><b>Maya Patel</b><small>Birmingham</small></span><span><em className="status-pill status-pill--draft">Draft · 18%</em></span><span><b>Just now</b><small>Alex Jones</small></span><ChevronRight size={17} /></button>
        <button className="certificate-row"><span><i className="table-icon table-icon--amber"><Zap size={18} /></i><b>Oakfield Road kitchen</b><small>MWC-2026-0039</small></span><span><b>Sam Wilson</b><small>Solihull</small></span><span><em className="status-pill status-pill--draft">Draft · 72%</em></span><span><b>Yesterday</b><small>Alex Jones</small></span><ChevronRight size={17} /></button>
        <button className="certificate-row"><span><i className="table-icon table-icon--green"><ClipboardCheck size={18} /></i><b>Harborne annual inspection</b><small>EICR-2026-0037</small></span><span><b>Greenway Lettings</b><small>Harborne</small></span><span><em className="status-pill status-pill--done">Completed</em></span><span><b>20 Jul 2026</b><small>Alex Jones</small></span><ChevronRight size={17} /></button>
      </section>
    </main>
  )
}

function MobileNavigation({ page, onNavigate, onVoice }: { page: Page; onNavigate: (page: Page) => void; onVoice: () => void }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <button className={page === 'home' ? 'is-active' : ''} onClick={() => onNavigate('home')}><Home size={20} /><span>Home</span></button>
      <button className={page === 'certificates' || page === 'certificate' ? 'is-active' : ''} onClick={() => onNavigate('certificates')}><Files size={20} /><span>Certificates</span></button>
      <button className="mobile-talk" onClick={onVoice}><span><Mic size={25} /></span><em>Talk</em></button>
      <button><LayoutGrid size={20} /><span>Clients</span></button>
      <button><UserRound size={20} /><span>Account</span></button>
    </nav>
  )
}

export default App
