import styles from './SegmentedToggle.module.css';

interface Option {
  id: string;
  label: string;
}

interface SegmentedToggleProps {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}

export default function SegmentedToggle({ options, value, onChange }: SegmentedToggleProps) {
  return (
    <div className={styles.wrap} role="group">
      {options.map((opt) => (
        <button
          key={opt.id}
          className={`${styles.option} ${value === opt.id ? styles.active : ''}`}
          onClick={() => { if (opt.id !== value) onChange(opt.id); }}
          aria-pressed={opt.id === value}
          style={{ touchAction: 'manipulation' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
