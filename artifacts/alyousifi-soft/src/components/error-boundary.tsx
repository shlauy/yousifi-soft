import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  const location = error.stack?.match(/(?:https?|file):\/\/.*?:(\d+):(\d+)|(?:^|\s)([^()\s]+):(\d+):(\d+)/);
  const line = location ? Number(location[1] || location[4] || 0) : 0;
  const column = location ? Number(location[2] || location[5] || 0) : 0;
  return (
    <main dir="rtl" data-testid="runtime-error-boundary" className="grid min-h-screen w-full place-items-center bg-[#210204] p-6 text-white">
      <section className="w-full max-w-2xl rounded-2xl border-2 border-[#ff6b6b] bg-[#5b0b12] p-6 shadow-2xl">
        <div className="flex items-center gap-3 font-bold text-[#ffd0d0]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7193f] text-2xl">!</span><span>خطأ حرج في تشغيل اليوسفي سوفت</span></div>
        <h1 className="mt-5 text-xl font-bold">تعذر عرض الشاشة</h1>
        <p className="mt-2 text-sm text-[#ffe8e8]">التفاصيل الفنية:</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-[#ff8990] bg-[#35060b] p-4 font-mono text-sm font-semibold leading-7 text-white">{error.message || String(error)}{error.stack && error.stack !== error.message ? `\n\n${error.stack}` : ''}</pre>
        <p className="mt-3 font-mono text-xs leading-6 text-[#ffd0d0]">السطر: {line || 'غير متاح'}{column ? ` — العمود: ${column}` : ''}</p>
        <button type="button" onClick={resetError} className="mt-5 rounded-xl bg-[#ff5262] px-5 py-3 font-bold text-[#210204] hover:bg-[#ff7b88]">إعادة المحاولة</button>
      </section>
    </main>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
