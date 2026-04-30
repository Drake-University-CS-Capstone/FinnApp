import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FINANCE_FONT_LINK, FINANCE_T as T } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { SwitchBankButton, SyncExtendedButton } from '../components/finance-ui';

const NAV_ITEMS = [
  { to: '/home/dashboard', label: 'Dashboard' },
  { to: '/home/accounts', label: 'Accounts' },
  { to: '/home/transactions', label: 'Transactions' },
  { to: '/home/planning', label: 'Planning' },
  { to: '/home/net-worth', label: 'Net Worth' },
  { to: '/home/stock-market', label: 'Stock Market' },
  { to: '/home/settings', label: 'Settings' },
];

export default function FinanceLayout() {
  const location = useLocation();
  const { phase, selectedItem, workspaceLabel, plaidItems } = useFinanceSession();
  const onBankFlow = location.pathname === '/home' || location.pathname === '/home/';
  const financeUnlocked = phase === 'dashboard' && !!selectedItem;

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: T.bg,
      fontFamily: T.sans,
      color: T.text,
    }}>
      <link rel="stylesheet" href={FINANCE_FONT_LINK} />

      {onBankFlow || !financeUnlocked ? (
        <div style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div style={{ width: '100%', maxWidth: 1180 }}>
            <Outlet />
          </div>
        </div>
      ) : (
        <div className="finance-shell">
          <aside className="finance-sidebar">
            <div>
              <div className="finance-brand">Financial Capstone</div>
              <div className="finance-sidebar-subtitle">
                Clean finance workspace
              </div>
            </div>

            <nav className="finance-sidebar-nav">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `finance-sidebar-link${isActive ? ' finance-sidebar-link--active' : ''}`}
                >
                  <span className="finance-sidebar-link__dot" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="finance-sidebar-footer">
              <div className="finance-sidebar-profile">
                <div className="finance-sidebar-avatar">F</div>
                <div>
                  <div className="finance-sidebar-profile__title">{workspaceLabel}</div>
                  <div className="finance-sidebar-profile__meta">
                    {plaidItems.length} linked institution{plaidItems.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="finance-main">
            <header className="finance-main-toolbar">
              <div>
                <div className="finance-main-toolbar__label">Workspace</div>
                <div className="finance-main-toolbar__title">{workspaceLabel}</div>
              </div>
              <div className="finance-main-toolbar__actions">
                <SyncExtendedButton small />
                <SwitchBankButton />
              </div>
            </header>
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
}
