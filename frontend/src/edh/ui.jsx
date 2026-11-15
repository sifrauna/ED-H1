import React, { createContext, useContext } from 'react';

// Matches the existing ED-H1 look: cream / dark surfaces, soft borders, rounded pills.
export function makeTheme(isLight) {
  return isLight
    ? {
        isLight,
        page: 'bg-[#FAF6EE]/95 text-stone-900 backdrop-blur-md',
        card: 'bg-white/70 border-stone-900/10',
        input: 'bg-white/80 border-stone-900/15 text-stone-900 placeholder-stone-400',
        btn: 'bg-stone-900/10 hover:bg-stone-900/15 text-stone-800',
        active: 'bg-stone-900 text-stone-50',
        muted: 'text-stone-500',
        line: 'border-stone-900/10'
      }
    : {
        isLight,
        page: 'bg-[#0B0F17]/95 text-slate-100 backdrop-blur-md',
        card: 'bg-white/5 border-white/10',
        input: 'bg-white/10 border-white/15 text-slate-100 placeholder-slate-400',
        btn: 'bg-white/10 hover:bg-white/15 text-slate-100',
        active: 'bg-white text-stone-900',
        muted: 'text-slate-400',
        line: 'border-white/10'
      };
}

export const ThemeCtx = createContext(makeTheme(true));
export const useT = () => useContext(ThemeCtx);

export function Card({ className = '', children }) {
  const t = useT();
  return <div className={`rounded-3xl border backdrop-blur-xl p-3.5 ${t.card} ${className}`}>{children}</div>;
}

export function Btn({ children, onClick, active, disabled, title, className = '', type = 'button' }) {
  const t = useT();
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? t.active : t.btn
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TextInput({ className = '', ...props }) {
  const t = useT();
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/50 ${t.input} ${className}`}
    />
  );
}

export function TextArea({ className = '', ...props }) {
  const t = useT();
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/50 resize-none ${t.input} ${className}`}
    />
  );
}

export function Field({ label, children }) {
  const t = useT();
  return (
    <label className="block space-y-1">
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${t.muted}`}>{label}</span>
      {children}
    </label>
  );
}

export function Notice({ kind = 'info', children }) {
  if (!children) return null;
  const tone =
    kind === 'error'
      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
      : kind === 'ok'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
      : 'bg-amber-400/15 text-amber-800 border-amber-500/30';
  return <div className={`rounded-2xl border px-3 py-2 text-xs ${tone}`}>{children}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tb) => (
        <Btn key={tb.id} active={value === tb.id} onClick={() => onChange(tb.id)}>
          {tb.icon}
          {tb.label}
        </Btn>
      ))}
    </div>
  );
}
