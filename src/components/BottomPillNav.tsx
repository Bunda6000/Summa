import styles from './BottomPillNav.module.css';

type Tab = 'dashboard' | 'expenses' | 'incomes' | 'budget';

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '⌂', label: 'Home' },
  { id: 'expenses', icon: '💸', label: 'Expenses' },
  { id: 'incomes', icon: '↑', label: 'Incomes' },
  { id: 'budget', icon: '◎', label: 'Budget' },
];

interface BottomPillNavProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
}

export default function BottomPillNav({ tab, setTab }: BottomPillNavProps) {
  return (
    <nav className={styles.nav} role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`${styles.item} ${tab === item.id ? styles.active : ''}`}
          onClick={() => setTab(item.id)}
          aria-current={tab === item.id ? 'page' : undefined}
          style={{ touchAction: 'manipulation' }}
        >
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
