import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Coins,
  HandCoins,
  Landmark,
  Minus,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

export type ProfitSummary = {
  accruedProfit: number;
  realizedProfit: number;
  ownerDraws: number;
  availableProfit: number;
};

export type ProfitTimelineEntry = {
  id: string;
  kind:
    | 'cash-sale'
    | 'credit-sale'
    | 'debt-collection'
    | 'profit-withdrawal'
    | 'temporary-drawing'
    | 'temporary-return'
    | 'temporary-converted';
  amount: number;
  date: string;
  label: string;
  note?: string;
  settled?: boolean;
};

export type ProfitDateRange = {
  from: string;
  to: string;
};

export type ProfitPageProps = {
  summary: ProfitSummary;
  timeline: ProfitTimelineEntry[];
  dateRange: ProfitDateRange;
  onOwnerDraw: (amount: number, note: string) => void;
  onTemporaryDraw: (amount: number, note: string) => void;
  onSettleTemporary: (id: string, action: 'return' | 'convert') => void;
  formatMoney: (value: number) => string;
  formatNumber: (value: number) => string;
  balanceForDraw?: number;
};

type DrawMode = 'owner' | 'temporary' | null;

const kindDetails: Record<
  ProfitTimelineEntry['kind'],
  {
    label: string;
    icon: typeof Banknote;
    tone: 'positive' | 'accent' | 'withdrawal' | 'temporary';
    direction: 1 | -1;
  }
> = {
  'cash-sale': { label: 'بيع نقدي', icon: Banknote, tone: 'positive', direction: 1 },
  'credit-sale': { label: 'بيع آجل', icon: TrendingUp, tone: 'accent', direction: 1 },
  'debt-collection': { label: 'تحصيل دين', icon: ArrowDownToLine, tone: 'positive', direction: 1 },
  'profit-withdrawal': { label: 'سحب أرباح', icon: WalletCards, tone: 'withdrawal', direction: -1 },
  'temporary-drawing': { label: 'سحب مؤقت / عهدة', icon: Clock3, tone: 'temporary', direction: -1 },
  'temporary-return': { label: 'إرجاع للصندوق', icon: RotateCcw, tone: 'positive', direction: 1 },
  'temporary-converted': { label: 'تحويل إلى سحب أرباح', icon: Coins, tone: 'withdrawal', direction: -1 },
};

const toneClasses = {
  positive: {
    icon: 'bg-[#dceee2] text-[#317052] dark:bg-[#203e35] dark:text-[#9bd0af]',
    amount: 'text-[#2f7554] dark:text-[#9bd0af]',
    rail: 'bg-[#76ad89]',
  },
  accent: {
    icon: 'bg-[#f8e6cc] text-[#a75d1b] dark:bg-[#4a3020] dark:text-[#f1bd83]',
    amount: 'text-[#a75d1b] dark:text-[#f1bd83]',
    rail: 'bg-[#d7792b]',
  },
  withdrawal: {
    icon: 'bg-[#f4dfdb] text-[#a34e48] dark:bg-[#492a2a] dark:text-[#efaaa1]',
    amount: 'text-[#a34e48] dark:text-[#efaaa1]',
    rail: 'bg-[#c76a60]',
  },
  temporary: {
    icon: 'bg-[#e2e5ef] text-[#55648d] dark:bg-[#2d344d] dark:text-[#b7c1e2]',
    amount: 'text-[#55648d] dark:text-[#b7c1e2]',
    rail: 'bg-[#7888b2]',
  },
} as const;

const numberForInput = (value: number) => (Number.isFinite(value) ? String(value) : '');

const dateKey = (value: string) => value.slice(0, 10);

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ar-YE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.includes('T')) return '';
  return new Intl.DateTimeFormat('ar-YE', { hour: 'numeric', minute: '2-digit' }).format(parsed);
};

