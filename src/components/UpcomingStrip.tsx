import { fmt } from '../utils/formatters';
import styles from './UpcomingStrip.module.css';

interface UpcomingItem {
  cat: string;
  sub: string | null;
  amount: number;
  label: string;
}

interface UpcomingStripProps {
  items: UpcomingItem[];
  onSeeAll: () => void;
}

const VISIBLE = 3;

export default function UpcomingStrip({ items, onSeeAll }: UpcomingStripProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE);
  const extra = items.length - VISIBLE;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Upcoming Unpaid</span>
        {items.length > VISIBLE && (
          <button className={styles.seeAll} onClick={onSeeAll} aria-label="See all upcoming">
            see all
          </button>
        )}
      </div>
      <div className={styles.strip}>
        {visible.map((item, i) => (
          <div key={i} className={styles.card}>
            <span className={styles.catName}>{item.sub ? `${item.cat} · ${item.sub}` : item.cat}</span>
            <span className={styles.amount}>{fmt(item.amount)}</span>
            <span className={styles.month}>{item.label}</span>
          </div>
        ))}
        {extra > 0 && (
          <div className={`${styles.card} ${styles.moreCard}`} onClick={onSeeAll}>
            <span className={styles.moreCount}>+{extra}</span>
            <span className={styles.moreLabel}>more</span>
          </div>
        )}
      </div>
    </div>
  );
}
