import { Step } from '../types'

interface Props {
  step: Step
  audioReady: boolean
  onNav: (s: Step) => void
}

const NAV = [
  { id: 'upload'     as Step, icon: IconCreate,      label: 'Import'     },
  { id: 'layout'     as Step, icon: IconProjects,    label: 'Layout'     },
  { id: 'transcript' as Step, icon: IconTranscript,  label: 'Transcript' },
  { id: 'export'     as Step, icon: IconExport,      label: 'Export'     },
]

export default function Sidebar({ step, audioReady, onNav }: Props) {
  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: '#fff',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, background: '#6C4FF6', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WaveIcon />
        </div>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#111827', letterSpacing: '-0.3px' }}>
          audiogram
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 12px 0' }}>
        {NAV.map(({ id, icon: Icon, label }) => {
          const active = step === id
          const enabled = id === 'upload' || audioReady
          return (
            <button
              key={id}
              onClick={() => enabled && onNav(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px',
                borderRadius: 8, marginBottom: 2,
                border: 'none', cursor: enabled ? 'pointer' : 'default',
                background: active ? '#EDE9FF' : 'transparent',
                color: active ? '#6C4FF6' : enabled ? '#6B7280' : '#D1D5DB',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
                position: 'relative',
                opacity: enabled ? 1 : 0.5,
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 20, background: '#6C4FF6', borderRadius: '0 2px 2px 0',
                }} />
              )}
              <Icon active={active} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Bottom user */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16,
          background: '#EDE9FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, color: '#6C4FF6',
        }}>T</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Thanh</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Free plan</div>
        </div>
      </div>
    </aside>
  )
}

function WaveIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <path d="M1 7h2l2-5 3 10 3-10 2 5h2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCreate({ active }: { active: boolean }) {
  const c = active ? '#6C4FF6' : '#9CA3AF'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <path d="M12 9v6M9 12h6" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

function IconProjects({ active }: { active: boolean }) {
  const c = active ? '#6C4FF6' : '#9CA3AF'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h4M2 8h8M2 12h6" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.4"/>
      <path d="M11 12h2M12 11v2" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconTranscript({ active }: { active: boolean }) {
  const c = active ? '#6C4FF6' : '#9CA3AF'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1v6.5M5.5 5 8 7.5 10.5 5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1.5" y="9" width="13" height="2.5" rx="1" stroke={c} strokeWidth="1.3"/>
      <path d="M3.5 13.5h5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function IconExport({ active }: { active: boolean }) {
  const c = active ? '#6C4FF6' : '#9CA3AF'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M5 5l3-3 3 3" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