function StatCard({
  title,
  value,
  icon: Icon,
  variant,
  detail,
  testId,
}: {
  title: string;
  value: string;
  icon: typeof Banknote;
  variant: 'hero' | 'green' | 'sand' | 'rose' | 'danger';
  detail: string;
  testId: string;
}) {
  const styles = {
    hero: 'border-[#263d4b] bg-[#263d4b] text-[#f8f0df] shadow-[0_18px_40px_rgba(38,61,75,.16)]',
    green: 'border-[#c8dfd0] bg-[#e5f1e7] text-[#315e4a] dark:border-[#355746] dark:bg-[#20382e] dark:text-[#c7e5d1]',
    sand: 'border-[#e5d5bb] bg-[#f5ead8] text-[#795b37] dark:border-[#5b4930] dark:bg-[#3c3124] dark:text-[#efd5a9]',
    rose: 'border-[#e5c9c5] bg-[#f4e2de] text-[#884d48] dark:border-[#5b3532] dark:bg-[#3c2928] dark:text-[#efc0ba]',
    danger: 'border-red-500 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200',
  };
  const iconStyles = {
    hero: 'bg-[#d7792b] text-[#fff8ed]',
    green: 'bg-black/7 text-[#367455] dark:bg-white/10 dark:text-[#a8d9b7]',
    sand: 'bg-black/7 text-[#a56425] dark:bg-white/10 dark:text-[#efc98d]',
    rose: 'bg-black/7 text-[#ad5b53] dark:bg-white/10 dark:text-[#efb3ad]',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  };

  return (
    <article
      data-testid={testId}
      className={`relative overflow-hidden rounded-[1.4rem] border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(49,42,28,.10)] ${styles[variant]}`}
    >
      {variant === 'hero' && (
        <span className="pointer-events-none absolute -left-8 -top-14 h-40 w-40 rounded-full border-[18px] border-[#d7792b]/20" />
      )}
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className={`text-[12px] font-medium ${variant === 'hero' ? 'text-[#d8e0df]' : 'text-current/70'}`}>{title}</p>
          <p className={`mt-3 text-[1.7rem] font-bold leading-none tracking-tight font-mono-app ${variant === 'hero' ? 'text-[#f6c58d]' : 'text-current'}`}>
            {value}
          </p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconStyles[variant]}`}>
          <Icon size={19} strokeWidth={2.2} />
        </span>
      </div>
      <p className={`relative mt-4 text-[11px] leading-5 ${variant === 'hero' ? 'text-[#c6d0d0]' : 'text-current/70'}`}>{detail}</p>
    </article>
  );
}

function AmountInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor="profit-draw-amount" className="mb-2 block text-sm font-bold text-[hsl(var(--foreground))]">
        المبلغ
      </label>
      <div className="relative">
        <input
          id="profit-draw-amount"
          data-testid="input-draw-amount"
          type="number"
          min="1"
          step="1"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'draw-amount-error' : 'draw-amount-hint'}
          className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 pl-16 text-left text-lg font-bold outline-none transition placeholder:text-[hsl(var(--muted-foreground))] focus:border-[#d7792b] focus:ring-2 focus:ring-[#d7792b]/20"
          placeholder="0"
          autoFocus
        />
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">ريال</span>
      </div>
      {error ? (
        <p id="draw-amount-error" className="mt-2 text-xs font-medium text-[#aa4c45]" role="alert">{error}</p>
      ) : (
        <p id="draw-amount-hint" className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">اكتب المبلغ بالأرقام.</p>
      )}
    </div>
  );
}

function DrawDialog({
  mode,
  formatMoney,
  balanceForDraw,
  onClose,
  onOwnerDraw,
  onTemporaryDraw,
}: {
  mode: Exclude<DrawMode, null>;
  formatMoney: (value: number) => string;
  balanceForDraw: number;
  onClose: () => void;
  onOwnerDraw: (amount: number, note: string) => void;
  onTemporaryDraw: (amount: number, note: string) => void;
}) {
  const isOwner = mode === 'owner';
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('أدخل مبلغاً أكبر من صفر.');
      return;
    }
    if (isOwner && parsed > balanceForDraw) {
      setError('المبلغ يتجاوز رصيد الأرباح المتاح للسحب.');
      return;
    }
    if (isOwner) onOwnerDraw(parsed, note.trim());
    else onTemporaryDraw(parsed, note.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid min-h-[100dvh] place-items-center bg-[#203442]/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draw-dialog-title"
        data-testid="dialog-profit-draw"
        className="animate-pop w-full max-w-md rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#f7e4ca] text-[#a35d1e] dark:bg-[#4b3020] dark:text-[#f0bd83]">
              {isOwner ? <WalletCards size={20} /> : <HandCoins size={20} />}
            </span>
            <h2 id="draw-dialog-title" className="text-xl font-bold">{isOwner ? 'سحب أرباح' : 'سحب مؤقت / عهدة'}</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {isOwner ? 'يسجل هذا المبلغ كسحب شخصي من الأرباح.' : 'مبلغ مؤقت يبقى مفتوحاً حتى إرجاعه أو تحويله.'}
            </p>
          </div>
          <button type="button" data-testid="button-close-draw-dialog" aria-label="إغلاق" onClick={onClose} className="rounded-xl p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <AmountInput value={amount} onChange={setAmount} error={error} />
          <div>
            <label htmlFor="profit-draw-note" className="mb-2 block text-sm font-bold text-[hsl(var(--foreground))]">
              البيان <span className="font-normal text-[hsl(var(--muted-foreground))]">(اختياري)</span>
            </label>
            <textarea
              id="profit-draw-note"
              data-testid="input-draw-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={isOwner ? 'مثال: مصروف شخصي' : 'مثال: عهدة مشتريات'}
              className="w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground))] focus:border-[#d7792b] focus:ring-2 focus:ring-[#d7792b]/20"
            />
          </div>
          {isOwner && (
            <div className="flex items-center justify-between rounded-xl bg-[#f3eee4] px-4 py-3 text-xs text-[#756b5a] dark:bg-[#39342b] dark:text-[#d9cdb8]">
              <span>الرصيد المتاح</span>
              <strong className="font-mono-app">{formatMoney(balanceForDraw)}</strong>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" data-testid="button-submit-draw" className="flex-1 rounded-xl bg-[#d7792b] px-4 py-3 text-sm font-bold text-[#fff8ed] transition hover:bg-[#bc621d] active:scale-[.99]">
              تأكيد العملية
            </button>
            <button type="button" data-testid="button-cancel-draw" onClick={onClose} className="rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TimelineItem({
  entry,
  formatMoney,
  onSettleTemporary,
  isSettled,
}: {
  entry: ProfitTimelineEntry;
  formatMoney: (value: number) => string;
  onSettleTemporary: (id: string, action: 'return' | 'convert') => void;
  isSettled: boolean;
}) {
  const details = kindDetails[entry.kind];
  const Icon = details.icon;
  const tone = toneClasses[details.tone];
  const canSettle = entry.kind === 'temporary-drawing' && !entry.settled && !isSettled;
  const amount = Math.abs(entry.amount);
  const sign = details.direction === 1 ? '+' : '−';

  return (
    <li data-testid={`timeline-entry-${entry.id}`} className="relative flex gap-3 py-4 first:pt-1 last:pb-1">
      <span className={`absolute right-[19px] top-0 h-full w-px ${tone.rail} opacity-25 last:hidden`} aria-hidden="true" />
      <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold">{entry.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.icon}`}>{details.label}</span>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {formatDate(entry.date)} {formatTime(entry.date) && `• ${formatTime(entry.date)}`}
            </p>
            {entry.note && <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{entry.note}</p>}
          </div>
          <strong className={`shrink-0 text-sm font-bold font-mono-app ${tone.amount}`}>
            {sign} {formatMoney(amount)}
          </strong>
        </div>
        {canSettle && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid={`settle-controls-${entry.id}`}>
            <button
              type="button"
              data-testid={`button-return-${entry.id}`}
              onClick={() => onSettleTemporary(entry.id, 'return')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#bbd5c3] bg-[#edf7ef] px-3 py-2 text-xs font-bold text-[#377254] transition hover:-translate-y-0.5 hover:bg-[#e0f0e4] dark:border-[#40694e] dark:bg-[#243d2e] dark:text-[#a8d7b3]"
            >
              <RotateCcw size={14} /> إرجاع للصندوق
            </button>
            <button
              type="button"
              data-testid={`button-convert-${entry.id}`}
              onClick={() => onSettleTemporary(entry.id, 'convert')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5c49f] bg-[#fff4e6] px-3 py-2 text-xs font-bold text-[#9e5e20] transition hover:-translate-y-0.5 hover:bg-[#ffecd4] dark:border-[#6c4a2d] dark:bg-[#493321] dark:text-[#edc08e]"
            >
              <Coins size={14} /> تحويل إلى سحب أرباح
            </button>
          </div>
        )}
        {(entry.settled || isSettled) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#e9f3eb] px-3 py-2 text-xs font-bold text-[#377254] dark:bg-[#263e30] dark:text-[#a8d7b3]">
            <Check size={14} /> تم تسجيل التسوية
          </p>
        )}
      </div>
    </li>
  );
}

