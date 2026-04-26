import { normalizeCategoryLabel } from '../theme/financeTheme';
import { ACCOUNT_CLASS, classifyAccount, isCashAccount } from './accountClass';
import { computePeriodCashflow, isTransfer } from './cashflowMath';

export const DEFAULT_PERIOD_DAYS = 30;
export const DEFAULT_LEDGER_DAYS = 365;
export const TRANSACTION_RANGE_PRESETS = ['30D', '60D', '90D', 'CUSTOM'];

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short' });

const ACCOUNT_GROUP_META = {
  cash: { id: 'cash', label: 'Cash', tone: 'positive' },
  investments: { id: 'investments', label: 'Investments', tone: 'accent' },
  retirement: { id: 'retirement', label: 'Retirement', tone: 'accent' },
  loans: { id: 'loans', label: 'Loans', tone: 'negative' },
  creditCards: { id: 'creditCards', label: 'Credit Cards', tone: 'negative' },
  other: { id: 'other', label: 'Other', tone: 'neutral' },
};

const LIABILITY_LABELS = {
  credit_debt: 'Credit Cards',
  student_debt: 'Student Loans',
  mortgage_debt: 'Mortgage',
  auto: 'Auto Loans',
  personal: 'Personal Loans',
  other: 'Other Debt',
};

const RECURRING_BILL_CATEGORY_KEYS = new Set([
  'LOAN_PAYMENTS',
  'RENT_AND_UTILITIES',
]);

const RECURRING_BILL_PATTERNS = [
  /\bmortgage\b/,
  /\bloan\b/,
  /\brent\b/,
  /\binsurance\b/,
  /\butility\b/,
  /\butilities\b/,
  /\belectric\b/,
  /\benergy\b/,
  /\bpower\b/,
  /\bwater\b/,
  /\bsewer\b/,
  /\btrash\b/,
  /\bwaste\b/,
  /\binternet\b/,
  /\bbroadband\b/,
  /\bwifi\b/,
  /\bwireless\b/,
  /\bphone\b/,
  /\bmobile\b/,
  /\bcell\b/,
  /\bverizon\b/,
  /\bxfinity\b/,
  /\bcomcast\b/,
  /\bspectrum\b/,
  /\bat&t\b/,
  /\batt\b/,
  /\bt-?mobile\b/,
  /\bgeico\b/,
  /\bprogressive\b/,
  /\bstate farm\b/,
  /\ballstate\b/,
  /\bliberty mutual\b/,
  /\bfarmers\b/,
];

