import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090b18] px-6 py-10 text-white" dir="rtl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-600/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="relative flex w-full max-w-md flex-col items-center rounded-3xl border border-white/10 bg-white/[0.07] p-7 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
            <AlertTriangle
              size={46}
              className="mb-5 rounded-2xl bg-rose-400/10 p-2 text-rose-300"
            />

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-200/80" dir="ltr">
              ConnectLive
            </p>
            <h2 className="mb-3 text-xl font-extrabold">تعذّر تحميل الصفحة</h2>
            <p className="mb-7 max-w-sm text-sm leading-6 text-slate-300">
              يبدو أن نسخة قديمة من الصفحة ما زالت محفوظة في المتصفح. أعد التحميل وسنحاول جلب النسخة الجديدة تلقائياً.
            </p>

            <button
              onClick={() => {
                try {
                  sessionStorage.clear();
                } catch {
                  // Ignore storage failures.
                }
                window.location.reload();
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-3",
                "font-bold text-white shadow-lg shadow-violet-950/30 transition hover:scale-[1.02] hover:from-violet-500 hover:to-fuchsia-500",
                "cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              إعادة تحميل الصفحة
            </button>

            <details className="mt-6 w-full text-right">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                تفاصيل تقنية
              </summary>
              <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-black/20 p-3 text-left text-[10px] leading-4 text-slate-500" dir="ltr">
                {this.state.error?.stack || this.state.error?.message}
              </pre>
            </details>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