function FilterBar({
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div data-testid="profit-date-filters" className="flex flex-col gap-3 rounded-[1.25rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9edf0] text-[#526a78] dark:bg-[#2b3941] dark:text-[#b9cbd2]">
          <CalendarDays size={16} />
        </span>
        <span>حركة الأرباح</span>
        <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">حسب الفترة</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold text-[hsl(var(--muted-foreground))]">من</span>
          <input data-testid="input-profit-date-from" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} className="w-full min-w-0 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-2 text-xs outline-none focus:border-[#d7792b]" />
        </label>
        <Minus size={14} className="mb-3 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <label className="min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold text-[hsl(var(--muted-foreground))]">إلى</span>
          <input data-testid="input-profit-date-to" type="date" value={to} onChange={(event) => onToChange(event.target.value)} className="w-full min-w-0 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-2 text-xs outline-none focus:border-[#d7792b]" />
        </label>
        <button type="button" data-testid="button-reset-profit-filter" onClick={onReset} className="mb-0.5 rounded-lg px-2 py-2 text-[11px] font-bold text-[#a35d1e] transition hover:bg-[#fbecd9] dark:text-[#efbd83] dark:hover:bg-[#493321]">
          الكل
        </button>
      </div>
    </div>
  );
}

export default function ProfitPage({
  summary,
  timeline,
  dateRange,
  onOwnerDraw,
  onTemporaryDraw,
  onSettleTemporary,
  formatMoney,
  formatNumber,
  balanceForDraw,
}: ProfitPageProps) {
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [fromFilter, setFromFilter] = useState(dateRange.from);
  const [toFilter, setToFilter] = useState(dateRange.to);
  const [settledIds, setSettledIds] = useState<string[]>([]);

  useEffect(() => {
    setFromFilter(dateRange.from);
    setToFilter(dateRange.to);
  }, [dateRange.from, dateRange.to]);

  const actualDrawBalance = balanceForDraw ?? summary.availableProfit;
  const isOverdrawn = actualDrawBalance < 0;
  const temporaryOpenCount = timeline.filter((entry) => entry.kind === 'temporary-drawing' && !settledIds.includes(entry.id)).length;

  const visibleTimeline = useMemo(() => {
    return timeline
      .filter((entry) => {
        const key = dateKey(entry.date);
        return (!fromFilter || key >= fromFilter) && (!toFilter || key <= toFilter);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeline, fromFilter, toFilter]);

  const settleTemporary = (id: string, action: 'return' | 'convert') => {
    setSettledIds((current) => (current.includes(id) ? current : [...current, id]));
    onSettleTemporary(id, action);
  };

  return (
    <div data-testid="profit-page" className="animate-appear min-h-[100dvh] pb-8">
      <header className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-[#a35d1e]">
            <span className="h-2 w-2 rounded-full bg-[#d7792b]" />
            دفتر الأرباح • قراءة مالية واضحة
          </div>
          <h1 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold leading-[1.15] tracking-tight">الأرباح والمسحوبات</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            اعرف ما تحقق فعلاً، وما أصبح في الصندوق، وما يمكنك سحبه بثقة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d8e1e1] bg-[#edf3f1] px-3 py-2 text-xs text-[#456560] dark:border-[#314947] dark:bg-[#203532] dark:text-[#b8d7d0]">
          <ShieldCheck size={16} />
          <span>الأرقام محسوبة من سجل البيع المحلي</span>
        </div>
      </header>

      <section aria-label="ملخص الأرباح" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <StatCard
          testId="summary-accrued-profit"
          title="إجمالي الأرباح الدفترية"
          value={formatMoney(summary.accruedProfit)}
          detail="أرباح كل المبيعات، النقدية والآجلة."
          icon={TrendingUp}
          variant="hero"
        />
        <StatCard
          testId="summary-realized-profit"
          title="الأرباح المحصلة نقداً"
          value={formatMoney(summary.realizedProfit)}
          detail="الجزء الذي دخل الصندوق فعلاً."
          icon={Banknote}
          variant="green"
        />
        <StatCard
          testId="summary-owner-draws"
          title="إجمالي المسحوبات الشخصية"
          value={formatMoney(summary.ownerDraws)}
          detail="سحوبات الأرباح المسجلة حتى الآن."
          icon={WalletCards}
          variant="rose"
        />
        <StatCard
          testId="summary-available-profit"
          title="رصيد الأرباح المتاح للسحب"
          value={formatMoney(summary.availableProfit)}
          detail={isOverdrawn ? 'الرصيد يحتاج إلى تغطية قبل سحب جديد.' : 'متاح للسحب دون التأثير على رأس المال.'}
          icon={CircleDollarSign}
           variant={isOverdrawn ? 'danger' : 'sand'}
        />
      </section>

      {isOverdrawn && (
        <section data-testid="overdraw-state" role="alert" className="mt-4 flex flex-col gap-4 rounded-[1.25rem] border border-[#e2b5ad] bg-[#f8e4df] p-4 text-[#884841] dark:border-[#70413d] dark:bg-[#3c2827] dark:text-[#f1bbb3] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eac3bc] text-[#a04d45] dark:bg-[#613936] dark:text-[#f4b8ae]">
              <CircleAlert size={20} />
            </span>
            <div>
              <h2 className="font-bold">عجز مسحوبات على المكشوف</h2>
              <p className="mt-1 text-xs leading-5 text-current/75">المسحوبات تتجاوز الأرباح المتاحة بمقدار {formatMoney(Math.abs(actualDrawBalance))}. راجع الحركات قبل تسجيل سحب جديد.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-black/5 px-3 py-2 text-sm font-bold font-mono-app dark:bg-white/10">{formatMoney(Math.abs(actualDrawBalance))}</span>
        </section>
      )}

      <section aria-label="عمليات السحب" className="mt-7 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          data-testid="button-owner-draw"
          disabled={isOverdrawn}
          onClick={() => setDrawMode('owner')}
          className="group flex items-center justify-between gap-4 rounded-[1.25rem] border border-[#d7792b] bg-[#d7792b] p-4 text-right text-[#fff8ed] shadow-[0_10px_22px_rgba(215,121,43,.15)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#c96c21] disabled:cursor-not-allowed disabled:border-[#c4bdb2] disabled:bg-[#c4bdb2] disabled:shadow-none"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f4bc7f]/25"><WalletCards size={21} /></span>
            <span><strong className="block text-sm">سحب أرباح</strong><small className="mt-1 block text-[11px] text-[#ffe3c6]/80">{isOverdrawn ? 'غير متاح مع وجود عجز' : 'سجل مبلغاً لك من الأرباح المتاحة'}</small></span>
          </span>
          <ArrowUpRight size={19} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          data-testid="button-temporary-draw"
          onClick={() => setDrawMode('temporary')}
          className="group flex items-center justify-between gap-4 rounded-[1.25rem] border border-[#bcc7df] bg-[#e8ebf4] p-4 text-right text-[#4d5c82] transition duration-200 hover:-translate-y-0.5 hover:border-[#9ba9cf] hover:bg-[#dfe4f0] dark:border-[#465172] dark:bg-[#2c344b] dark:text-[#d3dcfa]"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#7d8ebc]/15"><HandCoins size={21} /></span>
            <span><strong className="block text-sm">سحب مؤقت / عهدة</strong><small className="mt-1 block text-[11px] text-current/65">احتفظ به مفتوحاً حتى تتم تسويته</small></span>
          </span>
          <ArrowUpRight size={19} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
      </section>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <section data-testid="profit-timeline-section" className="min-w-0 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-sm)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[#a35d1e]">كشف الحركة</p>
              <h2 className="mt-1 text-xl font-bold">آخر عمليات الأرباح</h2>
            </div>
            <div data-testid="timeline-count" className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">
              {formatNumber(visibleTimeline.length)} عملية
            </div>
          </div>
          <FilterBar
            from={fromFilter}
            to={toFilter}
            onFromChange={setFromFilter}
            onToChange={setToFilter}
            onReset={() => {
              setFromFilter('');
              setToFilter('');
            }}
          />
          <div className="mt-5">
            {visibleTimeline.length > 0 ? (
              <ol className="divide-y divide-[hsl(var(--border))]" data-testid="profit-timeline">
                {visibleTimeline.map((entry) => (
                  <TimelineItem
                    key={entry.id}
                    entry={entry}
                    formatMoney={formatMoney}
                    onSettleTemporary={settleTemporary}
                    isSettled={settledIds.includes(entry.id)}
                  />
                ))}
              </ol>
            ) : (
              <div data-testid="profit-timeline-empty" className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-12 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f3eee4] text-[#9b815a] dark:bg-[#3c3429] dark:text-[#dfbd8d]"><PackageCheck size={23} /></span>
                <h3 className="mt-4 font-bold">لا توجد حركة في هذه الفترة</h3>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">غيّر نطاق التاريخ لعرض عمليات الأرباح.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section data-testid="profit-clarity-card" className="overflow-hidden rounded-[1.5rem] border border-[#cad9d7] bg-[#e8f1ef] text-[#365b58] dark:border-[#365553] dark:bg-[#203b39] dark:text-[#c7e0db]">
            <div className="border-b border-[#cad9d7] p-5 dark:border-[#365553]">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#4b7e76] dark:text-[#a8d2c9]">
                <Landmark size={15} /> كيف تقرأ الأرقام؟
              </div>
              <h2 className="mt-2 text-lg font-bold">الربح ليس كله نقداً</h2>
              <p className="mt-2 text-xs leading-6 text-current/75">الأرباح الدفترية تشمل المبيعات الآجلة. الرصيد المتاح للسحب يراعي ما دخل الصندوق وما خرج منه.</p>
            </div>
            <div className="space-y-1 px-5 py-3">
              <div className="flex items-center justify-between gap-3 border-b border-[#cad9d7] py-3 text-xs dark:border-[#365553]">
                <span className="text-current/70">عمليات مؤقتة مفتوحة</span>
                <strong className="font-mono-app">{formatNumber(temporaryOpenCount)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 text-xs">
                <span className="text-current/70">رصيد السحب الفعلي</span>
                <strong className={`font-mono-app ${isOverdrawn ? 'text-[#ad554c] dark:text-[#f0afa6]' : 'text-[#347254] dark:text-[#9fd1b0]'}`}>{formatMoney(actualDrawBalance)}</strong>
              </div>
            </div>
          </section>

          <section data-testid="profit-legend" className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f3eee4] text-[#a16a2b] dark:bg-[#3d3327] dark:text-[#e4bb81]"><Coins size={16} /></span>
              <h2 className="text-sm font-bold">مفتاح الحركات</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs text-[hsl(var(--muted-foreground))]">
              {(['cash-sale', 'credit-sale', 'debt-collection', 'profit-withdrawal', 'temporary-drawing'] as const).map((kind) => {
                const details = kindDetails[kind];
                const Icon = details.icon;
                return (
                  <div key={kind} className="flex min-w-0 items-center gap-2">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${toneClasses[details.tone].icon}`}><Icon size={14} /></span>
                    <span className="truncate">{details.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {drawMode && (
        <DrawDialog
          mode={drawMode}
          formatMoney={formatMoney}
          balanceForDraw={actualDrawBalance}
          onClose={() => setDrawMode(null)}
          onOwnerDraw={onOwnerDraw}
          onTemporaryDraw={onTemporaryDraw}
        />
      )}
    </div>
  );
}