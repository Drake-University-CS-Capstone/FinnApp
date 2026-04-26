// Shared visual tokens for finance pages (matches Dashboard / navbar feel).
// This is the single source of truth for colors, typography, spacing, and
// radii used across finance screens and panels.
export const FINANCE_T = {
  // surfaces
  bg:         '#0d1424',
  bgElev:     '#131c2e',
  surface:    'rgba(255,255,255,0.03)',
  surfaceHov: 'rgba(99,102,241,0.08)',
  border:     'rgba(99,102,241,0.2)',
  borderSoft: 'rgba(99,102,241,0.1)',
  borderHov:  'rgba(99,102,241,0.4)',

  // text
  text:       '#e2e8f0',
  textDim:    '#cbd5e1',
  muted:      '#94a3b8',
  mutedDeep:  '#64748b',

  // accent / semantic
  accent:     '#a5b4fc',
  accentStrong: '#c7d2fe',
  accentBg:   'rgba(99,102,241,0.15)',
  accentBord: 'rgba(99,102,241,0.4)',
  green:      '#86efac',
  greenBg:    'rgba(134,239,172,0.1)',
  yellow:     '#fde68a',
  yellowBg:   'rgba(253,230,138,0.1)',
  red:        '#fca5a5',
  redBg:      'rgba(252,165,165,0.1)',

  // typography
  sans:       "'DM Sans', system-ui, sans-serif",
  display:    "'Playfair Display', Georgia, serif",

  // size scale
  radius:     { sm: 8, md: 10, lg: 12, xl: 16, pill: 99 },
  space:      { xs: '0.35rem', sm: '0.55rem', md: '0.85rem', lg: '1.25rem', xl: '1.75rem', xxl: '2.5rem' },
  font:       {
    micro:  '0.68rem',
    xs:     '0.72rem',
    sm:     '0.82rem',
    base:   '0.88rem',
    md:     '1rem',
    lg:     '1.35rem',
    xl:     '1.75rem',
    xxl:    '2.2rem',
  },
  shadow:     '0 10px 30px rgba(0,0,0,0.35)',
};

export const FINANCE_FONT_LINK =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@700&display=swap';

// ── Category normalization ────────────────────────────────────────────────
// Single canonical label list so chips don't show duplicate "Other" variants
// across pages. Mirrors Plaid's personal-finance-category primary enum.
export const CATEGORY_LABELS = {
  FOOD_AND_DRINK:         'Food & Drink',
  TRANSPORTATION:         'Transportation',
  GENERAL_MERCHANDISE:    'Shopping',
  HOME_IMPROVEMENT:       'Home',
  PERSONAL_CARE:          'Personal Care',
  ENTERTAINMENT:          'Entertainment',
  GENERAL_SERVICES:       'Services',
  INCOME:                 'Income',
  TRANSFER_IN:            'Transfer in',
  TRANSFER_OUT:           'Transfer out',
  TRAVEL:                 'Travel',
  MEDICAL:                'Health',
  HEALTH:                 'Health',
  LOAN_PAYMENTS:          'Loan payment',
  BANK_FEES:              'Fees',
  RENT_AND_UTILITIES:     'Rent & utilities',
  GOVERNMENT_AND_NON_PROFIT: 'Government',
  OTHER:                  'Other',
};

export function normalizeCategoryLabel(raw) {
  if (!raw) return 'Other';
  const key = String(raw).toUpperCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  // Fallback: title case the raw key
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
