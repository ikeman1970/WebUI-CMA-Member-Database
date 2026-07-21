type ThemeMode = 'light' | 'dark';

type ThemeToggleProps = {
  mode: ThemeMode;
  onToggle: () => void;
};

export default function ThemeToggle({ mode, onToggle }: ThemeToggleProps) {
  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {mode === 'dark' ? 'moon' : 'sun'}
      </span>
      <span className="theme-toggle__label">
        {mode === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
