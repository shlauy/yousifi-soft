import { forwardRef, type ReactNode, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/components/error-boundary';
import { localDataService } from '@/lib/local-data-service';
import { getDeviceContacts, pickDeviceContact, type DeviceContact } from '@/lib/device-contacts';
import { openWhatsApp, sendSms, type WhatsAppPackage } from '@/lib/messaging';
import { CHANGELOG } from '@/data/changelog';
import {
  backupDirectoryLabel,
  chooseAutomaticBackupDirectory,
  clearAutomaticBackupDirectory,
  exportManualBackup,
  isUserCancellation,
  restoreLatestAutomaticBackup,
  saveAutomaticBackup,
} from '@/lib/automatic-backup';
import ProfitPage, { type ProfitTimelineEntry } from '@/pages/ProfitPage';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, BarChart3, BookOpen, Boxes,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Cloud, ContactRound, CreditCard, Download, Edit3, FileJson, FolderOpen, History, Landmark,
  LayoutDashboard, LockKeyhole, Menu, MessageCircle, Moon, MoreHorizontal, PackageOpen, Phone, ShieldCheck,
  Plus, Receipt, RefreshCcw, RotateCcw, Search, Send, Settings as SettingsIcon, ShoppingCart, Smartphone,
  Sparkles, Sun, Trash2, TrendingDown, TrendingUp, Upload, UserPlus, Users, Wallet, X, Zap,
} from 'lucide-react';

type CardType = { id: string; name: string; sellingPrice: number; profit: number; color: string; quantity: number };
type Customer = { id: string; name: string; phone: string; creditLimit: number | null; debt: number };
type Sale = { id: string; cardTypeId: string; customerId?: string; quantity: number; total: number; profit: number; paymentType: 'cash' | 'credit'; createdAt: string };
type Payment = { id: string; customerId: string; amount: number; createdAt: string };
type Supply = { id: string; cardTypeId: string; quantity: number; supplierCost: number; total: number; createdAt: string };
type SupplierPayment = { id: string; amount: number; createdAt: string };
type ReturnItem = { id: string; cardTypeId: string; quantity: number; supplierCost: number; total: number; createdAt: string };
type Withdrawal = {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
  kind?: 'profit' | 'temporary';
  eventType?: 'PROFIT_WITHDRAWAL' | 'TEMPORARY_DRAWING';
  status?: 'open' | 'returned' | 'converted';
  settledAt?: string;
};
type Deposit = { id: string; amount: number; note: string; createdAt: string };
type Settings = {
  theme: 'light' | 'dark';
  reminderText: string;
  bulkSmsText: string;
  whatsappPackage: WhatsAppPackage;
  showTopBar: boolean;
  autoBackupOnExit: boolean;
  autoBackupDirectory: string | null;
  autoBackupDirectoryName: string | null;
  maxAutoBackups: number;
  profitManagementEnabled: boolean;
  schemaVersion: number;
};
type LocalState = {
  cards: CardType[]; customers: Customer[]; sales: Sale[]; payments: Payment[]; supplies: Supply[];
  supplierPayments: SupplierPayment[]; returns: ReturnItem[]; withdrawals: Withdrawal[]; deposits: Deposit[];
  settings: Settings;
  [key: string]: unknown;
};

const APP_VERSION = '1.0.15';
const BUILD_NUMBER = '16';
const APP_VERSION_LABEL = `الإصدار ${APP_VERSION} (بناء ${BUILD_NUMBER})`;
const LAST_SEEN_VERSION_KEY = 'last_seen_version';
const sortedChangelog = [...CHANGELOG].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
const SCHEMA_VERSION = 4;
const colors = [
  '#d7792b', '#4f7f83', '#bd5c51', '#967344', '#5d6c9f', '#9b607b',
  '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#f43f5e', '#f97316', '#eab308', '#059669',
];
const cardPalettes = [
  ['#d97736', '#a94d3d'],
  ['#3f7f83', '#245568'],
  ['#9a713d', '#70522d'],
  ['#7564a6', '#4b477f'],
  ['#b55b78', '#7f3f62'],
  ['#3f9072', '#256452'],
  ['#bf7544', '#87502f'],
  ['#5773aa', '#384f84'],
];
const navItems = [
  { href: '/', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/sales', label: 'نقطة البيع', icon: ShoppingCart },
  { href: '/customers', label: 'العملاء', icon: Users },
  { href: '/inventory', label: 'المخزون', icon: Boxes },
  { href: '/control', label: 'الحسابات', icon: Landmark },
  { href: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

const demoState = (): LocalState => {
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * 3600000).toISOString();
  const cards: CardType[] = [
    { id: 'card-network-100', name: 'كرت شبكة ١٠٠', sellingPrice: 100, profit: 8, color: colors[0], quantity: 47 },
    { id: 'card-network-500', name: 'كرت شبكة ٥٠٠', sellingPrice: 500, profit: 35, color: colors[1], quantity: 23 },
    { id: 'card-network-250', name: 'كرت شبكة ٢٥٠', sellingPrice: 250, profit: 20, color: colors[2], quantity: 31 },
    { id: 'card-network-500-pro', name: 'كرت شبكة مميز ٥٠٠', sellingPrice: 500, profit: 32, color: colors[3], quantity: 12 },
  ];
  const customers: Customer[] = [
    { id: 'customer-ali', name: 'علي محمد', phone: '777 321 654', creditLimit: 5000, debt: 1800 },
    { id: 'customer-sami', name: 'سامي الخولاني', phone: '733 908 112', creditLimit: 3000, debt: 650 },
    { id: 'customer-nour', name: 'نور الدين', phone: '771 442 800', creditLimit: 10000, debt: 0 },
  ];
  const sales: Sale[] = [
    { id: 'sale-1', cardTypeId: cards[0].id, customerId: customers[0].id, quantity: 3, total: 300, profit: 24, paymentType: 'credit', createdAt: ago(1) },
    { id: 'sale-2', cardTypeId: cards[1].id, quantity: 1, total: 500, profit: 35, paymentType: 'cash', createdAt: ago(3) },
    { id: 'sale-3', cardTypeId: cards[2].id, customerId: customers[1].id, quantity: 2, total: 500, profit: 40, paymentType: 'credit', createdAt: ago(19) },
    { id: 'sale-4', cardTypeId: cards[0].id, quantity: 4, total: 400, profit: 32, paymentType: 'cash', createdAt: ago(25) },
  ];
  const supplies: Supply[] = [{ id: 'supply-1', cardTypeId: cards[0].id, quantity: 40, supplierCost: 92, total: 3680, createdAt: ago(72) }];
  return {
    cards, customers, sales, supplies, payments: [{ id: 'payment-1', customerId: customers[0].id, amount: 400, createdAt: ago(30) }],
    supplierPayments: [{ id: 'supplier-payment-1', amount: 1200, createdAt: ago(48) }],
    returns: [], withdrawals: [{ id: 'withdrawal-1', amount: 300, note: 'سحب أرباح', kind: 'profit', createdAt: ago(8) }],
    deposits: [{ id: 'deposit-1', amount: 500, note: 'رأس مال', createdAt: ago(96) }],
    settings: {
      theme: 'light',
      reminderText: 'مرحباً {الاسم}، نذكركم بأن عليكم رصيداً قدره {المبلغ} ريال. شكراً لتعاملكم معنا.',
      bulkSmsText: 'مرحباً {الاسم}، نذكركم بأن عليكم رصيداً قدره {المبلغ} ريال. شكراً لتعاملكم معنا.',
      whatsappPackage: 'system',
      showTopBar: true,
      autoBackupOnExit: true,
      autoBackupDirectory: null,
      autoBackupDirectoryName: null,
      maxAutoBackups: 20,
      profitManagementEnabled: true,
      schemaVersion: SCHEMA_VERSION,
    },
  };
};

const migrate = (input: Partial<LocalState> | null): LocalState => {
  const seed = demoState();
  if (!input) return seed;
  const incomingSettings: Partial<Settings> = input.settings ?? {};
  const incomingMaxBackups = Number(incomingSettings.maxAutoBackups);
  const autoBackupDirectory = typeof incomingSettings.autoBackupDirectory === 'string' && incomingSettings.autoBackupDirectory.trim()
    ? incomingSettings.autoBackupDirectory
    : null;
  const autoBackupDirectoryName = typeof incomingSettings.autoBackupDirectoryName === 'string' && incomingSettings.autoBackupDirectoryName.trim()
    ? incomingSettings.autoBackupDirectoryName
    : null;
  const bulkSmsText = typeof incomingSettings.bulkSmsText === 'string'
    ? incomingSettings.bulkSmsText
    : seed.settings.bulkSmsText;
  const whatsappPackage = incomingSettings.whatsappPackage === 'com.whatsapp'
    || incomingSettings.whatsappPackage === 'com.whatsapp.w4b'
    || incomingSettings.whatsappPackage === 'system'
    ? incomingSettings.whatsappPackage
    : seed.settings.whatsappPackage;
  const withdrawals = (input.withdrawals ?? []).map((withdrawal) => ({
    ...withdrawal,
    kind: withdrawal.kind === 'temporary' ? 'temporary' : 'profit',
    eventType: withdrawal.kind === 'temporary' ? 'TEMPORARY_DRAWING' : 'PROFIT_WITHDRAWAL',
    ...(withdrawal.kind === 'temporary' ? { status: withdrawal.status ?? 'open' } : {}),
  })) as Withdrawal[];
  return {
    ...seed, ...input,
    cards: input.cards ?? [], customers: (input.customers ?? []).map((customer) => { const rawLimit = customer.creditLimit as number | string | null | undefined; const parsedLimit = rawLimit == null || (typeof rawLimit === 'string' && !rawLimit.trim()) ? null : Number(rawLimit); return { ...customer, creditLimit: parsedLimit == null || !Number.isFinite(parsedLimit) || parsedLimit < 0 ? null : parsedLimit }; }) as Customer[], sales: input.sales ?? [],
    payments: input.payments ?? [], supplies: input.supplies ?? [], supplierPayments: input.supplierPayments ?? [],
    returns: input.returns ?? [], withdrawals, deposits: input.deposits ?? [],
    settings: {
      ...seed.settings,
      ...incomingSettings,
       bulkSmsText,
       whatsappPackage,
      showTopBar: incomingSettings.showTopBar !== false,
      autoBackupOnExit: incomingSettings.autoBackupOnExit !== false,
      autoBackupDirectory,
      autoBackupDirectoryName: autoBackupDirectory ? autoBackupDirectoryName : null,
      maxAutoBackups: Number.isFinite(incomingMaxBackups) ? Math.min(1000, Math.max(1, Math.floor(incomingMaxBackups))) : 20,
      profitManagementEnabled: incomingSettings.profitManagementEnabled !== false,
      schemaVersion: SCHEMA_VERSION,
    },
  };
};
const emptyState = (): LocalState => {
  const seed = demoState();
  return {
    ...seed,
    cards: [], customers: [], sales: [], payments: [], supplies: [],
    supplierPayments: [], returns: [], withdrawals: [], deposits: [],
    settings: { ...seed.settings },
  };
};
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const formatMoney = (value: number) => `${new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(Math.round(value))} ريال`;
const formatNumber = (value: number) => new Intl.NumberFormat('ar-YE', { maximumFractionDigits: 0 }).format(value);
const dayLabel = (iso: string) => new Intl.DateTimeFormat('ar-YE', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const supplierCost = (card: CardType) => card.sellingPrice - card.profit;
const isFundWithdrawalActive = (withdrawal: Withdrawal) => withdrawal.kind !== 'temporary' || withdrawal.status !== 'returned';
const fundWithdrawalTotal = (withdrawals: Withdrawal[]) => withdrawals.filter(isFundWithdrawalActive).reduce((total, withdrawal) => total + withdrawal.amount, 0);
const ownerProfitWithdrawalTotal = (withdrawals: Withdrawal[]) => withdrawals.reduce((total, withdrawal) => (
  total + (withdrawal.kind === 'profit' || (withdrawal.kind === 'temporary' && withdrawal.status === 'converted') ? withdrawal.amount : 0)
), 0);
const supplierPayable = (state: LocalState) => Math.max(
  state.supplies.reduce((total, supply) => total + supply.total, 0)
    - state.supplierPayments.reduce((total, payment) => total + payment.amount, 0)
    - state.returns.reduce((total, returned) => total + returned.total, 0),
  0,
);
const fundBalance = (state: LocalState) => state.sales
  .filter((sale) => sale.paymentType === 'cash')
  .reduce((total, sale) => total + sale.total, 0)
  + state.payments.reduce((total, payment) => total + payment.amount, 0)
  + state.deposits.reduce((total, deposit) => total + deposit.amount, 0)
  - state.supplierPayments.reduce((total, payment) => total + payment.amount, 0)
  - fundWithdrawalTotal(state.withdrawals);
const realizedProfitForPayment = (state: LocalState, payment: Payment) => {
  const customerCreditSales = state.sales.filter((sale) => sale.customerId === payment.customerId && sale.paymentType === 'credit');
  const creditTotal = customerCreditSales.reduce((total, sale) => total + sale.total, 0);
  const creditProfit = customerCreditSales.reduce((total, sale) => total + sale.profit, 0);
  return creditTotal > 0 ? payment.amount * (creditProfit / creditTotal) : 0;
};
const accruedProfit = (state: LocalState) => state.sales.reduce((total, sale) => total + sale.profit, 0);
const realizedCashProfit = (state: LocalState) => state.sales
  .filter((sale) => sale.paymentType === 'cash')
  .reduce((total, sale) => total + sale.profit, 0)
  + state.payments.reduce((total, payment) => total + realizedProfitForPayment(state, payment), 0);
const normalizeName = (value: string) => value.trim().toLocaleLowerCase('ar');
const normalizePhone = (value: string) => value.replace(/\D/g, '');
const personalizeMessage = (template: string, customer: Customer) => template
  .replace(/\{الاسم\}/g, customer.name)
  .replace(/\{اسم_العميل\}/g, customer.name)
  .replace(/\{المبلغ\}/g, formatMoney(customer.debt));
const parseCreditLimit = (value: string) => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const formatCreditLimit = (value: number | null | undefined) => value == null ? 'مفتوح' : formatMoney(value);

function reportRuntimeError(message: string, error: unknown) {
  console.error(message, error);
}

function stateFromStored(value: unknown): LocalState | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { data?: unknown };
  const candidate = 'data' in record ? record.data : value;
  if (!candidate || typeof candidate !== 'object') return null;
  return migrate(candidate as Partial<LocalState>);
}

function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem('alyousifi-soft-state');
    if (!raw) return demoState();
    return stateFromStored(JSON.parse(raw)) ?? demoState();
  } catch (error) {
    reportRuntimeError('Local data could not be loaded.', error);
    return demoState();
  }
}

