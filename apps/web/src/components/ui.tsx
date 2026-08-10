import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  'w-full rounded-lg border border-line-strong bg-white/70 px-3 py-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition placeholder:text-ink-soft/60 focus:border-leaf focus:bg-white';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[controlClass, props.className].filter(Boolean).join(' ')} />;
}

export function TextSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[controlClass, props.className].filter(Boolean).join(' ')} />;
}

export function TextTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[controlClass, 'min-h-20 resize-y', props.className].filter(Boolean).join(' ')}
    />
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-leaf text-white hover:bg-leaf-bright shadow-[0_8px_20px_-12px_rgba(27,95,82,0.9)]',
  secondary: 'border border-line-strong bg-white/70 text-ink hover:bg-mist',
  danger: 'bg-clay text-white hover:brightness-110',
  ghost: 'text-ink-soft hover:bg-mist hover:text-ink',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay"
    >
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-soft">
      {children}
    </p>
  );
}
