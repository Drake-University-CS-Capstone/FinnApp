import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FINANCE_T as T } from '../../theme/financeTheme';
import { useFinanceSession } from '../../finance/FinanceSessionContext';

// Reusable page shell that every finance page uses so titles, descriptions,
// and standard actions (sync, switch bank) are positioned and styled the
// same way. Keeps pages short and prevents drift between screens.
export function SyncExtendedButton({ small = false }) {
  const { extendedSyncing, handleSyncExtended } = useFinanceSession();
  return (
    <button
      type="button"
      onClick={() => handleSyncExtended()}
      disabled={extendedSyncing}
      style={{
        padding: small ? '0.25rem 0.7rem' : '0.35rem 0.85rem',
        borderRadius: T.radius.pill,
        fontSize: small ? T.font.xs : '0.75rem',
        fontWeight: 500,
        border: `1px solid ${T.accentBord}`,
        background: 'transparent',
        color: extendedSyncing ? T.muted : T.accent,
        cursor: extendedSyncing ? 'not-allowed' : 'pointer',
        fontFamily: T.sans,
        opacity: extendedSyncing ? 0.55 : 1,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!extendedSyncing) e.currentTarget.style.background = T.accentBg; }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {extendedSyncing ? 'Syncing…' : 'Sync extended'}
    </button>
  );
}

export function SwitchBankButton() {
  const navigate = useNavigate();
  const { handleBackToBanks } = useFinanceSession();
  const onClick = () => {
    handleBackToBanks();
    navigate('/home', { replace: true });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${T.border}`,
        color: T.muted,
        padding: '0.35rem 0.75rem',
        borderRadius: T.radius.sm,
        fontSize: '0.78rem',
        fontWeight: 500,
        fontFamily: T.sans,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHov; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
    >
      Switch bank
    </button>
  );
}

export default function PageScaffold({
  title,
  eyebrow,
  description,
  maxWidth = 1180,
  actions = null,
  showSync = false,
  showSwitchBank = true,
  children,
}) {
  return (
    <div style={{ maxWidth, margin: '0 auto', width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.9rem',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        marginBottom: '1.1rem',
      }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          {eyebrow && (
            <div style={{
              fontSize: T.font.micro, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: T.accent, marginBottom: '0.3rem',
            }}>
              {eyebrow}
            </div>
          )}
          <h1 style={{
            margin: 0, fontFamily: T.display, fontSize: T.font.xl,
            letterSpacing: '-0.015em', lineHeight: 1.1,
          }}>
            {title}
          </h1>
          {description && (
            <p style={{
              margin: '0.45rem 0 0', fontSize: T.font.sm, color: T.muted,
              lineHeight: 1.5, maxWidth: 680,
            }}>
              {description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {actions}
          {showSync && <SyncExtendedButton />}
          {showSwitchBank && <SwitchBankButton />}
        </div>
      </div>
      {children}
    </div>
  );
}
