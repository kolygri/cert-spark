import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
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
} from 'lucide-react'

type Page = 'home' | 'certificate' | 'certificates'
type VoiceState = 'idle' | 'listening' | 'review' | 'applied'

type FormValues = {
  clientName: string
  certificateNo: string
  address: string
  postcode: string
  installationType: string
  description: string
  extent: string
  departures: string
}

const initialValues: FormValues = {
  clientName: 'Maya Patel',
  certificateNo: 'EIC-2026-0042',
  address: '',
  postcode: '',
  installationType: 'New installation',
  description: '',
  extent: '',
  departures: '',
}

const voiceMappings = [
  { label: 'Installation address', value: '24 Willow Lane, Birmingham', confidence: 98 },
  { label: 'Postcode', value: 'B14 7QY', confidence: 98 },
  { label: 'Work type', value: 'New installation', confidence: 96 },
  { label: 'Description', value: 'New consumer unit and kitchen circuits', confidence: 94 },
  { label: 'Extent covered', value: 'Consumer unit, kitchen ring and lighting', confidence: 91 },
  { label: 'Earthing arrangement', value: 'TN-C-S (PME)', confidence: 97 },
  { label: 'Nominal voltage', value: '230 V', confidence: 99 },
  { label: 'Next inspection', value: '5 years', confidence: 92 },
]

const certificateSections = [
  { id: 'A', title: 'Client details', status: 'complete' },
  { id: 'B', title: 'Installation details', status: 'current' },
  { id: 'C', title: 'Certification', status: 'empty' },
  { id: 'D', title: 'Next inspection', status: 'empty' },
  { id: 'E', title: 'Signatories', status: 'empty' },
  { id: 'F', title: 'Supply & earthing', status: 'empty' },
  { id: 'G', title: 'Installation', status: 'empty' },
  { id: 'H', title: 'Inspections', status: 'empty' },
  { id: 'I', title: 'Comments', status: 'empty' },
  { id: 'J', title: 'Schedules', status: 'empty' },
]

const transcript =
  "This is a new installation at 24 Willow Lane, Birmingham, postcode B14 7QY. We've fitted a new consumer unit, a kitchen ring and new lighting circuits. The supply is TN-C-S, 230 volts. Certificate covers the consumer unit, kitchen ring and lighting only. Recommend the next inspection in five years."