type Toast = { message: string; tone?: 'success' | 'error' };
type AppProps = { state: LocalState; setState: React.Dispatch<React.SetStateAction<LocalState>>; toast: (message: string, tone?: Toast['tone']) => void };

function AppShell({ children, state, setState, toast }: AppProps & { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNavItems = state.settings.profitManagementEnabled
    ? [...navItems.slice(0, 4), { href: '/profit', label: 'الأرباح', icon: TrendingUp }, ...navItems.slice(4)]
    : navItems;
  const pageTitle = visibleNavItems.find((item) => item.href === location)?.label ?? (location.startsWith('/customers/') ? 'ملف العميل' : 'اليوسفي سوفت');
  const today = new Intl.DateTimeFormat('ar-YE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const toggleTheme = () => setState((s) => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === 'light' ? 'dark' : 'light' } }));
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="hidden lg:flex fixed inset-y-0 right-0 z-30 w-72 flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))]">
        <Link href="/" data-testid="link-brand" className="mb-10 flex items-center gap-3 px-3 text-right">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-lg"><Zap size={23} fill="currentColor" /></span>
          <span><strong className="block text-xl">اليوسفي سوفت</strong><small className="mt-0.5 block text-xs text-white/50">دفتر البيع الذكي</small></span>
        </Link>
        <nav className="space-y-1.5">
          {visibleNavItems.map(({ href, label, icon: Icon }) => (
            <Link href={href} data-testid={`link-nav-${href.replace('/', '') || 'home'}`} key={href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${location === href ? 'bg-white/12 text-white shadow-inner' : 'text-white/60 hover:bg-white/8 hover:text-white'}`}>
              <Icon size={19} strokeWidth={location === href ? 2.5 : 1.8} /><span>{label}</span>{location === href && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs text-white/50">حالة التطبيق</p><div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-[#83b97a]" /> يعمل محلياً بدون إنترنت</div>
          <p className="mt-2 text-xs text-white/40">النسخة {APP_VERSION}</p>
        </div>
      </aside>
      {state.settings.showTopBar && <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur lg:mr-72">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3"><button data-testid="button-open-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="فتح قائمة التنقل" className="rounded-xl p-2 hover:bg-muted"><Menu size={21} /></button><div><p aria-label="التاريخ واليوم" className="text-xs text-muted-foreground">{today}</p><h1 className="text-xl font-bold tracking-tight">{pageTitle}</h1></div></div>
          <div className="flex items-center gap-2"><button data-testid="button-toggle-theme" onClick={toggleTheme} className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition hover:text-foreground">{state.settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button><div className="hidden h-9 w-px bg-border sm:block" /><span className="hidden text-sm font-semibold sm:block">صاحب المحل</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))]">ص</span></div>
        </div>
        {menuOpen && <div className="border-t border-border bg-card p-3"><nav className="grid grid-cols-3 gap-1">{visibleNavItems.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} href={href} key={href} data-testid={`link-mobile-${href.replace('/', '') || 'home'}`} className={`flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] ${location === href ? 'bg-muted font-bold text-[hsl(var(--accent))]' : 'text-muted-foreground'}`}><Icon size={18} />{label}</Link>)}</nav></div>}
      </header>}
      <main className="mx-auto max-w-[1440px] px-4 pb-32 pt-5 sm:px-7 lg:mr-72 lg:pt-8">{children}</main>
      <nav aria-label="التنقل الرئيسي" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pt-2 backdrop-blur"><div className={`mx-auto grid max-w-3xl gap-1 ${visibleNavItems.length === 7 ? 'grid-cols-7' : 'grid-cols-6'}`}>{visibleNavItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} data-testid={`link-bottom-${href.replace('/', '') || 'home'}`} className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] ${location === href ? 'font-bold text-[hsl(var(--accent))]' : 'text-muted-foreground'}`}><Icon size={20} />{label}{location === href && <span className="absolute -top-2 h-1 w-5 rounded-full bg-[hsl(var(--accent))]" />}</Link>)}</div></nav>
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone = 'ink', detail }: { title: string; value: string; icon: typeof Wallet; tone?: 'ink' | 'orange' | 'red' | 'teal' | 'cream'; detail?: string }) {
  const styles = {
    ink: 'border border-blue-200 bg-blue-50 text-blue-900 dark:border-[#27506a] dark:bg-[#172d3b] dark:text-[#dbeafe]',
    cream: 'border border-[#ddd1bb] bg-[#eee6d5] text-[#685b42] dark:border-[#6c5d3c] dark:bg-[#403827] dark:text-[#ffedc2]',
    orange: 'border border-[#e3c19c] bg-[#f4e0ca] text-[#9e531b] dark:border-[#7d4b32] dark:bg-[#492b1e] dark:text-[#ffdbc2]',
    red: 'border border-[#e6b7b0] bg-[#f1d8d2] text-[#8e4037] dark:border-[#713b37] dark:bg-[#432726] dark:text-[#ffd9d2]',
    teal: 'border border-[#b9d8d5] bg-[#d7e6e4] text-[#336d6b] dark:border-[#2b6461] dark:bg-[#173b3a] dark:text-[#d4f4ef]',
  };
  const secondaryText = 'text-current/75 dark:text-slate-300';
  return <div data-testid={`metric-${title}`} className={`rounded-2xl p-4 shadow-[var(--shadow-sm)] ${styles[tone]} lift`}><div className="flex items-start justify-between gap-2"><span className={`text-xs ${secondaryText}`}>{title}</span><span className="rounded-lg bg-black/8 p-2 dark:bg-white/10"><Icon size={18} /></span></div><p className="mt-5 text-[1.35rem] font-bold text-[#d95f12] dark:text-[#fb923c] font-mono-app">{value}</p>{detail && <p className={`mt-1 text-[11px] ${secondaryText}`}>{detail}</p>}</div>;
}
function OverviewCard({ title, value, subtitle, details, icon: Icon, tone }: { title: string; value: string; subtitle?: string; details?: string[]; icon: typeof Wallet; tone: 'emerald' | 'amber' | 'rose' | 'blue' }) {
  const styles = {
    emerald: 'bg-[#d9eee4] text-[#286b55] dark:bg-[#163b35] dark:text-[#d7f5e7]',
    amber: 'bg-[#f6e4ca] text-[#8a4e16] dark:bg-[#49331c] dark:text-[#ffedc4]',
    rose: 'bg-[#f3d9dc] text-[#8a3f4a] dark:bg-[#4a272c] dark:text-[#ffd9de]',
    blue: 'bg-[#dce4f5] text-[#3f527e] dark:bg-[#253454] dark:text-[#dbe6ff]',
  };
  return <article data-testid={`overview-card-${title}`} className={`rounded-2xl p-4 shadow-[var(--shadow-sm)] ${styles[tone]}`}><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-current">{title}</h3>{subtitle && <p className="mt-1 text-[11px] text-current/75 dark:text-[#cbd5e1]">{subtitle}</p>}</div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/10 dark:bg-white/10"><Icon size={18} /></span></div><strong className="mt-5 block text-xl font-bold text-[#d95f12] dark:text-[#fb923c] font-mono-app">{value}</strong>{details?.map(detail => <p key={detail} className="mt-2 text-[11px] font-medium text-current/80 dark:text-[#cbd5e1]">{detail}</p>)}</article>;
}
function SectionTitle({ title, action, onAction, actionLabel = 'إضافة' }: { title: string; action?: ReactNode; onAction?: () => void; actionLabel?: string }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>{onAction ? <button data-testid={`button-add-${title}`} onClick={onAction} className="flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90"><Plus size={15} />{actionLabel}</button> : action}</div>;
}
function AccordionLog({ title, count, children, action }: { title: string; count: number; children: ReactNode; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className="overflow-hidden rounded-2xl border border-card-border bg-card p-5" data-testid={`accordion-${title}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-right" data-testid={`button-toggle-${title}`}>
      <span className="flex min-w-0 items-center gap-3"><span className="truncate text-lg font-bold">{title}</span><span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{formatNumber(count)} {count === 1 ? 'عملية' : 'عمليات'}</span></span>
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">{action}<ChevronDown size={19} className={`transition-transform duration-300 ${open ? 'rotate-180 text-[hsl(var(--accent))]' : ''}`} /></span>
    </button>
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} aria-hidden={!open}>
      <div className="min-h-0 overflow-hidden"><div className="pt-4">{children}</div></div>
    </div>
  </section>;
}
function SettingsAccordion({ title, description, icon: Icon, testId, children }: { title: string; description: string; icon: typeof SettingsIcon; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800" data-testid={testId}>
    <button type="button" aria-expanded={open} aria-controls={`${testId}-content`} onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-right transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[hsl(var(--accent))] dark:bg-slate-700 dark:text-[#f2bd88]"><Icon size={19} /></span>
        <span className="min-w-0"><strong className="block text-sm font-bold text-slate-900 dark:text-white">{title}</strong><small className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-300">{description}</small></span>
      </span>
      <ChevronDown size={19} className={`shrink-0 text-slate-500 transition-transform duration-300 dark:text-slate-300 ${open ? 'rotate-180 text-[hsl(var(--accent))] dark:text-[#f2bd88]' : ''}`} />
    </button>
    <div id={`${testId}-content`} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="min-h-0 overflow-hidden"><div className="border-t border-slate-200 p-5 dark:border-slate-700">{children}</div></div>
    </div>
  </section>;
}
function SettingsTemplateEditor({ value, onCommit, testId, rows, placeholder, hint }: { value: string; onCommit: (value: string) => void; testId: string; rows: number; placeholder?: string; hint: ReactNode }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return <div>
    <textarea data-testid={testId} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} rows={rows} placeholder={placeholder} className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-[hsl(var(--accent))] dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-300">{hint}</p>
  </div>;
}
function SettingsBackupLimit({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const commit = () => {
    const parsed = Number(draft);
    const nextValue = Number.isFinite(parsed) && parsed >= 1
      ? Math.min(1000, Math.floor(parsed))
      : value;
    setDraft(String(nextValue));
    if (nextValue !== value) onCommit(nextValue);
  };
  return <label className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
    <input data-testid="input-max-auto-backups" type="number" min="1" max="1000" inputMode="numeric" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-center outline-none transition focus:border-[hsl(var(--accent))] dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
    نسخة
  </label>;
}
function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-0"><span className="text-sm text-white/70 dark:text-[#cbd5e1]">{label}</span><strong className={`shrink-0 text-base font-bold font-mono-app ${accent ? 'text-[#f2bd88] dark:text-white' : 'text-white'}`}>{value}</strong></div>;
}
function cardGradient(index: number) {
  const [from, to] = cardPalettes[index % cardPalettes.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
function Empty({ title, text, icon: Icon = PackageOpen }: { title: string; text: string; icon?: typeof PackageOpen }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon size={22} /></span><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}
function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const focusInitialControl = () => {
      const control = dialogRef.current?.querySelector<HTMLElement>('[autofocus]')
        ?? dialogRef.current?.querySelector<HTMLElement>('input, select, textarea')
        ?? dialogRef.current?.querySelector<HTMLElement>('button');
      control?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(focusInitialControl);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[100] grid min-h-[100dvh] place-items-center overflow-y-auto bg-[rgba(0,0,0,0.6)] p-5 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) event.preventDefault(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()} className="animate-pop my-auto max-h-[calc(100dvh-2.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-bold">{title}</h2><button data-testid="button-close-modal" onClick={close} aria-label="إغلاق الحوار" className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-muted"><X size={19} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
type BulkSmsProgress = {
  status: 'sending' | 'done';
  targetLabel: string;
  total: number;
  completed: number;
  failed: number;
  currentName?: string;
};
function BulkSmsProgressModal({ progress, close }: { progress: BulkSmsProgress; close: () => void }) {
  const percentage = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  return <Modal title="إرسال الرسائل الجماعية SMS" close={progress.status === 'sending' ? () => undefined : close}>
    <div data-testid="bulk-sms-progress-modal" className="space-y-5">
      <div className="rounded-2xl bg-[#d7e6e4] p-4 text-[#285f5d] dark:bg-[#1d3030] dark:text-[#b6d8d4]">
        <div className="flex items-center justify-between gap-3">
          <div><strong className="block">{progress.targetLabel}</strong><p className="mt-1 text-xs">سيتم إرسال الرسائل من خلال تطبيق Android مباشرة.</p></div>
          <Smartphone size={24} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 text-sm font-bold"><span>{progress.status === 'sending' ? `جاري إرسال ${formatNumber(progress.completed + 1)} من ${formatNumber(progress.total)}...` : 'اكتمل الإرسال'}</span><span className="font-mono-app">{percentage}%</span></div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(var(--accent))] transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>تمت المعالجة</span><strong>{formatNumber(progress.completed)} / {formatNumber(progress.total)}</strong></div>
      {progress.failed > 0 && <p className="rounded-xl bg-[#fdf3f1] p-3 text-sm text-[#a4493e] dark:bg-[#2b1c1a]">تعذر إرسال {formatNumber(progress.failed)} رسالة. يمكنك مراجعة الأرقام أو الصلاحيات.</p>}
      {progress.currentName && progress.status === 'sending' && <p className="text-center text-xs text-muted-foreground">آخر جهة اتصال: {progress.currentName}</p>}
      {progress.status === 'done' && <button type="button" data-testid="button-close-bulk-sms-progress" onClick={close} className="w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">إغلاق</button>}
    </div>
  </Modal>;
}
function markReleaseNotesSeen() {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
  } catch (error) {
    console.warn('Release notes version could not be saved.', error);
  }
}
function ReleaseNotesModal({ close }: { close: () => void }) {
  return <Modal title="سجل التحديثات والتطويرات" close={close}>
    <div data-testid="release-notes-modal" className="space-y-4">
      <div className="rounded-2xl bg-[#d7e6e4] p-4 text-[#285f5d] dark:bg-[#1d3030] dark:text-[#b6d8d4]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70 text-[#38817c] dark:bg-black/20"><Sparkles size={19} /></span>
          <div><strong className="block">آخر التطويرات</strong><p className="mt-1 text-xs leading-6">نستمر في تحسين اليوسفي سوفت ليكون أسرع وأسهل وأكثر أماناً لبياناتك.</p></div>
        </div>
      </div>
      <div className="space-y-3">
        {sortedChangelog.map(entry => <article key={entry.version} className="rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><h3 className="font-bold">{entry.version}</h3>{entry.isLatest && <span className="rounded-full bg-[#238b57] px-2.5 py-1 text-[10px] font-extrabold text-white">جديد NEW</span>}</div>
            <time dateTime={entry.date} className="text-xs text-muted-foreground">{entry.date}</time>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{entry.features.map(feature => <li key={feature} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))]" />{feature}</li>)}</ul>
        </article>)}
      </div>
      <button type="button" data-testid="button-close-release-notes" onClick={close} className="w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">حسناً، إغلاق</button>
    </div>
  </Modal>;
}
const Field = forwardRef<HTMLInputElement, { label: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, ...props }, ref) => (
  <label className="block space-y-1.5 text-sm"><span className="font-semibold">{label}</span><input ref={ref} {...props} data-testid={`input-${label}`} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent))]/15" /></label>
));
Field.displayName = 'Field';
function SelectField({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className="block space-y-1.5 text-sm"><span className="font-semibold">{label}</span><select {...props} data-testid={`select-${label}`} className="w-full rounded-xl border border-input bg-background px-3.5 py-3 outline-none focus:border-[hsl(var(--accent))]">{children}</select></label>;
}
function Buttons({ onCancel, saveLabel = 'حفظ', disabled = false }: { onCancel: () => void; saveLabel?: string; disabled?: boolean }) {
  return <div className="mt-6 flex gap-2"><button data-testid="button-save-form" disabled={disabled} className="flex-1 rounded-xl bg-[hsl(var(--accent))] px-4 py-3 font-bold text-[hsl(var(--accent-foreground))] disabled:opacity-50">{saveLabel}</button><button type="button" data-testid="button-cancel-form" onClick={onCancel} className="rounded-xl border border-border px-5 py-3 font-semibold text-muted-foreground">إلغاء</button></div>;
}

function Dashboard({ state, toast }: AppProps) {
  const todaySales = state.sales.filter((s) => isToday(s.createdAt));
  const todayCreditSales = todaySales.filter((sale) => sale.paymentType === 'credit').reduce((a, sale) => a + sale.total, 0);
  const todayCashSales = todaySales.filter((sale) => sale.paymentType === 'cash').reduce((a, sale) => a + sale.total, 0);
  const cardsSoldToday = todaySales.reduce((a, sale) => a + sale.quantity, 0);
  const collectedDebtsToday = state.payments.filter((payment) => isToday(payment.createdAt)).reduce((a, payment) => a + payment.amount, 0);
  const todaySaleValue = todaySales.reduce((a, sale) => a + sale.total, 0);
  const todayNetProfit = todaySales.reduce((a, sale) => a + sale.profit, 0);
  const todayLabel = new Intl.DateTimeFormat('ar-YE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const activities = [
    ...state.sales.map((s) => ({ id: s.id, date: s.createdAt, title: `بيع ${state.cards.find((c) => c.id === s.cardTypeId)?.name ?? 'كرت'}`, sub: s.paymentType === 'cash' ? 'بيع نقدي' : `آجل · ${state.customers.find((c) => c.id === s.customerId)?.name ?? ''}`, value: s.total, positive: s.paymentType === 'cash', icon: ShoppingCart })),
    ...state.payments.map((p) => ({ id: p.id, date: p.createdAt, title: 'تحصيل من عميل', sub: state.customers.find((c) => c.id === p.customerId)?.name ?? '', value: p.amount, positive: true, icon: ArrowDownLeft })),
    ...state.withdrawals.map((w) => ({ id: w.id, date: w.createdAt, title: 'سحب من الصندوق', sub: w.note, value: w.amount, positive: false, icon: ArrowUpRight })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5);
  return <div className="animate-appear space-y-7">
     <div className="relative overflow-hidden rounded-3xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-md)] dark:bg-slate-800 dark:text-white sm:p-8"><div className="absolute -left-12 -top-24 h-64 w-64 rounded-full border-[28px] border-white/5" /><div className="absolute -bottom-24 right-1/3 h-48 w-48 rounded-full border-[20px] border-[hsl(var(--accent))]/20" /><div className="relative"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-[hsl(var(--accent))] dark:text-white"><CalendarDays size={17} /><span className="text-xs font-bold tracking-wide">ملخص اليوم</span></div><time dateTime={new Date().toISOString().slice(0, 10)} className="text-xs font-semibold text-[#cbd5e1]">{todayLabel}</time></div><p className="text-sm font-semibold text-[#cbd5e1]">إجمالي الدخل النقدي اليومي</p><h2 data-testid="text-daily-cash-income" className="mt-2 text-3xl font-bold text-[#f97316] font-mono-app sm:text-4xl">{formatMoney(todayCashSales + collectedDebtsToday)}</h2><p className="mt-3 text-sm text-[#cbd5e1]">مبيعات نقدية اليوم + تحصيلات ديون العملاء اليوم</p></div></div>
    <section aria-label="تفاصيل اليوم" dir="rtl" className="grid grid-cols-2 gap-3"><OverviewCard title="مبيعات اليوم نقداً" value={formatMoney(todayCashSales)} icon={Wallet} tone="emerald" /><OverviewCard title="مبيعات اليوم دين" value={formatMoney(todayCreditSales)} icon={Users} tone="amber" /><OverviewCard title="دين تم تسديده اليوم" value={formatMoney(collectedDebtsToday)} icon={Landmark} tone="rose" /><OverviewCard title="مبيعات اليوم" value={`${formatNumber(cardsSoldToday)} كرت`} details={[`إجمالي قيمة البيع: ${formatMoney(todaySaleValue)}`, `صافي الربح: ${formatMoney(todayNetProfit)}`]} icon={Boxes} tone="blue" /></section>
    <AccordionLog title="آخر النشاطات" count={activities.length}>{activities.length ? <div className="space-y-1">{activities.map((item) => { const Icon = item.icon; return <div data-testid={`activity-${item.id}`} key={item.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.positive ? 'bg-[#d7e6e4] text-[#336d6b]' : 'bg-[#f1d8d2] text-[#a4493e]'}`}><Icon size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-[11px] text-muted-foreground">{item.sub} · {dayLabel(item.date)}</p></div><span className={`text-sm font-bold font-mono-app ${item.positive ? 'text-[#38817c]' : 'text-[#b25449]'}`}>{item.positive ? '+' : '-'}{formatMoney(item.value)}</span></div>; })}</div> : <Empty title="لا توجد حركة" text="ستظهر العمليات هنا تلقائياً" icon={Activity} />}</AccordionLog>
  </div>;
}

function Sales({ state, setState, toast }: AppProps) {
  const [modal, setModal] = useState(false); const [selected, setSelected] = useState<CardType | null>(null); const [qty, setQty] = useState(1); const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash'); const [customerId, setCustomerId] = useState(''); const [saleSearch, setSaleSearch] = useState(''); const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false); const saleSearchRef = useRef<HTMLInputElement>(null);
  const open = (card: CardType) => { setSelected(card); setQty(1); setPaymentType('cash'); setCustomerId(''); setSaleSearch(''); setShowCustomerSuggestions(false); setModal(true); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!selected) return; if (qty > selected.quantity) { toast('الكمية المطلوبة أكبر من المخزون المتاح', 'error'); return; } if (paymentType === 'credit' && !customerId) { toast('اختر عميلاً للبيع الآجل', 'error'); return; } const customer = state.customers.find(c => c.id === customerId); if (paymentType === 'credit' && customer && customer.creditLimit != null && customer.debt + selected.sellingPrice * qty > customer.creditLimit) { toast('تجاوز البيع الحد الاقصى للدين للعميل', 'error'); return; } const sale: Sale = { id: uid('sale'), cardTypeId: selected.id, customerId: paymentType === 'credit' ? customerId : undefined, quantity: qty, total: selected.sellingPrice * qty, profit: selected.profit * qty, paymentType, createdAt: new Date().toISOString() }; setState(s => ({ ...s, cards: s.cards.map(c => c.id === selected.id ? { ...c, quantity: c.quantity - qty } : c), customers: s.customers.map(c => c.id === customerId && paymentType === 'credit' ? { ...c, debt: c.debt + sale.total } : c), sales: [sale, ...s.sales] })); toast(paymentType === 'cash' ? 'تم تسجيل البيع واستلام المبلغ' : 'تم تسجيل البيع الآجل'); setModal(false); };
  const todaySales = state.sales.filter(s => isToday(s.createdAt));
  return <div className="animate-appear space-y-6"><div><p className="text-sm text-muted-foreground">اختر نوع الكرت لإتمام العملية</p><h2 className="mt-1 text-2xl font-bold">نقطة البيع</h2></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{state.cards.map((card, index) => <button disabled={!card.quantity} data-testid={`card-sale-${card.id}`} key={card.id} onClick={() => open(card)} style={{ background: cardGradient(index) }} className={`group lift relative overflow-hidden rounded-2xl p-5 text-right text-white shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-50 ${!card.quantity ? 'grayscale' : ''}`}><div className="flex items-start justify-between gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20"><CreditCard size={19} /></span><span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white">{card.quantity === 0 ? 'انتهت الكمية' : `${formatNumber(card.quantity)} متوفر`}</span></div><h3 className="mt-12 text-base font-bold">{card.name}</h3></button>)}</div>{!state.cards.length && <Empty title="لا توجد كروت" text="أضف كرتاً من المخزون لبدء البيع" icon={CreditCard} />}<AccordionLog title="مبيعات اليوم" count={todaySales.length}>{todaySales.length ? <div className="space-y-2">{todaySales.map(s => <div data-testid={`sale-row-${s.id}`} key={s.id} className="flex items-center gap-3 rounded-xl bg-muted/45 p-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground"><Receipt size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{state.cards.find(c => c.id === s.cardTypeId)?.name}</p><p className="text-xs text-muted-foreground">{s.paymentType === 'cash' ? 'نقدي' : `آجل · ${state.customers.find(c => c.id === s.customerId)?.name}`} · {dayLabel(s.createdAt)}</p></div><span className="font-bold font-mono-app">{formatMoney(s.total)}</span></div>)}</div> : <Empty title="لم تبدأ مبيعات اليوم" text="اضغط على كرت أعلاه لتسجيل أول عملية" icon={Receipt} />}</AccordionLog>
      {modal && selected && <Modal title={`بيع كرت ${selected.name}`} close={() => setModal(false)}><form onSubmit={submit}><div className="rounded-2xl bg-muted p-4"><div className="flex justify-between"><span className="text-sm text-muted-foreground">سعر الكرت</span><strong className="font-mono-app">{formatMoney(selected.sellingPrice)}</strong></div><div className="mt-2 flex justify-between"><span className="text-sm text-muted-foreground">المتاح</span><strong>{formatNumber(selected.quantity)} كرت</strong></div></div><div className="mt-5"><p className="mb-2 text-sm font-semibold">طريقة الدفع</p><div className="grid grid-cols-2 gap-2">{(['cash', 'credit'] as const).map(type => <button type="button" key={type} data-testid={`button-payment-${type}`} onClick={() => { setPaymentType(type); if (type === 'cash') setShowCustomerSuggestions(false); }} className={`rounded-xl border p-3 text-sm font-bold ${paymentType === type ? 'border-[hsl(var(--accent))] bg-[#f4e0ca] text-[#9e531b] dark:bg-[#55351f] dark:text-[#f2bd88]' : 'border-border'}`}>{type === 'cash' ? 'نقدي' : 'آجل'}</button>)}</div></div>{paymentType === 'credit' && <div className="relative mt-4"><Field ref={saleSearchRef} label="ابحث عن العميل" value={saleSearch} onChange={e => { const value = e.target.value; setSaleSearch(value); setShowCustomerSuggestions(Boolean(value.trim())); }} placeholder="اكتب الاسم..." data-testid="input-sale-customer" />{showCustomerSuggestions && saleSearch.trim() && state.customers.filter(c => c.name.includes(saleSearch)).length > 0 && <div className="absolute inset-x-0 top-[74px] z-10 rounded-xl border border-border bg-card p-1 shadow-lg">{state.customers.filter(c => c.name.includes(saleSearch)).map(c => <button type="button" key={c.id} data-testid={`button-select-customer-${c.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCustomerId(c.id); setSaleSearch(c.name); setShowCustomerSuggestions(false); saleSearchRef.current?.focus(); }} className={`flex w-full justify-between rounded-lg p-2 text-right text-sm hover:bg-muted ${customerId === c.id ? 'bg-muted' : ''}`}><span>{c.name}</span><span className="text-xs text-muted-foreground">{formatMoney(c.debt)}</span></button>)}</div>}</div>}<div className="mt-5 flex items-center justify-between rounded-2xl border border-border p-3"><span className="text-sm font-semibold">الكمية</span><div className="flex items-center gap-4"><button type="button" data-testid="button-decrement-quantity" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-lg font-bold">−</button><strong data-testid="text-sale-quantity" className="w-6 text-center text-lg font-mono-app">{formatNumber(qty)}</strong><button type="button" data-testid="button-increment-quantity" onClick={() => setQty(Math.min(selected.quantity, qty + 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))]">+</button></div></div><div className="mt-5 flex items-center justify-between"><span className="font-semibold">الإجمالي</span><strong className="text-2xl text-[hsl(var(--accent))] font-mono-app">{formatMoney(selected.sellingPrice * qty)}</strong></div><Buttons onCancel={() => setModal(false)} saveLabel="تأكيد البيع" /></form></Modal>}</div>;
}

function Customers({ state, setState, toast }: AppProps) {
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', creditLimit: '' });
  const [contactNote, setContactNote] = useState('');
  const [bulkSummary, setBulkSummary] = useState<{ imported: number; duplicates: string[] } | null>(null);
  const [bulkContacts, setBulkContacts] = useState<DeviceContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [contactsBusy, setContactsBusy] = useState(false);
  const contactListRef = useRef<HTMLDivElement>(null);
  const [contactScrollTop, setContactScrollTop] = useState(0);
  const contactRowHeight = 68;
  const contactViewportHeight = 288;
  const deferredContactSearch = useDeferredValue(contactSearch);
  const indexedBulkContacts = useMemo(() => bulkContacts.map(contact => ({
    contact,
    name: normalizeName(contact.name),
    phone: normalizePhone(contact.phone),
  })), [bulkContacts]);
  const filteredBulkContacts = useMemo(() => {
    const text = normalizeName(deferredContactSearch);
    const phone = normalizePhone(deferredContactSearch);
    if (!text && !phone) return indexedBulkContacts;
    return indexedBulkContacts.filter(item => item.name.includes(text) || Boolean(phone && item.phone.includes(phone)));
  }, [deferredContactSearch, indexedBulkContacts]);
  const contactVisibleStart = Math.max(0, Math.floor(contactScrollTop / contactRowHeight) - 4);
  const contactVisibleEnd = Math.min(
    filteredBulkContacts.length,
    Math.ceil((contactScrollTop + contactViewportHeight) / contactRowHeight) + 4,
  );
  const visibleBulkContacts = filteredBulkContacts.slice(contactVisibleStart, contactVisibleEnd);
  useEffect(() => {
    setContactScrollTop(0);
    contactListRef.current?.scrollTo({ top: 0 });
  }, [deferredContactSearch]);
  const filtered = state.customers.filter(c => `${c.name} ${c.phone}`.includes(query)).sort((a, b) => b.debt - a.debt);
  const openForm = (customer?: Customer) => {
    setContactNote('');
    setEditing(customer ?? null);
    setForm(customer ? { name: customer.name, phone: customer.phone, creditLimit: customer.creditLimit == null ? '' : String(customer.creditLimit) } : { name: '', phone: '', creditLimit: '' });
    setModal(customer ? 'edit' : 'add');
  };
  const pickContact = async () => {
    setContactNote('');
    try {
      const contact = await pickDeviceContact();
      if (contact) setForm(f => ({ ...f, name: contact.name, phone: contact.phone }));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setContactNote(code === 'CONTACTS_PERMISSION_DENIED'
        ? 'يجب السماح للتطبيق بالوصول إلى جهات الاتصال من إعدادات الجهاز'
        : code === 'CONTACTS_UNAVAILABLE'
          ? 'جهازك لا يدعم اختيار جهات الاتصال، أدخل الرقم يدوياً'
          : 'تم إلغاء اختيار جهة الاتصال');
    }
  };
  const openBulkImport = async () => {
    setContactsBusy(true);
    try {
      const contacts = await getDeviceContacts();
      if (!contacts.length) { toast('لم يتم العثور على جهات اتصال تحتوي على اسم ورقم هاتف', 'error'); return; }
      setBulkContacts(contacts);
      setSelectedContactIds(new Set());
      setContactSearch('');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      toast(code === 'CONTACTS_PERMISSION_DENIED'
        ? 'اسمح للتطبيق بالوصول إلى جهات الاتصال لاستيرادها'
        : code === 'CONTACTS_UNAVAILABLE'
          ? 'جهازك لا يدعم استيراد جهات الاتصال'
          : 'تعذر قراءة جهات الاتصال أو تم إلغاء العملية', 'error');
    } finally {
      setContactsBusy(false);
    }
  };
  const importContacts = () => {
    const selectedContacts = bulkContacts.filter(contact => selectedContactIds.has(contact.id));
    if (!selectedContacts.length) { toast('اختر جهة اتصال واحدة على الأقل', 'error'); return; }
    const names = new Set(state.customers.map(c => normalizeName(c.name)));
    const phones = new Set(state.customers.map(c => normalizePhone(c.phone)).filter(Boolean));
    const imported: Customer[] = [];
    const duplicates: string[] = [];
    for (const contact of selectedContacts) {
        const name = contact.name.trim();
        const phone = contact.phone.trim();
        if (!name || !phone) continue;
        const nameKey = normalizeName(name);
        const phoneKey = normalizePhone(phone);
        const reasons = [];
        if (names.has(nameKey)) reasons.push('الاسم موجود');
        if (phones.has(phoneKey)) reasons.push('رقم الهاتف موجود');
        if (reasons.length) { duplicates.push(`${name} — ${reasons.join(' و ')}`); continue; }
        names.add(nameKey); phones.add(phoneKey);
        imported.push({ id: uid('customer'), name, phone, creditLimit: null, debt: 0 });
      }
      if (imported.length) setState(s => ({ ...s, customers: [...imported, ...s.customers] }));
      setBulkContacts([]);
      setSelectedContactIds(new Set());
      setContactSearch('');
      setBulkSummary({ imported: imported.length, duplicates });
      if (!duplicates.length) toast(`تم استيراد ${formatNumber(imported.length)} عميل`);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone) { toast('أكمل اسم العميل ورقم الهاتف', 'error'); return; }
    const duplicateName = state.customers.some(c => c.id !== editing?.id && normalizeName(c.name) === normalizeName(name));
    const duplicatePhone = state.customers.some(c => c.id !== editing?.id && normalizePhone(c.phone) === normalizePhone(phone));
    if (duplicateName) { toast('اسم العميل موجود مسبقاً', 'error'); return; }
    if (duplicatePhone) { toast('رقم الهاتف مستخدم مسبقاً', 'error'); return; }
    const creditLimit = parseCreditLimit(form.creditLimit);
    if (editing) setState(s => ({ ...s, customers: s.customers.map(c => c.id === editing.id ? { ...c, name, phone, creditLimit } : c) }));
    else setState(s => ({ ...s, customers: [{ id: uid('customer'), name, phone, creditLimit, debt: 0 }, ...s.customers] }));
    toast(editing ? 'تم تحديث بيانات العميل' : 'تمت إضافة العميل');
    setModal(null);
  };
  const remove = (c: Customer) => { if (c.debt > 0) { toast('لا يمكن حذف عميل عليه دين', 'error'); return; } if (window.confirm(`حذف العميل ${c.name}؟`)) { setState(s => ({ ...s, customers: s.customers.filter(x => x.id !== c.id) })); toast('تم حذف العميل'); } };
  return <div className="animate-appear space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">{formatNumber(state.customers.length)} عملاء مسجلون</p><h2 className="mt-1 text-2xl font-bold">العملاء</h2></div><div className="flex flex-wrap gap-2"><button data-testid="button-bulk-import-contacts" onClick={openBulkImport} disabled={contactsBusy} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold disabled:opacity-50"><ContactRound size={17} /> {contactsBusy ? 'جارٍ قراءة جهات الاتصال...' : 'استيراد جماعي'}</button><button data-testid="button-add-customer" onClick={() => openForm()} className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Plus size={17} /> عميل جديد</button></div></div><div className="relative"><Search className="absolute right-4 top-3.5 text-muted-foreground" size={18} /><input data-testid="input-search-customers" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." className="w-full rounded-2xl border border-input bg-card py-3.5 pr-11 pl-4 outline-none focus:border-[hsl(var(--accent))]" /></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(c => <Link href={`/customers/${c.id}`} data-testid={`card-customer-${c.id}`} key={c.id} className="lift rounded-2xl border border-card-border bg-card p-4 shadow-[var(--shadow-sm)]"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d7e6e4] font-bold text-[#336d6b]">{c.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{c.name}</h3><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone size={12} />{c.phone}</p></div><ChevronLeft size={17} className="text-muted-foreground" /></div><div className="mt-4 flex items-end justify-between border-t border-border/70 pt-3"><div><p className="text-[11px] text-muted-foreground">الدين الحالي</p><p data-testid={`text-customer-debt-${c.id}`} className={`mt-0.5 font-bold font-mono-app ${c.debt ? 'text-[#b25449]' : 'text-[#38817c]'}`}>{formatMoney(c.debt)}</p><p className="mt-1 text-[11px] text-muted-foreground">الحد الاقصى للدين: {formatCreditLimit(c.creditLimit)}</p></div><div className="flex gap-1"><button type="button" data-testid={`button-edit-customer-${c.id}`} onClick={e => { e.preventDefault(); openForm(c); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Edit3 size={15} /></button><button type="button" data-testid={`button-delete-customer-${c.id}`} onClick={e => { e.preventDefault(); remove(c); }} className="rounded-lg p-2 text-muted-foreground hover:bg-[#f1d8d2] hover:text-[#a4493e]"><Trash2 size={15} /></button></div></div></Link>)}</div>{!filtered.length && <Empty title="لم يتم العثور على عميل" text="أضف عميلاً جديداً أو غيّر كلمات البحث" icon={ContactRound} />}{modal && <Modal title={editing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'} close={() => setModal(null)}><form onSubmit={save} className="space-y-4"><Field label="اسم العميل" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: أحمد علي" data-testid="input-customer-name" /><div><Field label="رقم الهاتف" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="777 000 000" data-testid="input-customer-phone" /><button type="button" data-testid="button-pick-contact" onClick={pickContact} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--accent))]"><ContactRound size={15} /> اختيار من جهات الاتصال</button>{contactNote && <p className="mt-1 text-xs text-muted-foreground">{contactNote}</p>}</div><Field label="الحد الاقصى للدين" type="number" min="0" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: e.target.value })} placeholder="اتركه فارغاً ليكون مفتوحاً" data-testid="input-customer-limit" /><p className="text-xs text-muted-foreground">الحد الفارغ يعني أن الدين مفتوح بلا سقف.</p><Buttons onCancel={() => setModal(null)} /></form></Modal>}{bulkContacts.length > 0 && <Modal title="اختيار جهات الاتصال" close={() => { setBulkContacts([]); setSelectedContactIds(new Set()); setContactSearch(''); }}><p className="text-sm text-muted-foreground">حدد جهات الاتصال التي تريد إضافتها كعملاء. سيتم تجاهل الاسم أو الرقم المكرر تلقائياً.</p><div className="sticky top-0 z-10 -mx-5 mt-4 bg-card px-5 pb-3 pt-1 sm:-mx-7 sm:px-7"><label className="relative block"><Search className="absolute right-3 top-3 text-muted-foreground" size={17} /><input autoFocus data-testid="input-search-contact-selection" value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف..." className="w-full rounded-xl border border-input bg-background py-3 pr-10 pl-3 text-sm outline-none focus:border-[hsl(var(--accent))]" /></label></div><div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs"><span>تم تحديد {formatNumber(selectedContactIds.size)} من {formatNumber(bulkContacts.length)}</span><button type="button" data-testid="button-select-all-contacts" onClick={() => setSelectedContactIds(selectedContactIds.size === bulkContacts.length ? new Set() : new Set(bulkContacts.map(contact => contact.id)))} className="font-bold text-[hsl(var(--accent))]">{selectedContactIds.size === bulkContacts.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</button></div><div ref={contactListRef} onScroll={event => setContactScrollTop(event.currentTarget.scrollTop)} className="mt-3 h-72 overflow-y-auto overscroll-contain">{filteredBulkContacts.length ? <div className="relative" style={{ height: filteredBulkContacts.length * contactRowHeight }}>{visibleBulkContacts.map(({ contact }, index) => <label key={contact.id} style={{ top: (contactVisibleStart + index) * contactRowHeight }} className="absolute inset-x-0 flex h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted"><input type="checkbox" data-testid={`checkbox-contact-${contact.id}`} checked={selectedContactIds.has(contact.id)} onChange={() => setSelectedContactIds(current => { const next = new Set(current); if (next.has(contact.id)) next.delete(contact.id); else next.add(contact.id); return next; })} className="h-4 w-4 accent-[hsl(var(--accent))]" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{contact.name}</strong><small className="text-xs text-muted-foreground">{contact.phone}</small></span></label>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">لا توجد جهات اتصال مطابقة للبحث</p>}</div><div className="mt-5 flex gap-2"><button type="button" data-testid="button-confirm-contact-import" onClick={importContacts} disabled={!selectedContactIds.size} className="flex-1 rounded-xl bg-[hsl(var(--accent))] px-4 py-3 text-sm font-bold text-[hsl(var(--accent-foreground))] disabled:opacity-50">إضافة المحدد</button><button type="button" data-testid="button-cancel-contact-import" onClick={() => { setBulkContacts([]); setSelectedContactIds(new Set()); setContactSearch(''); }} className="rounded-xl border border-border px-5 py-3 font-semibold text-muted-foreground">إلغاء</button></div></Modal>}{bulkSummary && <Modal title="ملخص الاستيراد الجماعي" close={() => setBulkSummary(null)}><p className="rounded-xl bg-[#d7e6e4] p-3 text-sm text-[#336d6b]">تمت إضافة {formatNumber(bulkSummary.imported)} عميل، والحد الاقصى للدين مضبوط على مفتوح.</p>{bulkSummary.duplicates.length ? <div className="mt-4"><h3 className="font-bold">جهات اتصال مكررة ({formatNumber(bulkSummary.duplicates.length)})</h3><ul className="mt-2 max-h-52 space-y-2 overflow-y-auto text-sm text-muted-foreground">{bulkSummary.duplicates.map(item => <li key={item} className="rounded-lg bg-muted p-2">{item}</li>)}</ul></div> : <p className="mt-3 text-sm text-muted-foreground">لم يتم العثور على تكرارات.</p>}<div className="mt-5 flex justify-end"><button data-testid="button-close-import-summary" onClick={() => setBulkSummary(null)} className="rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">إغلاق</button></div></Modal>}</div>;
}

function CustomerProfile({ state, setState, toast }: AppProps) {
  const { id } = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const customer = state.customers.find(c => c.id === id); const [paymentOpen, setPaymentOpen] = useState(false); const [amount, setAmount] = useState(''); const [saleCard, setSaleCard] = useState<CardType | null>(null);
  if (!customer) return <Empty title="العميل غير موجود" text="ربما تم حذفه من الجهاز" icon={Users} />;
  const customerSales = state.sales.filter(s => s.customerId === customer.id);
  const customerPayments = state.payments.filter(p => p.customerId === customer.id);
  const customerHistory = [
    ...customerSales.map(s => ({ id: s.id, kind: 'purchase' as const, date: s.createdAt, cardName: state.cards.find(c => c.id === s.cardTypeId)?.name ?? 'كرت', detail: `${dayLabel(s.createdAt)} · ${formatNumber(s.quantity)} كرت`, amount: s.total })),
    ...customerPayments.map(p => ({ id: p.id, kind: 'settlement' as const, date: p.createdAt, cardName: 'تسديد جزء من الدين', detail: dayLabel(p.createdAt), amount: p.amount })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const recordPayment = (value: number) => setState(s => ({ ...s, customers: s.customers.map(c => c.id === customer.id ? { ...c, debt: c.debt - value } : c), payments: [{ id: uid('payment'), customerId: customer.id, amount: value, createdAt: new Date().toISOString() }, ...s.payments] }));
  const pay = (e: React.FormEvent) => { e.preventDefault(); const value = Number(amount); if (!value || value <= 0 || value > customer.debt) { toast('أدخل مبلغاً صحيحاً لا يتجاوز الدين', 'error'); return; } setState(s => ({ ...s, customers: s.customers.map(c => c.id === customer.id ? { ...c, debt: c.debt - value } : c), payments: [{ id: uid('payment'), customerId: customer.id, amount: value, createdAt: new Date().toISOString() }, ...s.payments] })); toast('تم تسجيل التحصيل وزيادة رصيد الصندوق'); setPaymentOpen(false); setAmount(''); };
  const payFull = () => { if (!customer.debt) { toast('لا يوجد دين مستحق على العميل', 'error'); return; } const value = customer.debt; recordPayment(value); toast(`تم تسديد كامل دين ${customer.name}`); };
  const quickSale = () => { if (!saleCard || saleCard.quantity < 1) { toast('هذا الكرت غير متوفر', 'error'); return; } if (customer.creditLimit != null && customer.debt + saleCard.sellingPrice > customer.creditLimit) { toast('تجاوز البيع الحد الاقصى للدين للعميل', 'error'); return; } const sale: Sale = { id: uid('sale'), cardTypeId: saleCard.id, customerId: customer.id, quantity: 1, total: saleCard.sellingPrice, profit: saleCard.profit, paymentType: 'credit', createdAt: new Date().toISOString() }; setState(s => ({ ...s, cards: s.cards.map(c => c.id === saleCard.id ? { ...c, quantity: c.quantity - 1 } : c), customers: s.customers.map(c => c.id === customer.id ? { ...c, debt: c.debt + sale.total } : c), sales: [sale, ...s.sales] })); toast('تمت إضافة الكرت إلى رصيد العميل'); setSaleCard(null); };
  const reminder = async (channel: 'sms' | 'whatsapp') => {
    const text = personalizeMessage(state.settings.reminderText, customer);
    try {
      if (channel === 'whatsapp') {
        await openWhatsApp(customer.phone, text, state.settings.whatsappPackage);
        toast('تم فتح واتساب بالرسالة الجاهزة');
      } else {
        await sendSms(customer.phone, text);
        toast(Capacitor.isNativePlatform() ? 'تم إرسال رسالة SMS في الخلفية' : 'تم فتح تطبيق الرسائل');
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      toast(code === 'SMS_PERMISSION_DENIED'
        ? 'اسمح للتطبيق بإرسال SMS من إعدادات الجهاز'
        : code === 'WHATSAPP_APP_NOT_FOUND'
          ? 'تطبيق واتساب المحدد غير مثبت على الجهاز'
          : 'تعذر إرسال الرسالة أو فتح التطبيق', 'error');
    }
  };
   return <div className="animate-appear space-y-6"><button data-testid="button-back-customers" onClick={() => setLocation('/customers')} className="flex items-center gap-1 text-sm font-bold text-muted-foreground"><ArrowLeft size={17} /> العودة للعملاء</button><section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/90 dark:text-white"><div className="flex flex-col items-start gap-4"><div className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-700 dark:bg-slate-700 dark:text-slate-100">{customer.name.slice(0, 1)}</span><div><h2 className="text-xl font-bold text-slate-900 dark:text-white"> {customer.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300"><Phone size={13} />{customer.phone}</p></div></div><span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-700/50 dark:text-slate-300">الحد الأقصى للدين: {formatCreditLimit(customer.creditLimit)}</span><div className="mt-2"><p className="text-xs text-slate-600 dark:text-slate-300">الدين الحالي</p><p data-testid="text-profile-debt" className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono-app">{formatMoney(customer.debt)}</p></div></div></section><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button data-testid="button-open-payment" onClick={() => setPaymentOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 p-3 text-sm font-bold text-white transition hover:bg-amber-600 dark:bg-amber-500 dark:text-white"><Banknote size={17} /> تسديد جزء من الدين</button><button data-testid="button-pay-full" disabled={!customer.debt} onClick={payFull} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"><Check size={17} className="text-slate-600 dark:text-slate-100" /> تسديد كامل</button><button data-testid="button-open-reminder-sms" onClick={() => reminder('sms')} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"><Phone size={17} className="text-slate-600 dark:text-slate-200" /> رسالة SMS</button><button data-testid="button-open-reminder" onClick={() => reminder('whatsapp')} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"><MessageCircle size={17} className="text-[#318875] dark:text-emerald-300" /> واتساب</button></div><section><SectionTitle title="بيع سريع للعميل" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{state.cards.map(c => <button data-testid={`button-profile-sale-${c.id}`} key={c.id} disabled={!c.quantity} onClick={() => setSaleCard(c)} className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"><span className="block h-1.5 rounded-full" style={{ backgroundColor: c.color }} /><p className="mt-3 text-sm font-bold">{c.name}</p></button>)}</div></section><AccordionLog title="سجل المشتريات والتسديد" count={customerHistory.length}>{customerHistory.length ? <div className="space-y-2">{customerHistory.map(item => <div key={item.id} data-testid={item.kind === 'purchase' ? `profile-sale-${item.id}` : `profile-payment-${item.id}`} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.kind === 'purchase' ? 'bg-[#f1d8d2] text-[#b25449]' : 'bg-[#d7e6e4] text-[#38817c]'}`}>{item.kind === 'purchase' ? <ShoppingCart size={17} /> : <ArrowDownLeft size={17} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.cardName}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div><strong className={`font-mono-app ${item.kind === 'purchase' ? 'text-[#b25449]' : 'text-[#38817c]'}`}>{item.kind === 'purchase' ? '-' : '+'}{formatMoney(item.amount)}</strong></div>)}</div> : <Empty title="لا توجد عمليات" text="سيظهر هنا سجل المشتريات والتسديد" icon={Receipt} />}</AccordionLog>{paymentOpen && <Modal title="تسديد جزء من الدين" close={() => setPaymentOpen(false)}><form onSubmit={pay}><p className="mb-4 text-sm text-muted-foreground">الدين الحالي: <strong className="text-[#b25449]">{formatMoney(customer.debt)}</strong></p><Field label="المبلغ المحصل" type="number" min="1" max={customer.debt} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" data-testid="input-payment-amount" /><div className="mt-2 flex gap-2">{[customer.debt, Math.round(customer.debt / 2)].filter(Boolean).map(n => <button type="button" data-testid={`button-payment-shortcut-${n}`} onClick={() => setAmount(String(n))} key={n} className="rounded-lg bg-muted px-3 py-2 text-xs">{n === customer.debt ? 'تسديد كامل' : 'النصف'}</button>)}</div><Buttons onCancel={() => setPaymentOpen(false)} saveLabel="تسجيل التسديد" /></form></Modal>}{saleCard && <Modal title="تأكيد البيع الآجل" close={() => setSaleCard(null)}><div className="rounded-2xl bg-muted p-4"><p className="font-bold">{saleCard.name}</p><p className="mt-1 text-sm text-muted-foreground">سيضاف إلى دين {customer.name}</p><p className="mt-4 text-xl font-bold text-[hsl(var(--accent))]">{formatMoney(saleCard.sellingPrice)}</p></div><div className="mt-5 flex gap-2"><button data-testid="button-confirm-profile-sale" onClick={quickSale} className="flex-1 rounded-xl bg-[hsl(var(--accent))] px-4 py-3 font-bold">تأكيد بيع الكرت</button><button data-testid="button-cancel-profile-sale" onClick={() => setSaleCard(null)} className="rounded-xl border border-border px-5 py-3">إلغاء</button></div></Modal>}</div>;
}

function Inventory({ state, setState, toast }: AppProps) {
  const [tab, setTab] = useState<'cards' | 'import' | 'returns'>('cards'); const [modal, setModal] = useState<'card' | 'import' | 'return' | null>(null); const [editing, setEditing] = useState<CardType | null>(null); const [form, setForm] = useState({ name: '', price: '', profit: '', color: colors[0] }); const [importForm, setImportForm] = useState({ cardId: '', quantity: '', cost: '' }); const [returnForm, setReturnForm] = useState({ cardId: '', quantity: '' });
  const openCard = (card?: CardType) => { setEditing(card ?? null); setForm(card ? { name: card.name, price: String(card.sellingPrice), profit: String(card.profit), color: card.color } : { name: '', price: '', profit: '', color: colors[0] }); setModal('card'); };
  const saveCard = (e: React.FormEvent) => { e.preventDefault(); if (!form.name || Number(form.price) <= Number(form.profit)) { toast('أدخل اسماً وسعراً أكبر من الربح', 'error'); return; } if (editing) setState(s => ({ ...s, cards: s.cards.map(c => c.id === editing.id ? { ...c, name: form.name, sellingPrice: Number(form.price), profit: Number(form.profit), color: form.color } : c) })); else setState(s => ({ ...s, cards: [{ id: uid('card'), name: form.name, sellingPrice: Number(form.price), profit: Number(form.profit), color: form.color, quantity: 0 }, ...s.cards] })); toast(editing ? 'تم تحديث نوع الكرت' : 'تمت إضافة نوع الكرت'); setModal(null); };
  const importStock = (e: React.FormEvent) => { e.preventDefault(); const card = state.cards.find(c => c.id === importForm.cardId); const quantity = Number(importForm.quantity); if (!card || quantity < 1) { toast('اختر كرتاً وأدخل كمية صحيحة', 'error'); return; } const cost = supplierCost(card); const supply: Supply = { id: uid('supply'), cardTypeId: card.id, quantity, supplierCost: cost, total: cost * quantity, createdAt: new Date().toISOString() }; setState(s => ({ ...s, cards: s.cards.map(c => c.id === card.id ? { ...c, quantity: c.quantity + quantity } : c), supplies: [supply, ...s.supplies] })); toast(`تمت إضافة ${formatNumber(quantity)} كرت للمخزون`); setModal(null); };
  const doReturn = (e: React.FormEvent) => { e.preventDefault(); const card = state.cards.find(c => c.id === returnForm.cardId); const quantity = Number(returnForm.quantity); if (!card || quantity < 1 || quantity > card.quantity) { toast('تحقق من الكرت والكمية المتاحة', 'error'); return; } const total = supplierCost(card) * quantity; const item: ReturnItem = { id: uid('return'), cardTypeId: card.id, quantity, supplierCost: supplierCost(card), total, createdAt: new Date().toISOString() }; setState(s => ({ ...s, cards: s.cards.map(c => c.id === card.id ? { ...c, quantity: c.quantity - quantity } : c), returns: [item, ...s.returns] })); toast('تم تسجيل المرتجع وتعديل حساب المورّد'); setModal(null); };
  const remove = (card: CardType) => { if (card.quantity > 0) { toast('لا يمكن حذف كرت له مخزون', 'error'); return; } if (window.confirm(`حذف ${card.name}؟`)) { setState(s => ({ ...s, cards: s.cards.filter(c => c.id !== card.id) })); toast('تم حذف الكرت'); } };
  const stockSaleValue = state.cards.reduce((total, card) => total + card.quantity * card.sellingPrice, 0);
  const tabs = [{ id: 'cards', label: 'أنواع الكروت' }, { id: 'import', label: 'توريد مخزون' }, { id: 'returns', label: 'مرتجعات' }] as const;
  return <div className="animate-appear space-y-6"><div className="flex items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">الكمية وقيمة المخزون</p><h2 className="mt-1 text-2xl font-bold">المخزون</h2><div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#d7e6e4] px-3 py-2 text-xs font-bold text-[#336d6b]"><span>إجمالي قيمة بيع المخزون بسعر البيع</span><strong className="font-mono-app">{formatMoney(stockSaleValue)}</strong></div></div><button data-testid="button-inventory-action" onClick={() => setModal(tab === 'cards' ? 'card' : tab === 'import' ? 'import' : 'return')} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Plus size={17} /><span>{tab === 'cards' ? 'إضافة نوع كرت' : tab === 'import' ? 'إضافة توريد' : 'تسجيل مرتجع'}</span></button></div><div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">{tabs.map(t => <button data-testid={`button-inventory-tab-${t.id}`} onClick={() => setTab(t.id)} key={t.id} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{t.label}</button>)}</div>{tab === 'cards' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{state.cards.map(card => <div data-testid={`inventory-card-${card.id}`} key={card.id} style={{ borderColor: card.color }} className="rounded-2xl border-2 border-card-border bg-card p-5 shadow-[var(--shadow-sm)]"><div className="flex justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: card.color }}><CreditCard size={19} /></span><div className="flex gap-1"><button data-testid={`button-edit-card-${card.id}`} onClick={() => openCard(card)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Edit3 size={15} /></button><button data-testid={`button-delete-card-${card.id}`} onClick={() => remove(card)} className="rounded-lg p-2 text-muted-foreground hover:bg-[#f1d8d2] hover:text-[#a4493e]"><Trash2 size={15} /></button></div></div><h3 className="mt-5 font-bold">{card.name}</h3><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-muted-foreground">سعر البيع</p><p className="font-bold font-mono-app">{formatMoney(card.sellingPrice)}</p></div><div className="text-left"><p className="text-xs text-muted-foreground">الربح</p><p className="font-bold text-[#38817c] font-mono-app">{formatMoney(card.profit)}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3"><span className="text-xs text-muted-foreground">المخزون</span><span className={`font-bold ${card.quantity < 10 ? 'text-[#b25449]' : ''}`}>{formatNumber(card.quantity)} كرت</span></div></div>)}</div>}{tab === 'import' && <div className="space-y-3">{state.supplies.length ? state.supplies.map(s => <div key={s.id} data-testid={`supply-row-${s.id}`} className="flex items-center gap-3 rounded-2xl border border-card-border bg-card p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7e6e4] text-[#336d6b]"><ArrowDownLeft size={18} /></span><div className="flex-1"><p className="font-bold">{state.cards.find(c => c.id === s.cardTypeId)?.name}</p><p className="text-xs text-muted-foreground">{formatNumber(s.quantity)} كرت · تكلفة {formatMoney(s.supplierCost)} · {dayLabel(s.createdAt)}</p></div><strong className="font-mono-app">{formatMoney(s.total)}</strong></div>) : <Empty title="لا توجد توريدات" text="سجّل أول توريد لزيادة المخزون وحساب المورّد" icon={PackageOpen} />}</div>}{tab === 'returns' && <div className="space-y-3">{state.returns.length ? state.returns.map(r => <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-card-border bg-card p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1d8d2] text-[#a4493e]"><RotateCcw size={18} /></span><div className="flex-1"><p className="font-bold">{state.cards.find(c => c.id === r.cardTypeId)?.name}</p><p className="text-xs text-muted-foreground">{formatNumber(r.quantity)} كرت · {dayLabel(r.createdAt)}</p></div><strong className="text-[#a4493e] font-mono-app">-{formatMoney(r.total)}</strong></div>) : <Empty title="لا توجد مرتجعات" text="كل التوريدات ما زالت في عهدة المحل" icon={RotateCcw} />}</div>}{modal === 'card' && <Modal title={editing ? 'تعديل نوع كرت' : 'إضافة نوع كرت'} close={() => setModal(null)}><form onSubmit={saveCard} className="space-y-4"><Field label="اسم الكرت" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: كرت شبكة ١٠٠" data-testid="input-card-name" /><div className="grid grid-cols-2 gap-3"><Field label="سعر البيع" type="number" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} data-testid="input-card-price" /><Field label="الربح" type="number" required value={form.profit} onChange={e => setForm({ ...form, profit: e.target.value })} data-testid="input-card-profit" /></div><div><p className="mb-2 text-sm font-semibold">لون الكرت</p><div className="grid grid-cols-7 gap-2 sm:flex sm:flex-wrap">{colors.map(color => <button type="button" aria-label={`اختيار لون ${color}`} title={color} data-testid={`button-color-${color}`} key={color} onClick={() => setForm({ ...form, color })} className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${form.color === color ? 'ring-2 ring-offset-2 ring-[hsl(var(--accent))]' : ''}`} style={{ backgroundColor: color }} />)}</div><div className="mt-4 rounded-2xl border-2 bg-card p-3 transition-colors" style={{ borderColor: form.color }}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm" style={{ backgroundColor: form.color }}><CreditCard size={18} /></span><div><p className="text-xs text-muted-foreground">معاينة اللون المحدد</p><p className="mt-1 text-sm font-bold">{form.name || 'اسم الكرت'}</p></div></div></div></div><Buttons onCancel={() => setModal(null)} /></form></Modal>}{modal === 'import' && <Modal title="إضافة توريد للمخزون" close={() => setModal(null)}><form onSubmit={importStock}><SelectField label="نوع الكرت" value={importForm.cardId} onChange={e => { const c = state.cards.find(x => x.id === e.target.value); setImportForm({ ...importForm, cardId: e.target.value, cost: c ? String(supplierCost(c)) : '' }); }} data-testid="select-supply-card"><option value="">اختر الكرت</option>{state.cards.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</SelectField><div className="mt-4 grid grid-cols-2 gap-3"><Field label="الكمية" type="number" min="1" value={importForm.quantity} onChange={e => setImportForm({ ...importForm, quantity: e.target.value })} data-testid="input-supply-quantity" /><Field label="تكلفة الشراء" type="number" readOnly value={importForm.cost} data-testid="input-supply-cost" /></div><p className="mt-3 text-xs text-muted-foreground">تُحسب تلقائياً: سعر البيع − الربح، ولا يمكن تعديلها أثناء التوريد.</p><Buttons onCancel={() => setModal(null)} saveLabel="تسجيل التوريد" /></form></Modal>}{modal === 'return' && <Modal title="تسجيل مرتجع للمورّد" close={() => setModal(null)}><form onSubmit={doReturn}><SelectField label="نوع الكرت" value={returnForm.cardId} onChange={e => setReturnForm({ ...returnForm, cardId: e.target.value })} data-testid="select-return-card"><option value="">اختر الكرت</option>{state.cards.filter(c => c.quantity > 0).map(c => <option value={c.id} key={c.id}>{c.name} · {formatNumber(c.quantity)} متوفر</option>)}</SelectField><div className="mt-4"><Field label="الكمية المرتجعة" type="number" min="1" value={returnForm.quantity} onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })} data-testid="input-return-quantity" /></div><Buttons onCancel={() => setModal(null)} saveLabel="تسجيل المرتجع" /></form></Modal>}</div>;
}

function ProfitManagement({ state, setState, toast }: AppProps) {
  const ownerDraws = ownerProfitWithdrawalTotal(state.withdrawals);
  const availableProfit = realizedCashProfit(state) - ownerDraws;
  const timeline: ProfitTimelineEntry[] = [
    ...state.sales.map((sale) => ({
        id: sale.id,
        kind: sale.paymentType === 'cash' ? 'cash-sale' as const : 'credit-sale' as const,
        amount: sale.profit,
        date: sale.createdAt,
        label: `${sale.paymentType === 'cash' ? 'بيع نقدي' : 'بيع آجل'} · ${state.cards.find((card) => card.id === sale.cardTypeId)?.name ?? 'كرت'}`,
        note: `${formatNumber(sale.quantity)} كرت · إجمالي البيع ${formatMoney(sale.total)}`,
      })),
    ...state.payments.map((payment) => ({
      id: payment.id,
      kind: 'debt-collection' as const,
      amount: realizedProfitForPayment(state, payment),
      date: payment.createdAt,
      label: `تحصيل دين · ${state.customers.find((customer) => customer.id === payment.customerId)?.name ?? 'عميل'}`,
      note: `المبلغ المحصل ${formatMoney(payment.amount)}`,
    })),
    ...state.withdrawals.flatMap((withdrawal) => {
      const isTemporary = withdrawal.kind === 'temporary';
      const entries: ProfitTimelineEntry[] = [{
        id: withdrawal.id,
        kind: isTemporary ? 'temporary-drawing' : 'profit-withdrawal',
        amount: withdrawal.amount,
        date: withdrawal.createdAt,
        label: isTemporary ? 'سحب مؤقت / عهدة' : 'سحب أرباح',
        note: withdrawal.note,
        settled: isTemporary ? withdrawal.status !== 'open' : undefined,
      }];
      if (isTemporary && withdrawal.status === 'returned' && withdrawal.settledAt) {
        entries.push({ id: `${withdrawal.id}-return`, kind: 'temporary-return', amount: withdrawal.amount, date: withdrawal.settledAt, label: 'إرجاع للصندوق', note: withdrawal.note });
      }
      if (isTemporary && withdrawal.status === 'converted' && withdrawal.settledAt) {
        entries.push({ id: `${withdrawal.id}-converted`, kind: 'temporary-converted', amount: withdrawal.amount, date: withdrawal.settledAt, label: 'تحويل إلى سحب أرباح', note: withdrawal.note });
      }
      return entries;
    }),
  ];
  const recordOwnerDraw = (amount: number, note: string) => {
    if (amount > availableProfit) {
      toast('المبلغ يتجاوز رصيد الأرباح المتاح للسحب', 'error');
      return;
    }
    setState((current) => ({
      ...current,
      withdrawals: [{ id: uid('profit-withdrawal'), amount, note: note || 'سحب أرباح', kind: 'profit', eventType: 'PROFIT_WITHDRAWAL', createdAt: new Date().toISOString() }, ...current.withdrawals],
    }));
    toast('تم تسجيل سحب الأرباح');
  };
  const recordTemporaryDraw = (amount: number, note: string) => {
    if (amount > fundBalance(state)) {
      toast('المبلغ أكبر من رصيد الصندوق المتاح', 'error');
      return;
    }
    setState((current) => ({
      ...current,
      withdrawals: [{ id: uid('temporary-drawing'), amount, note: note || 'سحب مؤقت / عهدة', kind: 'temporary', eventType: 'TEMPORARY_DRAWING', status: 'open', createdAt: new Date().toISOString() }, ...current.withdrawals],
    }));
    toast('تم تسجيل السحب المؤقت');
  };
  const settleTemporary = (id: string, action: 'return' | 'convert') => {
    const current = state.withdrawals.find((withdrawal) => withdrawal.id === id);
    if (!current || current.kind !== 'temporary' || current.status !== 'open') return;
    setState((currentState) => ({
      ...currentState,
      withdrawals: currentState.withdrawals.map((withdrawal) => withdrawal.id === id
        ? { ...withdrawal, status: action === 'return' ? 'returned' : 'converted', settledAt: new Date().toISOString() }
        : withdrawal),
    }));
    toast(action === 'return' ? 'تم إرجاع العهدة إلى الصندوق' : 'تم تحويل العهدة إلى سحب أرباح');
  };
  return <ProfitPage
    summary={{ accruedProfit: accruedProfit(state), realizedProfit: realizedCashProfit(state), ownerDraws, availableProfit }}
    timeline={timeline}
    dateRange={{ from: '', to: '' }}
    onOwnerDraw={recordOwnerDraw}
    onTemporaryDraw={recordTemporaryDraw}
    onSettleTemporary={settleTemporary}
    formatMoney={formatMoney}
    formatNumber={formatNumber}
    balanceForDraw={availableProfit}
  />;
}

function Control({ state, setState, toast }: AppProps) {
  const [modal, setModal] = useState<'supplier' | 'deposit' | null>(null); const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
  const payable = supplierPayable(state);
  const fund = fundBalance(state);
  const customerDebt = state.customers.reduce((a, customer) => a + customer.debt, 0);
  const customersWithDebt = state.customers.filter(customer => customer.debt > 0).length;
  const stockCount = state.cards.reduce((a, card) => a + card.quantity, 0);
  const stockSaleValue = state.cards.reduce((a, card) => a + card.quantity * card.sellingPrice, 0);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }
    if (modal === 'supplier' && value > payable) { toast('المبلغ يتجاوز الرصيد المستحق للمورّد', 'error'); return; }
    if (modal === 'supplier' && value > fund) { toast('لا يكفي رصيد الصندوق لهذا القسط', 'error'); return; }
    const now = new Date().toISOString();
    if (modal === 'supplier') setState(s => ({ ...s, supplierPayments: [{ id: uid('supplier-payment'), amount: value, createdAt: now }, ...s.supplierPayments] }));
    if (modal === 'deposit') setState(s => ({ ...s, deposits: [{ id: uid('deposit'), amount: value, note: note || 'إيداع نقدي', createdAt: now }, ...s.deposits] }));
    toast('تم تسجيل العملية بنجاح'); setModal(null); setAmount(''); setNote('');
  };
  const activities = [...state.supplierPayments.map(x => ({ id: x.id, label: 'دفعة للمورّد', amount: x.amount, date: x.createdAt, positive: false, icon: Landmark })), ...state.withdrawals.map(x => ({ id: x.id, label: x.kind === 'temporary' ? 'سحب مؤقت / عهدة' : 'سحب أرباح', amount: x.amount, date: x.createdAt, positive: false, icon: ArrowUpRight })), ...state.deposits.map(x => ({ id: x.id, label: x.note || 'إيداع للصندوق', amount: x.amount, date: x.createdAt, positive: true, icon: ArrowDownLeft })), ...state.payments.map(x => ({ id: x.id, label: 'تحصيل من عميل', amount: x.amount, date: x.createdAt, positive: true, icon: Banknote }))].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return <div className="animate-appear space-y-6"><div><p className="text-sm text-muted-foreground">الحقيقة المالية للمحل</p><h2 className="mt-1 text-2xl font-bold">الحسابات</h2></div><div className="grid grid-cols-2 gap-3"><Metric title="ديون العملاء" value={formatMoney(customerDebt)} icon={Users} tone="teal" detail={`${formatNumber(customersWithDebt)} عملاء عليهم رصيد`} /><Metric title="رصيد الصندوق" value={formatMoney(fund)} icon={Wallet} tone="ink" detail="المبيعات النقدية + التحصيلات + الإيداعات − دفعات المورد − المسحوبات" /><Metric title="المخزون الحالي" value={formatMoney(stockSaleValue)} icon={Boxes} tone="cream" detail={`${formatNumber(stockCount)} كرت متاح · إجمالي قيمة البيع المحتملة`} /><Metric title="حساب المورد" value={formatMoney(payable)} icon={Landmark} tone="orange" detail="المبلغ المتبقي سداده بعد المرتجعات" /></div><div className="grid grid-cols-2 gap-2"><button data-testid="button-supplier-payment" disabled={!payable} onClick={() => setModal('supplier')} className="flex flex-col items-center gap-2 rounded-2xl border border-card-border bg-card p-4 text-xs font-bold dark:bg-slate-800 dark:text-white disabled:opacity-45"><Landmark className="text-[hsl(var(--accent))]" size={21} />دفعة مورّد</button><button data-testid="button-deposit" onClick={() => setModal('deposit')} className="flex flex-col items-center gap-2 rounded-2xl border border-card-border bg-card p-4 text-xs font-bold dark:bg-slate-800 dark:text-white"><ArrowDownLeft className="text-[#38817c]" size={21} />إيداع للصندوق</button></div><AccordionLog title="سجل الحركة" count={activities.length}>{activities.length ? <div className="space-y-1">{activities.map(a => { const Icon = a.icon; return <div key={a.id} data-testid={`control-activity-${a.id}`} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${a.positive ? 'bg-[#d7e6e4] text-[#38817c]' : 'bg-[#f1d8d2] text-[#b25449]'}`}><Icon size={16} /></span><div className="flex-1"><p className="text-sm font-bold">{a.label}</p><p className="text-[11px] text-muted-foreground">{dayLabel(a.date)}</p></div><strong className={`font-mono-app ${a.positive ? 'text-[#38817c]' : 'text-[#b25449]'}`}>{a.positive ? '+' : '-'}{formatMoney(a.amount)}</strong></div>; })}</div> : <Empty title="السجل فارغ" text="ستظهر دفعاتك وإيداعاتك ومسحوباتك هنا" icon={History} />}</AccordionLog>{modal && <Modal title={modal === 'supplier' ? 'دفعة للمورّد' : 'إيداع في الصندوق'} close={() => setModal(null)}><form onSubmit={submit}><div className="mb-4 rounded-xl bg-muted p-3 text-sm">{modal === 'supplier' ? 'الرصيد المستحق للمورّد' : 'الرصيد المتاح'}: <strong>{formatMoney(modal === 'supplier' ? payable : fund)}</strong></div><Field label="المبلغ" type="number" min="1" max={modal === 'supplier' ? payable : undefined} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" data-testid="input-control-amount" />{modal === 'deposit' && <div className="mt-4"><Field label="البيان (اختياري)" value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: رأس مال" data-testid="input-control-note" /></div>}<Buttons onCancel={() => setModal(null)} saveLabel="تسجيل العملية" /></form></Modal>}</div>;
}

function SettingsPage({ state, setState, toast }: AppProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'all' | 'operations'>('all');
  const [resetPassword, setResetPassword] = useState('');
  const [storageBusy, setStorageBusy] = useState<'save' | 'restore' | 'restore-auto' | 'directory' | null>(null);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [smsProgress, setSmsProgress] = useState<BulkSmsProgress | null>(null);
  const theme = (t: 'light' | 'dark') => setState(s => ({ ...s, settings: { ...s.settings, theme: t } }));
  const toggleTopBar = () => setState(s => ({ ...s, settings: { ...s.settings, showTopBar: !s.settings.showTopBar } }));
  const toggleAutoBackup = () => setState(s => ({ ...s, settings: { ...s.settings, autoBackupOnExit: !s.settings.autoBackupOnExit } }));
  const toggleProfitManagement = () => setState(s => ({ ...s, settings: { ...s.settings, profitManagementEnabled: !s.settings.profitManagementEnabled } }));
  const sendBulkSms = async (target: 'debt' | 'clear' | 'all', targetLabel: string) => {
    const template = state.settings.bulkSmsText.trim();
    if (!template) { toast('اكتب نموذج الرسائل الجماعية أولاً', 'error'); return; }
    if (!Capacitor.isNativePlatform()) {
      toast('الإرسال الجماعي SMS متاح من تطبيق Android فقط', 'error');
      return;
    }
    const recipients = state.customers.filter(customer => customer.phone.trim() && (
      target === 'all' || (target === 'debt' ? customer.debt > 0 : customer.debt === 0)
    ));
    if (!recipients.length) {
      toast(target === 'debt' ? 'لا يوجد عملاء عليهم دين' : target === 'clear' ? 'لا يوجد عملاء بدون دين' : 'لا يوجد عملاء مسجلون بأرقام هاتف', 'error');
      return;
    }
    setSmsProgress({ status: 'sending', targetLabel, total: recipients.length, completed: 0, failed: 0 });
    let completed = 0;
    let failed = 0;
    for (const customer of recipients) {
      setSmsProgress(current => current ? { ...current, currentName: customer.name } : current);
      try {
        await sendSms(customer.phone, personalizeMessage(template, customer));
      } catch {
        failed += 1;
      }
      completed += 1;
      setSmsProgress(current => current ? { ...current, completed, failed, currentName: customer.name } : current);
      if (completed < recipients.length) await new Promise(resolve => window.setTimeout(resolve, 80));
    }
    setSmsProgress(current => current ? { ...current, status: 'done', completed, failed } : current);
    toast(failed ? `تمت معالجة ${formatNumber(completed - failed)} رسالة وتعذر إرسال ${formatNumber(failed)}` : `تم إرسال ${formatNumber(completed)} رسالة SMS`);
  };
  const backupPayload = () => ({ schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state });
  const manualBackupName = () => `alyousifi-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const exportData = async () => {
    try {
      await exportManualBackup(JSON.stringify(backupPayload(), null, 2), manualBackupName());
      toast('تم حفظ النسخة الاحتياطية');
    } catch (error) {
      if (isUserCancellation(error)) return;
      reportRuntimeError('Manual backup export failed.', error);
      toast('تعذر حفظ النسخة الاحتياطية', 'error');
    }
  };
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.data) throw new Error();
        setState(migrate(parsed.data));
        toast('تم استعادة البيانات بنجاح');
      } catch {
        toast('ملف النسخة الاحتياطية غير صالح', 'error');
      }
    };
    reader.readAsText(file);
    reader.onerror = () => toast('تعذر قراءة ملف النسخة الاحتياطية', 'error');
    reader.onabort = () => toast('تم إلغاء قراءة ملف النسخة الاحتياطية');
    e.target.value = '';
  };
  const openReset = (mode: 'all' | 'operations') => {
    setResetMode(mode);
    setResetPassword('');
    setResetOpen(true);
  };
  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword !== 'Yusuf') {
      toast('كلمة المرور غير صحيحة', 'error');
      setResetPassword('');
      setResetOpen(false);
      return;
    }
    if (resetMode === 'operations') {
      setState(s => ({
        ...s,
        cards: s.cards.map(card => ({ ...card, quantity: 0 })),
        customers: s.customers.map(customer => ({ ...customer, debt: 0 })),
        sales: [],
        payments: [],
        supplies: [],
        supplierPayments: [],
        returns: [],
        withdrawals: [],
        deposits: [],
      }));
      setResetPassword('');
      setResetOpen(false);
      toast('تم مسح سجلات العمليات والديون مع الاحتفاظ بالعملاء وأنواع الكروت والإعدادات بنجاح.');
      return;
    }
    setState(emptyState());
    setResetPassword('');
    setResetOpen(false);
    toast('تم مسح جميع البيانات بنجاح');
  };
  const selectBackupDirectory = async () => {
    setStorageBusy('directory');
    try {
      const selected = await chooseAutomaticBackupDirectory();
      setState(s => ({
        ...s,
        settings: {
          ...s.settings,
          autoBackupDirectory: selected.path,
          autoBackupDirectoryName: selected.name,
        },
      }));
      toast(`تم اختيار مجلد ${selected.name}`);
    } catch (error) {
      if (!isUserCancellation(error)) {
        reportRuntimeError('Backup directory selection failed.', error);
        toast('تعذر اختيار مجلد النسخ الاحتياطي', 'error');
      }
    } finally {
      setStorageBusy(null);
    }
  };
  const resetBackupDirectory = async () => {
    try {
      await clearAutomaticBackupDirectory();
      setState(s => ({ ...s, settings: { ...s.settings, autoBackupDirectory: null, autoBackupDirectoryName: null } }));
      toast('تمت استعادة مجلد التطبيق الافتراضي');
    } catch (error) {
      reportRuntimeError('Backup directory reset failed.', error);
      toast('تعذر إعادة المجلد الافتراضي', 'error');
    }
  };
  const restoreLatestAuto = async () => {
    setStorageBusy('restore-auto');
    try {
      const payload = await restoreLatestAutomaticBackup(state.settings);
      if (!payload) {
        toast('لا توجد نسخة تلقائية احتياطية بعد');
        return;
      }
      const restored = stateFromStored(payload);
      if (!restored) {
        toast('النسخة التلقائية الاحتياطية غير صالحة', 'error');
        return;
      }
      setState(restored);
      toast('تمت استعادة أحدث نسخة تلقائية');
    } catch (error) {
      if (isUserCancellation(error)) return;
      reportRuntimeError('Automatic backup restore failed.', error);
      toast('تعذر استعادة أحدث نسخة تلقائية', 'error');
    } finally {
      setStorageBusy(null);
    }
  };
  return <div className="animate-appear max-w-3xl space-y-5">
    <div><p className="text-sm text-slate-500 dark:text-slate-300">تخصيص وحماية بياناتك</p><h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">الإعدادات</h2></div>
    <button type="button" data-testid="button-open-release-notes" onClick={() => setReleaseNotesOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-[#b9d8d5] bg-[#f1f8f7] p-4 text-right transition hover:border-[hsl(var(--accent))] dark:border-[#2e5655] dark:bg-[#1d3030]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7e6e4] text-[#38817c] dark:bg-black/20"><History size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900 dark:text-white">سجل التحديثات والتطويرات</strong><small className="text-xs text-slate-600 dark:text-slate-300">تعرف على آخر الميزات والتحسينات</small></span><ChevronLeft size={18} className="shrink-0 text-slate-500 dark:text-slate-300" /></button>
    <SettingsAccordion title="المظهر" description="الألوان والشريط العلوي" icon={Sun} testId="settings-appearance">
      <div className="grid gap-3 sm:grid-cols-3">
        <button data-testid="button-theme-light" onClick={() => theme('light')} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-bold transition ${state.settings.theme === 'light' ? 'border-[hsl(var(--accent))] bg-[#f4e0ca] text-[#9e531b] dark:bg-[#55351f] dark:text-[#f2bd88]' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}><Sun size={19} /> فاتح</button>
        <button data-testid="button-theme-dark" onClick={() => theme('dark')} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-bold transition ${state.settings.theme === 'dark' ? 'border-[hsl(var(--accent))] bg-[hsl(var(--primary))] text-white' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}><Moon size={19} /> داكن</button>
        <button data-testid="button-toggle-top-bar" onClick={toggleTopBar} className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-bold transition ${state.settings.showTopBar ? 'border-[hsl(var(--accent))] bg-[#d7e6e4] text-[#336d6b]' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}><span className="flex items-center gap-3"><Menu size={19} /> الشريط العلوي</span><span className="text-xs">{state.settings.showTopBar ? 'ظاهر' : 'مخفي'}</span></button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">يمكنك إخفاء الشريط العلوي والاعتماد على شريط التنقل السفلي الدائم.</p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/50">
        <div className="min-w-0"><strong className="block text-sm text-slate-900 dark:text-white">تفعيل شاشة إدارة الأرباح والمسحوبات</strong><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">يظهر تبويب الأرباح في التنقل عند التفعيل.</p></div>
        <button type="button" role="switch" aria-checked={state.settings.profitManagementEnabled} data-testid="button-toggle-profit-management" onClick={toggleProfitManagement} className={`relative h-7 w-12 shrink-0 rounded-full transition ${state.settings.profitManagementEnabled ? 'bg-[hsl(var(--accent))]' : 'bg-slate-400/50'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${state.settings.profitManagementEnabled ? 'right-1' : 'left-1'}`} /></button>
      </div>
    </SettingsAccordion>
    <SettingsAccordion title="المراسلة" description="تطبيق واتساب المستخدم للرسائل" icon={MessageCircle} testId="settings-messaging">
      <SelectField label="تطبيق الواتساب الافتراضي" value={state.settings.whatsappPackage} onChange={event => setState(s => ({ ...s, settings: { ...s.settings, whatsappPackage: event.target.value as WhatsAppPackage } }))}><option value="com.whatsapp">الواتساب الرسمي</option><option value="com.whatsapp.w4b">واتساب الأعمال</option><option value="system">النسخة الافتراضية للنظام</option></SelectField>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">سيُستخدم التطبيق المحدد عند فتح رسالة واتساب من صفحة العميل.</p>
    </SettingsAccordion>
    <SettingsAccordion title="نموذج الرسائل الفردية" description="رسالة تذكير الدين للعميل" icon={Phone} testId="settings-individual-template">
      <SettingsTemplateEditor value={state.settings.reminderText} onCommit={value => setState(s => ({ ...s, settings: { ...s.settings, reminderText: value } }))} testId="textarea-reminder" rows={3} hint={<>استخدم {`{الاسم}`} و {`{اسم_العميل}`} و {`{المبلغ}`} ليتم استبدالها تلقائياً.</>} />
    </SettingsAccordion>
    <SettingsAccordion title="نموذج الرسائل الجماعية SMS" description="رسالة موحدة للعملاء المحددين" icon={Send} testId="settings-bulk-template">
      <SettingsTemplateEditor value={state.settings.bulkSmsText} onCommit={value => setState(s => ({ ...s, settings: { ...s.settings, bulkSmsText: value } }))} testId="textarea-bulk-sms" rows={4} placeholder="اكتب رسالة SMS للعملاء..." hint={<>استخدم {`{الاسم}`} أو {`{اسم_العميل}`} لإضافة اسم العميل تلقائياً، ويمكنك استخدام {`{المبلغ}`} لإضافة رصيده الحالي.</>} />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" data-testid="button-bulk-sms-debt" onClick={() => void sendBulkSms('debt', 'أصحاب الدين')} disabled={smsProgress?.status === 'sending'} className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50"><Send size={15} /> أصحاب الدين</button>
        <button type="button" data-testid="button-bulk-sms-clear" onClick={() => void sendBulkSms('clear', 'بدون دين')} disabled={smsProgress?.status === 'sending'} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Send size={15} /> بدون دين</button>
        <button type="button" data-testid="button-bulk-sms-all" onClick={() => void sendBulkSms('all', 'جميع العملاء')} disabled={smsProgress?.status === 'sending'} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><Send size={15} /> جميع العملاء</button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">الإرسال الجماعي المباشر متاح في تطبيق Android مع صلاحية إرسال SMS.</p>
    </SettingsAccordion>
    <SettingsAccordion title="النسخ الاحتياطي والاستعادة" description="تصدير واستعادة JSON والنسخ التلقائي" icon={Cloud} testId="settings-backup">
      <div className="grid gap-3 sm:grid-cols-2">
        <button data-testid="button-export-backup" onClick={exportData} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7e6e4] text-[#38817c]"><Download size={19} /></span><span><strong className="block text-sm text-slate-900 dark:text-white">تصدير نسخة</strong><small className="text-xs text-slate-500 dark:text-slate-300">ملف JSON على جهازك</small></span></button>
        <button data-testid="button-import-backup" onClick={() => fileRef.current?.click()} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4e0ca] text-[#9e531b]"><Upload size={19} /></span><span><strong className="block text-sm text-slate-900 dark:text-white">استعادة نسخة</strong><small className="text-xs text-slate-500 dark:text-slate-300">استيراد ملف JSON</small></span></button>
        <input ref={fileRef} onChange={importData} type="file" accept="application/json" className="hidden" data-testid="input-import-backup" />
      </div>
      <div className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"><FolderOpen size={19} /></span><div className="min-w-0 flex-1"><strong className="text-sm text-slate-900 dark:text-white">مجلد النسخ الاحتياطي التلقائي</strong><span className="mt-2 block max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"><span className="block max-w-full truncate text-xs font-semibold text-slate-700 dark:text-slate-200" title={backupDirectoryLabel(state.settings)}>{backupDirectoryLabel(state.settings)}</span>{state.settings.autoBackupDirectory && <span dir="ltr" className="mt-1 block max-w-full break-all text-left text-[11px] leading-5 text-slate-500 dark:text-slate-300" title={state.settings.autoBackupDirectory}>{state.settings.autoBackupDirectory}</span>}</span></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><button data-testid="button-select-auto-backup-directory" onClick={selectBackupDirectory} disabled={storageBusy !== null} className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50"><FolderOpen size={16} />{storageBusy === 'directory' ? 'جارٍ اختيار المجلد...' : 'اختيار مجلد'}</button>{state.settings.autoBackupDirectory && <button data-testid="button-reset-auto-backup-directory" onClick={resetBackupDirectory} disabled={storageBusy !== null} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">المجلد الافتراضي</button>}</div>
        <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-300">مجلد النسخ التلقائي: مجلد التطبيق افتراضياً، ويمكن تغييره لمجلد آخر (مثل Google Drive).</p>
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-300">الاستعادة التلقائية تقرأ دائماً من المجلد المحدد حالياً للنسخ التلقائي.</p>
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-[1fr_11rem] sm:items-center"><div><strong className="text-sm text-slate-900 dark:text-white">أقصى عدد للنسخ التلقائية الاحتياطية</strong><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">يتم حذف أقدم نسخة تلقائياً عند تجاوز العدد المحدد.</p></div><SettingsBackupLimit value={state.settings.maxAutoBackups} onCommit={value => setState(s => ({ ...s, settings: { ...s.settings, maxAutoBackups: value } }))} /></div>
      <button data-testid="button-restore-latest-auto" onClick={restoreLatestAuto} disabled={storageBusy !== null} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"><RotateCcw size={17} />{storageBusy === 'restore-auto' ? 'جارٍ استعادة أحدث نسخة تلقائية...' : 'استعادة أحدث نسخة تلقائية'}</button>
      <div className="mt-4 rounded-2xl border border-[#c9dedd] bg-[#f1f8f7] p-5 dark:border-[#2e5655] dark:bg-[#1d3030]"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d7e6e4] text-[#38817c]"><ShieldCheck size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm text-slate-900 dark:text-white">النسخ الاحتياطي التلقائي عند الخروج</strong><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">يحفظ نسخة محلية خاصة عند انتقال التطبيق إلى الخلفية، دون إنترنت.</p></div><button type="button" role="switch" aria-checked={state.settings.autoBackupOnExit} data-testid="button-toggle-auto-backup" onClick={toggleAutoBackup} className={`relative h-7 w-12 shrink-0 rounded-full transition ${state.settings.autoBackupOnExit ? 'bg-[hsl(var(--accent))]' : 'bg-slate-400/50'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${state.settings.autoBackupOnExit ? 'right-1' : 'left-1'}`} /></button></div><p className="mt-2 text-xs font-semibold text-[#38817c]">{state.settings.autoBackupOnExit ? 'مفعل — النسخة الافتراضية: تشغيل' : 'متوقف'}</p></div></div></div>
    </SettingsAccordion>
    <SettingsAccordion title="منطقة البيانات" description="مسح البيانات المحلية مع تأكيد كلمة المرور" icon={LockKeyhole} testId="settings-data">
      <div className="rounded-2xl border border-[#e7c8c3] bg-[#fdf3f1] p-5 dark:border-[#59332e] dark:bg-[#2b1c1a]"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 shrink-0 text-[#a4493e]" size={20} /><div><h3 className="font-bold text-[#a4493e]">إدارة البيانات</h3><p className="mt-1 text-sm text-[#a4493e]/80">اختر مسح جميع البيانات أو مسح سجلات العمليات والديون مع الاحتفاظ بالعملاء وأنواع الكروت والإعدادات. لا يمكن التراجع عن هذه الإجراءات.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button data-testid="button-reset-data" onClick={() => openReset('all')} className="rounded-xl border border-[#dca69e] px-4 py-2.5 text-sm font-bold text-[#a4493e] transition hover:bg-[#f8e5e1] dark:hover:bg-[#3a2421]">مسح جميع البيانات</button><button data-testid="button-clear-operations-data" onClick={() => openReset('operations')} className="rounded-xl border border-[#dca69e] px-4 py-2.5 text-sm font-bold text-[#a4493e] transition hover:bg-[#f8e5e1] dark:hover:bg-[#3a2421]">مسح البيانات باستثناء (العملاء، أنواع الكروت، الإعدادات)</button></div></div>
    </SettingsAccordion>
    <section className="flex min-h-56 flex-col rounded-2xl bg-[hsl(var(--primary))] p-5 text-white dark:bg-[#1e293b]"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-bold text-white">اليوسفي سوفت <span className="text-sm font-medium text-[#cbd5e1]">• {APP_VERSION_LABEL}</span></p><p className="mt-3 max-w-xl text-sm leading-7 text-[#cbd5e1]">نظام إدارة المبيعات نقداً / آجل</p><ul className="mt-4 list-disc space-y-1.5 pr-5 text-sm leading-6 text-[#cbd5e1]"><li>إدارة المبيعات والديون للعملاء بكل سهولة.</li><li>استيراد جهات الاتصال وتسديد الديون جزئياً أو كلياً.</li><li>نسخ احتياطي تلقائي ويدوي يعمل بدون إنترنت 100%.</li></ul></div><FileJson size={26} className="shrink-0 text-[#cbd5e1] opacity-70" /></div><div className="mt-5 rounded-xl bg-white/10 p-3 text-xs leading-6 text-[#cbd5e1]"><strong className="text-white">التقنيات المستخدمة</strong><p className="mt-1">React 19 + TypeScript + Vite | Capacitor Native Android / SQLite Local Storage | Pure Client-Side SPA.</p></div><p className="mt-auto pt-7 text-center text-xs font-semibold text-[#f2bd88]">تصميم محمد النهدي - إهداء إلى يوسف عارف</p></section>
    {resetOpen && <Modal title={resetMode === 'all' ? 'تأكيد مسح جميع البيانات' : 'تأكيد مسح سجلات العمليات والديون'} close={() => setResetOpen(false)}><form onSubmit={reset}><p className="rounded-xl bg-[#fdf3f1] p-3 text-sm text-[#a4493e] dark:bg-[#2b1c1a]">{resetMode === 'all' ? 'أدخل كلمة المرور للمتابعة. سيتم حذف جميع السجلات المحلية.' : 'أدخل كلمة المرور للمتابعة. سيُحتفظ بالعملاء وأنواع الكروت والإعدادات، وستُمسح العمليات والأرصدة والمخزون.'}</p><div className="mt-4"><Field label="كلمة المرور" type="password" autoFocus required value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="أدخل كلمة المرور" data-testid="input-reset-password" /></div><Buttons onCancel={() => setResetOpen(false)} saveLabel="تأكيد الحذف" /></form></Modal>}
    {smsProgress && <BulkSmsProgressModal progress={smsProgress} close={() => setSmsProgress(null)} />}
    {releaseNotesOpen && <ReleaseNotesModal close={() => { setReleaseNotesOpen(false); markReleaseNotesSeen(); }} />}
  </div>;
}

function NotFound() { return <div className="grid min-h-[50vh] place-items-center text-center"><div><h2 className="text-5xl font-bold text-[hsl(var(--accent))]">٤٠٤</h2><p className="mt-2 text-muted-foreground">الصفحة غير موجودة</p><Link href="/" data-testid="link-back-home" className="mt-5 inline-block rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-white">العودة للرئيسية</Link></div></div>; }

function RouterContent(props: AppProps) {
  return <AppShell {...props}><ErrorBoundary resetKey={useLocation()[0]}><Switch><Route path="/" component={() => <Dashboard {...props} />} /><Route path="/sales" component={() => <Sales {...props} />} /><Route path="/customers/:id" component={() => <CustomerProfile {...props} />} /><Route path="/customers" component={() => <Customers {...props} />} /><Route path="/inventory" component={() => <Inventory {...props} />} /><Route path="/control" component={() => <Control {...props} />} /><Route path="/profit" component={() => props.state.settings.profitManagementEnabled ? <ProfitManagement {...props} /> : <NotFound />} /><Route path="/settings" component={() => <SettingsPage {...props} />} /><Route component={NotFound} /></Switch></ErrorBoundary></AppShell>;
}

function App() {
  const [state, setState] = useState<LocalState>(() => {
    try { return loadLocal(); }
    catch (error) {
      reportRuntimeError('Initial local database startup failed.', error);
      return demoState();
    }
  }); const [toastState, setToastState] = useState<Toast | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const stateRef = useRef(state);
  const hydratedRef = useRef(hydrated);
  const autoBackupRef = useRef(state.settings.autoBackupOnExit);
  stateRef.current = state;
  hydratedRef.current = hydrated;
  autoBackupRef.current = state.settings.autoBackupOnExit;
  useEffect(() => {
    try {
      setReleaseNotesOpen(localStorage.getItem(LAST_SEEN_VERSION_KEY) !== APP_VERSION);
    } catch (error) {
      console.warn('Release notes startup check was skipped.', error);
      setReleaseNotesOpen(true);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void localDataService.load<LocalState>().then((stored) => {
      if (!active) return;
      const restored = stateFromStored(stored);
      if (restored) setState(restored);
      setHydrated(true);
    }).catch((error) => {
      reportRuntimeError('Local database hydration failed.', error);
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.settings.theme === 'dark');
    if (hydrated) {
      void localDataService.save(state, SCHEMA_VERSION).catch((error) => {
        reportRuntimeError('Local database background save failed.', error);
      });
    }
  }, [state, hydrated]);
  useEffect(() => {
    const saveOnBackground = () => {
      if (!hydratedRef.current || !autoBackupRef.current) return;
      void Promise.all([
        localDataService.save(stateRef.current, SCHEMA_VERSION),
        saveAutomaticBackup(stateRef.current, SCHEMA_VERSION, stateRef.current.settings),
      ]).catch((error) => reportRuntimeError('Automatic backup failed.', error));
    };

    if (Capacitor.isNativePlatform()) {
      let listener: { remove: () => Promise<void> } | undefined;
      let disposed = false;
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) saveOnBackground();
      }).then((handle) => {
        if (disposed) {
          void handle.remove().catch((error) => reportRuntimeError('Native app listener cleanup failed.', error));
          return;
        }
        listener = handle;
      }).catch((error) => {
        reportRuntimeError('Native app state listener setup failed.', error);
      });
      return () => {
        disposed = true;
        if (listener) {
          void listener.remove().catch((error) => reportRuntimeError('Native app listener cleanup failed.', error));
        }
      };
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveOnBackground();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', saveOnBackground);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', saveOnBackground);
    };
  }, []);
  const toast = (message: string, tone: Toast['tone'] = 'success') => { setToastState({ message, tone }); window.setTimeout(() => setToastState(null), 2800); };
  const routerBase = import.meta.env.BASE_URL === './' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
  return <TooltipProvider><WouterRouter base={routerBase}><RouterContent state={state} setState={setState} toast={toast} /></WouterRouter><Toaster />{toastState && <div data-testid="status-toast" className={`animate-pop fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-xl lg:bottom-7 ${toastState.tone === 'error' ? 'bg-[#a4493e] text-white' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`}><span className="grid h-5 w-5 place-items-center rounded-full bg-white/15">{toastState.tone === 'error' ? <X size={13} /> : <Check size={13} />}</span>{toastState.message}</div>}{releaseNotesOpen && <ReleaseNotesModal close={() => { setReleaseNotesOpen(false); markReleaseNotesSeen(); }} />}</TooltipProvider>;
}

export default App;