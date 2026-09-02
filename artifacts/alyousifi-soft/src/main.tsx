import { createRoot } from 'react-dom/client';

import './index.css';

const rootElement = document.getElementById('root');
let diagnosticShown = false;

type RuntimeDiagnostic = {
  error?: unknown;
  message?: string;
  source?: string;
  line?: number;
  column?: number;
  context?: string;
};

function toError(value: unknown, fallback = 'Unknown runtime error'): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try { return new Error(JSON.stringify(value) || fallback); }
  catch { return new Error(String(value)); }
}

function locationFrom(error: Error, source?: string, line?: number, column?: number) {
  if (line) return { source: source || 'غير معروف', line, column: column || 0 };
  const match = error.stack?.match(/(?:https?|file):\/\/.*?:(\d+):(\d+)|(?:^|\s)([^()\s]+):(\d+):(\d+)/);
  if (!match) return { source: source || 'غير معروف', line: 0, column: 0 };
  return {
    source: source || match[0],
    line: Number(match[1] || match[4] || 0),
    column: Number(match[2] || match[5] || 0),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
}

function showDiagnostic(diagnostic: RuntimeDiagnostic | unknown) {
  if (diagnosticShown) return;
  diagnosticShown = true;
  const detail = typeof diagnostic === 'object' && diagnostic !== null && ('error' in diagnostic || 'message' in diagnostic)
    ? diagnostic as RuntimeDiagnostic
    : { error: diagnostic };
  const error = toError(detail.error, detail.message);
  const location = locationFrom(error, detail.source, detail.line, detail.column);
  const target = rootElement || document.body;
  if (!target) return;
  console.error('اليوسفي سوفت — runtime diagnostic', { error, location, context: detail.context });
  const message = escapeHtml(error.message || String(error));
  const stack = error.stack && error.stack !== error.message ? `\n\n${escapeHtml(error.stack)}` : '';
  const source = escapeHtml(location.source);
  const context = detail.context ? `<p style="margin:10px 0 0;color:#ffd0d0;font-size:13px">${escapeHtml(detail.context)}</p>` : '';
  target.innerHTML = `
    <main dir="rtl" data-testid="runtime-error-screen" style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#210204;color:#fff;font-family:Arial,sans-serif">
      <section style="width:min(100%,680px);padding:26px;border:2px solid #ff6b6b;border-radius:18px;background:#5b0b12;box-shadow:0 18px 50px rgba(0,0,0,.45)">
        <div style="display:flex;align-items:center;gap:12px;color:#ffd0d0;font-weight:800;font-size:15px">
          <span style="display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#d7193f;color:#fff;font-size:22px">!</span>
          <span>خطأ حرج في تشغيل اليوسفي سوفت</span>
        </div>
        <h1 style="margin:20px 0 8px;font-size:22px">تعذر تشغيل التطبيق</h1>
        <p style="margin:0 0 8px;color:#ffe8e8;font-size:14px">التفاصيل الفنية التي ظهرت أثناء الإقلاع:</p>
         <pre style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ff8990;border-radius:10px;padding:14px;background:#35060b;color:#fff;font:600 14px/1.7 monospace">${message}${stack}</pre>
        ${context}
        <p style="margin:14px 0 0;color:#ffd0d0;font:12px/1.7 monospace">المصدر: ${source}<br>السطر: ${location.line || 'غير متاح'}${location.column ? ` — العمود: ${location.column}` : ''}</p>
        <button id="runtime-error-retry" type="button" style="margin-top:20px;border:0;border-radius:10px;padding:12px 20px;background:#ff5262;color:#210204;font-weight:800;font-size:14px">إعادة المحاولة</button>
      </section>
    </main>
  `;
  document.getElementById('runtime-error-retry')?.addEventListener('click', () => window.location.reload());
}

function validateAssetUrls() {
  const isAndroidWebView = window.location.protocol === 'file:';
  const base = document.querySelector('base')?.getAttribute('href')?.trim();
  if (!base) {
    throw new Error(`Missing document base URL: ${JSON.stringify(base)}.`);
  }
  if (isAndroidWebView && (base.startsWith('/') || base.startsWith('//'))) {
    throw new Error(`Android WebView requires a relative base URL: ${JSON.stringify(base)}.`);
  }
  const criticalResources = Array.from(document.querySelectorAll('link[rel], script[type="module"]'));
  for (const resource of criticalResources) {
    const value = resource.getAttribute('href') || resource.getAttribute('src') || '';
    if (!value) continue;
    if (value.includes('""') || value.includes("''")) {
      throw new Error(`Malformed asset URL: ${JSON.stringify(value)}.`);
    }
    if (isAndroidWebView && (value.startsWith('/') || value.startsWith('//'))) {
      throw new Error(`Absolute asset path is not supported in Android WebView: ${JSON.stringify(value)}.`);
    }
  }
}

window.onerror = (message, source, line, column, error) => {
  showDiagnostic({ error: error || message, source: source || undefined, line: line || 0, column: column || 0, context: 'window.onerror' });
  return true;
};
window.addEventListener('unhandledrejection', (event) => {
  showDiagnostic({ error: event.reason, context: 'unhandledrejection' });
});
window.addEventListener('error', (event) => {
  const target = event.target;
  if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement || target instanceof HTMLImageElement) {
    const source = target.getAttribute('src') || target.getAttribute('href') || '(unknown asset)';
    showDiagnostic({ message: `Failed to load asset: ${source}`, source, context: 'missing asset' });
  }
}, true);
window.addEventListener('alyousifi-runtime-error', (event) => {
  const detail = (event as CustomEvent<RuntimeDiagnostic>).detail;
  showDiagnostic(detail || { message: 'Local runtime failure' });
});

function showBootFallback(error?: unknown) {
  showDiagnostic({ error, context: 'application boot' });
}

async function startApp() {
  try {
    validateAssetUrls();
    const [{ default: App }, { ErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./components/error-boundary'),
    ]);
    if (!rootElement) throw new Error('Root element was not found.');
    createRoot(rootElement, {
      onCaughtError: (error, errorInfo) => {
        console.error(error, errorInfo.componentStack);
      },
      onUncaughtError: (error, errorInfo) => {
        console.error(error, errorInfo.componentStack);
        showDiagnostic({ error, context: 'React uncaught error' });
      },
    }).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
  } catch (error) {
    showBootFallback(error);
  }
}

void startApp().catch((error) => showBootFallback(error));

try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        void navigator.serviceWorker.register('./sw.js').catch((error) => {
          console.warn('Offline worker registration was skipped.', error);
        });
      } catch (error) {
        console.warn('Offline worker startup was skipped.', error);
      }
    });
  }
} catch (error) {
  console.warn('Background browser capability discovery was skipped.', error);
}