function App() {
  const [page, setPage] = useState<Page>('certificate')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [mobileVoiceOpen, setMobileVoiceOpen] = useState(false)
  const [values, setValues] = useState<FormValues>(initialValues)
  const [saved, setSaved] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (voiceState !== 'listening') return
    const timer = window.setTimeout(() => setVoiceState('review'), 2400)
    return () => window.clearTimeout(timer)
  }, [voiceState])

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

  const startVoice = (mobile = false) => {
    setVoiceState('listening')
    if (mobile) setMobileVoiceOpen(true)
  }

  const applyVoiceFields = () => {
    setValues((current) => ({
      ...current,
      address: '24 Willow Lane, Birmingham',
      postcode: 'B14 7QY',
      installationType: 'New installation',
      description: 'New consumer unit and kitchen circuits',
      extent: 'Consumer unit, kitchen ring and lighting',
    }))
    setVoiceState('applied')
    setSaved(false)
    setToast('8 fields added — you’re still in control')
  }

  const saveDraft = () => {
    setSaved(true)
    setToast('Draft saved on this device')
  }

  return (
    <div className="app-shell">
      <DesktopRail page={page} onNavigate={setPage} onVoice={() => startVoice(false)} />

      <div className="app-stage">
        <TopBar
          page={page}
          saved={saved}
          certificateNo={values.certificateNo}
          onBack={() => setPage('home')}
          onSave={saveDraft}
        />

        {page === 'certificate' ? (
          <CertificateWorkspace
            values={values}
            completedFields={completedFields}
            voiceState={voiceState}
            onChange={updateValue}
            onStartVoice={() => startVoice(false)}
            onSetVoiceState={setVoiceState}
            onApplyVoice={applyVoiceFields}
            onSave={saveDraft}
          />
        ) : page === 'home' ? (
          <HomePage onOpenCertificate={() => setPage('certificate')} onStartVoice={() => startVoice(true)} />
        ) : (
          <CertificatesPage onOpenCertificate={() => setPage('certificate')} />
        )}
      </div>

      <MobileNavigation page={page} onNavigate={setPage} onVoice={() => startVoice(true)} />

      {mobileVoiceOpen && (
        <MobileVoiceSheet
          state={voiceState}
          onClose={() => setMobileVoiceOpen(false)}
          onRestart={() => setVoiceState('listening')}
          onReview={() => setVoiceState('review')}
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
}: {
  page: Page
  saved: boolean
  certificateNo: string
  onBack: () => void
  onSave: () => void
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
              <span /> {saved ? 'Saved' : 'Unsaved changes'}
            </span>
            <button className="button button--soft" onClick={onSave}>Save draft</button>
          </>
        )}
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
  onSetVoiceState,
  onApplyVoice,
  onSave,
}: {
  values: FormValues
  completedFields: number
  voiceState: VoiceState
  onChange: (key: keyof FormValues, value: string) => void
  onStartVoice: () => void
  onSetVoiceState: (state: VoiceState) => void
  onApplyVoice: () => void
  onSave: () => void
}) {
  return (
    <div className="certificate-layout">
      <CertificateOutline />
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
          <div className="completion-ring" aria-label="18 percent complete">
            <svg viewBox="0 0 42 42"><circle className="ring-bg" cx="21" cy="21" r="16" /><circle className="ring-value" cx="21" cy="21" r="16" /></svg>
            <span>18%</span>
          </div>
        </div>

        <div className="mobile-progress">
          <div><span>Section B of 10</span><strong>18% complete</strong></div>
          <div className="progress-track"><span style={{ width: '18%' }} /></div>
        </div>

        <section className="form-card">
          <div className="section-heading">
            <span className="section-letter">B</span>
            <div>
              <span className="section-kicker">Section B</span>
              <h2>Installation details</h2>
              <p>Describe the installation and exactly what this certificate covers.</p>
            </div>
            <span className="field-count"><Check size={14} /> {completedFields}/8 fields</span>
          </div>

          <div className="context-hint">
            <Sparkles size={18} />
            <span><strong>Speak naturally.</strong> Say the address, what you installed and the extent covered — FieldCert will place each detail for you.</span>
            <button onClick={onStartVoice}><Mic size={17} /> Start talking</button>
          </div>

          <div className="form-grid">
            <Field label="Certificate number" className="span-half" hint="Generated automatically">
              <TextInput value={values.certificateNo} onChange={(value) => onChange('certificateNo', value)} />
            </Field>
            <Field label="Client" className="span-half" status="from client details">
              <TextInput value={values.clientName} onChange={(value) => onChange('clientName', value)} />
            </Field>
            <Field label="Installation address" className="span-main" required>
              <TextInput
                value={values.address}
                placeholder="Start typing or use voice"
                onChange={(value) => onChange('address', value)}
                icon={<MapPin size={18} />}
                onMic={onStartVoice}
              />
            </Field>
            <Field label="Postcode" className="span-side" required>
              <TextInput value={values.postcode} placeholder="e.g. B14 7QY" onChange={(value) => onChange('postcode', value)} />
            </Field>
            <Field label="Type of work" className="span-full" required>
              <SegmentedControl
                value={values.installationType}
                options={['New installation', 'Addition', 'Alteration']}
                onChange={(value) => onChange('installationType', value)}
              />
            </Field>
            <Field label="Description of installation" className="span-full" required>
              <TextArea
                value={values.description}
                placeholder="What was installed?"
                onChange={(value) => onChange('description', value)}
                onMic={onStartVoice}
              />
            </Field>
            <Field label="Extent of installation covered by this certificate" className="span-full" required hint="Be specific about what is and isn't included.">
              <TextArea
                value={values.extent}
                placeholder="e.g. Consumer unit and all final circuits"
                onChange={(value) => onChange('extent', value)}
                onMic={onStartVoice}
              />
            </Field>
            <Field label="Departures from BS 7671" className="span-full" hint="Leave blank if there are no departures.">
              <TextArea
                value={values.departures}
                placeholder="No departures recorded"
                onChange={(value) => onChange('departures', value)}
                onMic={onStartVoice}
                compact
              />
            </Field>
          </div>
        </section>

        <div className="form-footer">
          <button className="button button--soft" onClick={onSave}>Save & close</button>
          <div>
            <button className="button button--ghost"><ChevronLeft size={17} /> Previous</button>
            <button className="button button--primary">Continue to certification <ArrowRight size={17} /></button>
          </div>
        </div>
      </main>

      <VoiceDock
        state={voiceState}
        onStart={onStartVoice}
        onRestart={() => onSetVoiceState('listening')}
        onReview={() => onSetVoiceState('review')}
        onCancel={() => onSetVoiceState('idle')}
        onApply={onApplyVoice}
      />
    </div>
  )
}