const RECURRING_SUBSCRIPTION_PATTERNS = [
  /\bnetflix\b/,
  /\bhulu\b/,
  /\bspotify\b/,
  /\bdisney\b/,
  /\bprime\b/,
  /\bapple music\b/,
  /\bicloud\b/,
  /\bapple one\b/,
  /\bapple tv\b/,
  /\byoutube\b/,
  /\bmax\b/,
  /\bhbo\b/,
  /\bpeacock\b/,
  /\bparamount\b/,
  /\bamazon prime\b/,
  /\bgym\b/,
  /\bfitness\b/,
  /\bmembership\b/,
  /\bpeloton\b/,
  /\badobe\b/,
  /\bcanva\b/,
  /\bdropbox\b/,
  /\bnotion\b/,
  /\bmicrosoft 365\b/,
  /\bgoogle one\b/,
  /\bchatgpt\b/,
  /\bopenai\b/,
];

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCents(value) {
  return Math.round(num(value) * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

function sumCents(values) {
  return (values || []).reduce((sum, value) => sum + toCents(value), 0);
}

function sumBy(items, selector) {
  return (items || []).reduce((sum, item) => sum + num(selector(item)), 0);
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesAnyPattern(text, patterns) {
  return (patterns || []).some((pattern) => pattern.test(text));
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthKey(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-');
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return `${MONTH_LABEL.format(d)} '${String(year).slice(2)}`;
}

function shortDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date) {
  const parsed = safeDate(date);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function buildMonthKeys(count, endDate = new Date()) {
  const keys = [];
  const cursor = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCMonth(cursor.getUTCMonth() - i);
    keys.push(monthKey(d));
  }
  return keys;
}

function buildRollingAnchors(days, points, endDate = new Date()) {
  const anchors = [];
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  const totalMs = days * 24 * 60 * 60 * 1000;
  const step = points > 1 ? totalMs / (points - 1) : totalMs;
  for (let i = points - 1; i >= 0; i -= 1) {
    anchors.push(new Date(end.getTime() - (step * i)));
  }
  return anchors;
}

function isRetirementAccount(account) {
  const hay = `${account?.subtype || ''} ${account?.name || ''} ${account?.official_name || ''}`.toLowerCase();
  return /(401k|403b|457|ira|roth|retirement|pension|thrift|annuity)/.test(hay);
}

function getDisplayAccountGroup(account) {
  const klass = account?.account_class || classifyAccount(account);
  const subtype = String(account?.subtype || '').toLowerCase();
  const type = String(account?.type || '').toLowerCase();

  if (klass === ACCOUNT_CLASS.CASH) return ACCOUNT_GROUP_META.cash.id;
  if (klass === ACCOUNT_CLASS.INVESTMENT) {
    return isRetirementAccount(account)
      ? ACCOUNT_GROUP_META.retirement.id
      : ACCOUNT_GROUP_META.investments.id;
  }
  if (klass === ACCOUNT_CLASS.DEBT) {
    if (type === 'credit' || subtype.includes('credit')) return ACCOUNT_GROUP_META.creditCards.id;
    return ACCOUNT_GROUP_META.loans.id;
  }
  return ACCOUNT_GROUP_META.other.id;
}

function getCashBucket(account) {
  const subtype = String(account?.subtype || '').toLowerCase();
  if (subtype.includes('savings') || subtype.includes('money market')) return 'savings';
  return 'checking';
}

function buildAccountGroups(accounts) {
  const groups = Object.fromEntries(
    Object.values(ACCOUNT_GROUP_META).map((meta) => [meta.id, { ...meta, total: 0, accounts: [] }]),
  );

  for (const account of accounts || []) {
    const groupId = getDisplayAccountGroup(account);
    const balance = num(account?.balances?.current);
    groups[groupId].accounts.push(account);
    groups[groupId].total += groupId === 'creditCards' || groupId === 'loans'
      ? Math.max(0, balance)
      : balance;
  }

  return Object.values(groups)
    .map((group) => ({
      ...group,
      total: Number(group.total.toFixed(2)),
      accounts: [...group.accounts].sort(
        (a, b) => Math.abs(num(b?.balances?.current)) - Math.abs(num(a?.balances?.current)),
      ),
    }))
    .filter((group) => group.accounts.length > 0);
}

function buildCashBreakdown(accounts) {
  const result = {
    total: 0,
    checking: 0,
    savings: 0,
    checkingCount: 0,
    savingsCount: 0,
  };

  for (const account of accounts || []) {
    if (!isCashAccount(account)) continue;
    const balance = num(account?.balances?.current);
    result.total += balance;
    if (getCashBucket(account) === 'savings') {
      result.savings += balance;
      result.savingsCount += 1;
    } else {
      result.checking += balance;
      result.checkingCount += 1;
    }
  }

  return {
    total: Number(result.total.toFixed(2)),
    checking: Number(result.checking.toFixed(2)),
    savings: Number(result.savings.toFixed(2)),
    checkingCount: result.checkingCount,
    savingsCount: result.savingsCount,
  };
}

function scaleBreakdownSegments(rawSegments, totalValue) {
  const totalCents = Math.max(0, toCents(totalValue));
  const entries = Object.entries(rawSegments || {})
    .map(([key, value]) => [key, Math.max(0, num(value))])
    .filter(([, value]) => value > 0);

  if (entries.length === 0 || totalCents <= 0) return [];

  const rawTotal = entries.reduce((sum, [, value]) => sum + value, 0);
  let allocated = 0;

  return entries.map(([key, value], index) => {
    const cents = index === entries.length - 1
      ? totalCents - allocated
      : Math.round((totalCents * value) / rawTotal);
    allocated += cents;
    return {
      key,
      value: fromCents(cents),
      pct: totalCents > 0 ? Number(((cents / totalCents) * 100).toFixed(1)) : 0,
    };
  });
}

function buildAssetMix(accounts, netWorthData) {
  const cash = num(netWorthData?.breakdown?.cash);
  const investmentTotal = num(netWorthData?.breakdown?.investments);
  const retirementRaw = sumCents(
    (accounts || [])
      .filter((account) => getDisplayAccountGroup(account) === ACCOUNT_GROUP_META.retirement.id)
      .map((account) => account?.balances?.current),
  );
  const investmentRaw = sumCents(
    (accounts || [])
      .filter((account) => getDisplayAccountGroup(account) === ACCOUNT_GROUP_META.investments.id)
      .map((account) => account?.balances?.current),
  );
  const rawInvestmentSplit = retirementRaw + investmentRaw > 0
    ? { retirement: fromCents(retirementRaw), investments: fromCents(investmentRaw) }
    : { investments: investmentTotal };

  return scaleBreakdownSegments(
    {
      cash,
      ...rawInvestmentSplit,
    },
    num(netWorthData?.total_assets),
  ).map((segment) => ({
    ...segment,
    label: ACCOUNT_GROUP_META[segment.key]?.label || segment.key,
  }));
}

function buildOtherLiabilityRaw(liabilitiesData) {
  const raw = { mortgage_debt: 0, auto: 0, personal: 0, other: 0 };
  for (const account of liabilitiesData?.debt_accounts || []) {
    const subtype = String(account?.subtype || '').toLowerCase();
    const balance = Math.max(0, num(account?.current_balance));
    if (subtype.includes('mortgage') || subtype.includes('home equity')) raw.mortgage_debt += balance;
    else if (subtype.includes('auto')) raw.auto += balance;
    else if (subtype.includes('personal') || subtype.includes('consumer')) raw.personal += balance;
    else raw.other += balance;
  }
  return raw;
}

function buildLiabilityBreakdown(netWorthData, liabilitiesData) {
  const base = {
    student_debt: num(netWorthData?.breakdown?.student_debt),
    credit_debt: num(netWorthData?.breakdown?.credit_debt),
  };
  const canonicalMortgageDebt = num(netWorthData?.breakdown?.mortgage_debt);
  const otherDebt = num(netWorthData?.breakdown?.other_debt);
  const otherRaw = buildOtherLiabilityRaw(liabilitiesData);
  const mortgageFromLiabilities = sumBy(
    liabilitiesData?.mortgages || [],
    (mortgage) => mortgage?.outstanding_principal_balance,
  );
  const otherRawTotal = num(otherRaw.mortgage_debt) + num(otherRaw.auto) + num(otherRaw.personal) + num(otherRaw.other);

  // Keep the canonical total fixed, but use richer liability metadata to split
  // mortgage-like debt out of the generic "other debt" bucket for display.
  const splitRaw = {
    mortgage_debt: Math.max(
      canonicalMortgageDebt,
      mortgageFromLiabilities + num(otherRaw.mortgage_debt),
    ),
    auto: num(otherRaw.auto),
    personal: num(otherRaw.personal),
    other: num(otherRaw.other) > 0 || otherRawTotal > 0 ? num(otherRaw.other) : otherDebt,
  };

  const scaledMortgageAndOther = scaleBreakdownSegments(
    splitRaw,
    canonicalMortgageDebt + otherDebt,
  );

  const totalLiabilities = num(netWorthData?.total_liabilities);
  const segments = [
    ...Object.entries(base)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({ key, value })),
    ...scaledMortgageAndOther,
  ];
  const totalCents = Math.max(0, toCents(totalLiabilities));
  const segmentTotal = segments.reduce((sum, segment) => sum + toCents(segment.value), 0);

  return segments
    .map((segment) => ({
      ...segment,
      key: segment.key,
      label: LIABILITY_LABELS[segment.key] || segment.key,
      pct: totalCents > 0
        ? Number((((segmentTotal > 0 ? toCents(segment.value) : 0) / totalCents) * 100).toFixed(1))
        : 0,
    }))
    .filter((segment) => segment.value > 0);
}

function buildCategoryBreakdown(cashflowData, transactions, periodDays) {
  const source = cashflowData || computePeriodCashflow(transactions || [], { periodDays });
  const byLabel = new Map();
  for (const entry of source?.by_category || []) {
    const label = normalizeCategoryLabel(entry.category);
    byLabel.set(label, (byLabel.get(label) || 0) + toCents(entry.spending));
  }

  const totalCents = Array.from(byLabel.values()).reduce((sum, cents) => sum + cents, 0);

  return Array.from(byLabel.entries())
    .map(([label, cents]) => ({
      key: label,
      label,
      value: fromCents(cents),
      pct: totalCents > 0 ? Number(((cents / totalCents) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildCashBalanceTrend(accounts, transactions, { days = 90, points = 12 } = {}) {
  const cashAccounts = (accounts || []).filter(isCashAccount);
  if (!cashAccounts.length) return [];

  const current = { checking: 0, savings: 0 };
  const accountBuckets = new Map();
  for (const account of cashAccounts) {
    const bucket = getCashBucket(account);
    current[bucket] += num(account?.balances?.current);
    accountBuckets.set(String(account.account_id), bucket);
  }

  const cashTransactions = (transactions || [])
    .map((tx) => ({
      date: safeDate(tx?.date),
      amount: toCents(tx?.amount),
      bucket: accountBuckets.get(String(tx?.account_id)),
    }))
    .filter((tx) => tx.date && tx.bucket);

  const anchors = buildRollingAnchors(days, points);
  return anchors.map((anchor) => {
    let checking = toCents(current.checking);
    let savings = toCents(current.savings);

    for (const tx of cashTransactions) {
      if (tx.date > anchor) {
        if (tx.bucket === 'savings') savings += tx.amount;
        else checking += tx.amount;
      }
    }

    const checkingValue = fromCents(checking);
    const savingsValue = fromCents(savings);
    return {
      key: isoDate(anchor),
      label: shortDateLabel(anchor),
      checking: checkingValue,
      savings: savingsValue,
      total: Number((checkingValue + savingsValue).toFixed(2)),
    };
  });
}

function buildMonthlyCashflowSeries(transactions, months, endDate = new Date()) {
  const monthKeys = buildMonthKeys(months, endDate);
  const buckets = Object.fromEntries(
    monthKeys.map((key) => [key, { income: 0, spending: 0 }]),
  );

  for (const tx of transactions || []) {
    const date = safeDate(tx?.date);
    if (!date) continue;
    const key = monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    if (!buckets[key]) continue;
    if (isTransfer(tx)) continue;
    const amount = num(tx?.amount);
    if (amount < 0) buckets[key].income += toCents(-amount);
    else if (amount > 0) buckets[key].spending += toCents(amount);
  }

  return monthKeys.map((key) => {
    const income = fromCents(buckets[key].income);
    const spending = fromCents(buckets[key].spending);
    return {
      key,
      label: monthLabelFromKey(key),
      income,
      spending,
      net: fromCents(buckets[key].income - buckets[key].spending),
    };
  });
}

function buildNetWorthTrend(netWorthData, monthlyTrend) {
  const currentNet = toCents(netWorthData?.net_worth);
  if (!monthlyTrend?.length) return [];

  const totalTrendNet = monthlyTrend.reduce((sum, point) => sum + toCents(point.net), 0);
  let running = currentNet - totalTrendNet;

  return monthlyTrend.map((point) => {
    running += toCents(point.net);
    return {
      label: point.label,
      netWorth: fromCents(running),
    };
  });
}

function titleizePaymentType(type) {
  return String(type || 'payment')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUpcomingBills(insightsData) {
  return (insightsData?.upcoming_payments || [])
    .slice()
    .sort((a, b) => String(a?.due_date || '').localeCompare(String(b?.due_date || '')))
    .slice(0, 6)
    .map((payment, index) => ({
      key: `${payment?.type || 'payment'}-${payment?.due_date || index}`,
      title: titleizePaymentType(payment?.type),
      subtitle: payment?.due_date || 'No due date',
      amount: num(payment?.amount),
      dueDate: payment?.due_date || null,
      tone: 'negative',
    }));
}

function buildBillsDueSummary(items, days = 30) {
  const now = startOfDay(new Date());
  const end = new Date(now);
  end.setDate(end.getDate() + days);

  const upcoming = (items || []).filter((item) => {
    const due = safeDate(item?.dueDate || item?.due_date);
    return due && due >= now && due <= end;
  });

  return {
    count: upcoming.length,
    total: Number(sumBy(upcoming, (item) => item.amount).toFixed(2)),
  };
}

function buildRecurringList(streams) {
  return (streams || [])
    .filter((stream) => stream?.is_active !== false && stream?.monthly_amount != null)
    .slice()
    .sort((a, b) => num(b?.monthly_amount) - num(a?.monthly_amount))
    .map((stream) => ({
      key: stream?.stream_id || stream?.merchant_key,
      title: stream?.merchant_name || 'Unknown',
      subtitle: `${stream?.cadence || stream?.frequency || 'Monthly'}${stream?.personal_finance_category ? ` · ${normalizeCategoryLabel(stream.personal_finance_category)}` : ''}`,
      amount: num(stream?.monthly_amount),
      tone: stream?.direction === 'inflow' ? 'positive' : 'negative',
    }));
}

function recurringDisplayBucket(stream, knownSubscriptionMerchants) {
  const merchant = normalizeSearchText(stream?.merchant_name || stream?.description || stream?.name);
  const categoryKey = String(stream?.personal_finance_category || '').toUpperCase();

  if (RECURRING_BILL_CATEGORY_KEYS.has(categoryKey) || matchesAnyPattern(merchant, RECURRING_BILL_PATTERNS)) {
    return 'bill';
  }

  if (
    knownSubscriptionMerchants.has(merchant)
    || matchesAnyPattern(merchant, RECURRING_SUBSCRIPTION_PATTERNS)
    || categoryKey === 'ENTERTAINMENT'
  ) {
    return 'subscription';
  }

  return 'bill';
}

function buildRecurringDisplaySections(recurringData, insightsData) {
  const knownSubscriptionMerchants = new Set(
    (insightsData?.subscriptions_detected || [])
      .map((stream) => normalizeSearchText(stream?.merchant_name))
      .filter(Boolean),
  );

  const sections = { bills: [], subscriptions: [] };
  for (const stream of recurringData?.outflow_streams || []) {
    if (stream?.is_active === false || stream?.monthly_amount == null) continue;

    const item = {
      key: stream?.stream_id || stream?.merchant_key,
      title: stream?.merchant_name || 'Unknown',
      subtitle: `${stream?.cadence || stream?.frequency || 'Monthly'}${stream?.personal_finance_category ? ` · ${normalizeCategoryLabel(stream.personal_finance_category)}` : ''}`,
      amount: num(stream?.monthly_amount),
      tone: 'negative',
    };

    const bucket = recurringDisplayBucket(stream, knownSubscriptionMerchants);
    sections[bucket === 'subscription' ? 'subscriptions' : 'bills'].push(item);
  }

  sections.bills.sort((a, b) => b.amount - a.amount);
  sections.subscriptions.sort((a, b) => b.amount - a.amount);

  return {
    bills: sections.bills,
    subscriptions: sections.subscriptions,
    billsTotal: Number(sumBy(sections.bills, (item) => item.amount).toFixed(2)),
    subscriptionsTotal: Number(sumBy(sections.subscriptions, (item) => item.amount).toFixed(2)),
  };
}

function buildRecentTransactions(transactions, limit = 5) {
  return [...(transactions || [])]
    .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))
    .slice(0, limit)
    .map((tx) => ({
      key: tx.transaction_id,
      title: tx.name || 'Transaction',
      subtitle: `${normalizeCategoryLabel(tx.category)}${tx?.account_name ? ` · ${tx.account_name}` : ''}`,
      amount: num(tx.amount),
      date: tx.date || null,
      tone: num(tx.amount) < 0 ? 'positive' : 'negative',
    }));
}

function buildLargestAssetAccounts(accountGroups, limit = 5) {
  return (accountGroups || [])
    .filter((group) => group.id !== ACCOUNT_GROUP_META.loans.id && group.id !== ACCOUNT_GROUP_META.creditCards.id)
    .flatMap((group) => group.accounts.map((account) => ({
      key: account.account_id,
      title: account.name || account.official_name || 'Account',
      subtitle: account.institution_name || account.subtype || account.type || group.label,
      amount: Math.abs(num(account?.balances?.current)),
      tone: group.tone,
    })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function buildFinancialSnapshot(summary) {
  return [
    { key: 'assets', label: 'Total Assets', value: summary.totalAssets, tone: 'positive' },
    { key: 'liabilities', label: 'Total Liabilities', value: summary.totalLiabilities, tone: 'negative' },
    { key: 'net-worth', label: 'Net Worth', value: summary.netWorth, tone: summary.netWorth >= 0 ? 'positive' : 'negative' },
  ];
}

function buildTopMerchants(transactions, limit = 5) {
  const totals = new Map();
  for (const tx of transactions || []) {
    const amount = num(tx?.amount);
    if (amount <= 0 || isTransfer(tx)) continue;
    const merchant = tx?.merchant_name || tx?.name || 'Unknown';
    totals.set(merchant, (totals.get(merchant) || 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([merchant, amount]) => ({
      key: merchant,
      title: merchant,
      amount: Number(amount.toFixed(2)),
      tone: 'negative',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function buildPlanningBanner(summary) {
  if (summary.recurringIncome > 0 || summary.recurringObligations > 0) {
    const diff = Number((summary.recurringIncome - summary.recurringObligations).toFixed(2));
    return {
      tone: diff >= 0 ? 'positive' : 'negative',
      title: diff >= 0
        ? `Monthly recurring income covers recurring bills by $${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `Recurring bills exceed recurring income by $${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      body: diff >= 0
        ? 'Great job keeping your recurring commitments in check.'
        : 'Recurring commitments are ahead of recurring income. Review bills and subscriptions.',
    };
  }
  return buildInsightBanner(summary, null);
}

export function resolveTransactionRange(range) {
  const preset = range?.preset || '30D';
  const end = range?.customEnd ? startOfDay(range.customEnd) : startOfDay(new Date());
  const endDate = end || startOfDay(new Date());

  if (preset === 'CUSTOM') {
    const start = range?.customStart ? startOfDay(range.customStart) : null;
    return {
      startDate: start,
      endDate,
      label: start ? `${isoDate(start)} → ${isoDate(endDate)}` : 'Custom range',
    };
  }

  const days = Number.parseInt(String(preset).replace(/\D/g, ''), 10) || 30;
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate,
    endDate,
    label: `Last ${days} days`,
  };
}

export function filterTransactionsForRange(transactions, range) {
  const { startDate, endDate } = resolveTransactionRange(range);
  return (transactions || []).filter((tx) => {
    const date = safeDate(tx?.date);
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

function buildInsightBanner(summary, insightsData) {
  const nudge = (insightsData?.nudges || [])[0];
  if (nudge) {
    return {
      tone: nudge?.severity === 'alert' ? 'negative' : nudge?.severity === 'warning' ? 'warn' : 'accent',
      title: nudge?.type ? titleizePaymentType(nudge.type) : 'Insight',
      body: nudge?.message || '',
    };
  }

  if (summary.safeToSpend < 0) {
    return {
      tone: 'negative',
      title: 'Upcoming bills exceed cash',
      body: 'Recurring obligations are higher than current liquid cash. Review due dates and reduce optional spending.',
    };
  }

  if (summary.emergencyFundRatio != null && summary.emergencyFundRatio >= 1) {
    return {
      tone: 'positive',
      title: 'Emergency fund is funded',
      body: 'You currently hold at least one target emergency-fund window in cash.',
    };
  }

  return {
    tone: 'accent',
    title: 'Keep an eye on commitments',
    body: 'Planning combines recurring bills, safe-to-spend, and due-date reminders so you can act before cash gets tight.',
  };
}

function buildNetWorthFallback(accounts) {
  let cash = 0;
  let investments = 0;
  let creditDebt = 0;
  let studentDebt = 0;
  let mortgageDebt = 0;
  let otherDebt = 0;

  for (const account of accounts || []) {
    const klass = account?.account_class || classifyAccount(account);
    const balance = num(account?.balances?.current);
    const subtype = String(account?.subtype || '').toLowerCase();
    const type = String(account?.type || '').toLowerCase();

    if (klass === ACCOUNT_CLASS.CASH) cash += balance;
    else if (klass === ACCOUNT_CLASS.INVESTMENT) investments += Math.max(0, balance);
    else if (klass === ACCOUNT_CLASS.DEBT) {
      const debt = Math.max(0, balance);
      if (type === 'credit' || subtype.includes('credit')) creditDebt += debt;
      else if (subtype.includes('student')) studentDebt += debt;
      else if (subtype.includes('mortgage')) mortgageDebt += debt;
      else otherDebt += debt;
    }
  }

  const totalAssets = cash + investments;
  const totalLiabilities = creditDebt + studentDebt + mortgageDebt + otherDebt;
  return {
    net_worth: Number((totalAssets - totalLiabilities).toFixed(2)),
    total_assets: Number(totalAssets.toFixed(2)),
    total_liabilities: Number(totalLiabilities.toFixed(2)),
    breakdown: {
      cash: Number(cash.toFixed(2)),
      investments: Number(investments.toFixed(2)),
      credit_debt: Number(creditDebt.toFixed(2)),
      student_debt: Number(studentDebt.toFixed(2)),
      mortgage_debt: Number(mortgageDebt.toFixed(2)),
      other_debt: Number(otherDebt.toFixed(2)),
    },
  };
}

export function buildFinanceModel({
  accounts,
  transactions,
  recurringData,
  liabilitiesData,
  investmentsSummary,
  netWorthData,
  cashflowData,
  insightsData,
  periodDays = DEFAULT_PERIOD_DAYS,
} = {}) {
  const accountGroups = buildAccountGroups(accounts || []);
  const cashBreakdown = buildCashBreakdown(accounts || []);
  const fallbackCashflow = computePeriodCashflow(transactions || [], { periodDays });
  const cashflow = cashflowData || fallbackCashflow;
  const canonicalNetWorth = netWorthData || buildNetWorthFallback(accounts || []);

  const cashOnHand = canonicalNetWorth?.breakdown?.cash != null
    ? num(canonicalNetWorth.breakdown.cash)
    : fromCents(sumCents((accounts || []).filter(isCashAccount).map((account) => account?.balances?.current)));
  const recurringObligations = num(recurringData?.summary?.total_monthly_outflow);
  const recurringIncome = num(recurringData?.summary?.total_monthly_inflow);
  const summary = {
    netWorth: num(canonicalNetWorth?.net_worth),
    totalAssets: num(canonicalNetWorth?.total_assets),
    totalLiabilities: num(canonicalNetWorth?.total_liabilities),
    cashOnHand,
    monthlyIncome: num(cashflow?.income),
    monthlySpending: num(cashflow?.spending),
    netCashFlow: num(cashflow?.net),
    recurringObligations,
    recurringIncome,
    netRecurring: recurringData?.summary?.net_recurring != null
      ? num(recurringData.summary.net_recurring)
      : fromCents(toCents(recurringIncome) - toCents(recurringObligations)),
    safeToSpend: insightsData?.safe_to_spend != null
      ? num(insightsData.safe_to_spend)
      : fromCents(toCents(cashOnHand) - toCents(recurringObligations)),
    emergencyFundTarget: num(insightsData?.emergency_fund_target),
  };

  summary.emergencyFundRatio = summary.emergencyFundTarget > 0
    ? Number((summary.cashOnHand / summary.emergencyFundTarget).toFixed(2))
    : null;

  const monthlyTrend6 = buildMonthlyCashflowSeries(transactions || [], 6);
  const monthlyTrend12 = buildMonthlyCashflowSeries(transactions || [], 12);
  const netWorthTrend = buildNetWorthTrend(canonicalNetWorth, monthlyTrend12);
  const cashTrend3m = buildCashBalanceTrend(accounts || [], transactions || [], { days: 90, points: 12 });
  const cashTrend6m = buildCashBalanceTrend(accounts || [], transactions || [], { days: 180, points: 14 });
  const assetMix = buildAssetMix(accounts || [], canonicalNetWorth || {});
  const liabilityBreakdown = buildLiabilityBreakdown(canonicalNetWorth || {}, liabilitiesData || {});
  const categoryBreakdown = buildCategoryBreakdown(cashflowData, transactions || [], periodDays);
  const upcomingBills = buildUpcomingBills(insightsData);
  const billsDueSummary = buildBillsDueSummary(upcomingBills, 30);
  const recurringCommitments = buildRecurringList(recurringData?.outflow_streams).slice(0, 8);
  const recurringIncomeList = buildRecurringList(recurringData?.inflow_streams).slice(0, 4);
  const recurringBreakdown = buildRecurringDisplaySections(recurringData || {}, insightsData || {});
  const recurringBills = recurringBreakdown.bills.slice(0, 6);
  const subscriptions = recurringBreakdown.subscriptions.slice(0, 6);
  const insightBanner = buildInsightBanner(summary, insightsData);
  const planningBanner = buildPlanningBanner(summary);
  const recentTransactions = buildRecentTransactions(transactions || [], 5);
  const largestAccounts = buildLargestAssetAccounts(accountGroups, 5);

  const accountHealthTotal = summary.totalAssets + summary.totalLiabilities;
  const accountHealth = {
    assetsPct: accountHealthTotal > 0
      ? Number(((summary.totalAssets / accountHealthTotal) * 100).toFixed(1))
      : 0,
    liabilitiesPct: accountHealthTotal > 0
      ? Number(((summary.totalLiabilities / accountHealthTotal) * 100).toFixed(1))
      : 0,
  };

  const sortedTransactions = [...(transactions || [])].sort((a, b) => {
    const dateCompare = String(b?.date || '').localeCompare(String(a?.date || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(b?.transaction_id || '').localeCompare(String(a?.transaction_id || ''));
  });

  const recent30dTransactions = filterTransactionsForRange(sortedTransactions, { preset: '30D' });
  const topMerchants30d = buildTopMerchants(recent30dTransactions, 5);
  const dashboardCategoryBreakdown = buildCategoryBreakdown(cashflowData, recent30dTransactions, periodDays);

  return {
    summary,
    cashBreakdown,
    accountGroups,
    accountHealth,
    assetMix,
    liabilityBreakdown,
    categoryBreakdown,
    dashboardCategoryBreakdown,
    monthlyTrend6,
    monthlyTrend12,
    cashTrend3m,
    cashTrend6m,
    netWorthTrend,
    upcomingBills,
    billsDueSummary,
    recurringCommitments,
    recurringBreakdown,
    recurringBills,
    recurringIncomeList,
    subscriptions,
    insightBanner,
    planningBanner,
    recentTransactions,
    largestAccounts,
    financialSnapshot: buildFinancialSnapshot(summary),
    investmentsSummary: {
      totalMarketValue: num(investmentsSummary?.total_market_value),
      holdingsCount: num(investmentsSummary?.holdings_count),
      allocation: investmentsSummary?.allocation || [],
    },
    ledger: {
      transactions: sortedTransactions,
      byCategory: categoryBreakdown,
      last30Days: cashflow,
      topMerchants30d,
    },
  };
}