function CertificateOutline() {
  return (
    <aside className="certificate-outline">
      <div className="outline-heading">
        <span>Certificate sections</span>
        <button aria-label="Collapse certificate sections"><ChevronLeft size={16} /></button>
      </div>
      <div className="outline-progress"><span style={{ width: '18%' }} /></div>
      <div className="outline-progress-copy"><strong>18% complete</strong><span>1 of 10 sections</span></div>
      <nav>
        {certificateSections.map((section) => (
          <button key={section.id} className={`outline-item outline-item--${section.status}`}>
            <span>{section.status === 'complete' ? <Check size={14} /> : section.id}</span>
            <strong>{section.title}</strong>
            {section.status === 'current' && <ChevronRight size={15} />}
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
}: {
  state: VoiceState
  onStart: () => void
  onRestart: () => void
  onReview: () => void
  onCancel: () => void
  onApply: () => void
}) {
  return (
    <aside className={`voice-dock voice-dock--${state}`}>
      {state === 'idle' && <VoiceIdle onStart={onStart} />}
      {state === 'listening' && <VoiceListening onCancel={onCancel} onReview={onReview} />}
      {state === 'review' && <VoiceReview onRestart={onRestart} onApply={onApply} compact />}
      {state === 'applied' && <VoiceApplied onStart={onStart} />}
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

function VoiceReview({ onRestart, onApply, compact = false }: { onRestart: () => void; onApply: () => void; compact?: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false)
  return (
    <>
      <div className="voice-dock__top">
        <span><Sparkles size={16} /> {voiceMappings.length} fields found</span>
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
        {voiceMappings.map((mapping) => (
          <div className="mapping-row" key={mapping.label}>
            <div><span>{mapping.label}</span><strong>{mapping.value}</strong></div>
            <span className={`confidence ${mapping.confidence < 93 ? 'confidence--check' : ''}`}>{mapping.confidence < 93 ? 'Check' : `${mapping.confidence}%`}</span>
            <button aria-label={`Edit ${mapping.label}`}><Pencil size={14} /></button>
          </div>
        ))}
      </div>
      <div className="review-actions">
        <button className="button button--primary button--full" onClick={onApply}>Apply {voiceMappings.length} fields <ArrowRight size={17} /></button>
        <button className="button button--ghost button--full" onClick={onRestart}><Mic size={16} /> Record again</button>
      </div>
    </>
  )
}

function VoiceApplied({ onStart }: { onStart: () => void }) {
  return (
    <div className="applied-state">
      <div className="applied-check"><Check size={28} /></div>
      <span>Details added</span>
      <h3>8 fields updated</h3>
      <p>Two lower-confidence fields are marked for review before signing.</p>
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
}: {
  state: VoiceState
  onClose: () => void
  onRestart: () => void
  onReview: () => void
  onApply: () => void
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
        {state === 'review' && <div className="mobile-review"><VoiceReview onRestart={onRestart} onApply={onApply} /></div>}
        {state === 'applied' && <VoiceApplied onStart={onRestart} />}
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
