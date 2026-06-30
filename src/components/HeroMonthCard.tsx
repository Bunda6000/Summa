import { fmt } from '../utils/formatters';
import styles from './HeroMonthCard.module.css';

interface HeroMonthCardProps {
  monthLabel: string;
  income: number;
  paid: number;
  balance: number;
}

export default function HeroMonthCard({ monthLabel, income, paid, balance }: HeroMonthCardProps) {
  const paidPct = income > 0 ? Math.min(100, (paid / income) * 100) : 0;
  const isPositive = balance >= 0;

  return (
    <div className={`glass-card ${styles.card}`}>
      <p className={styles.monthLabel}>{monthLabel}</p>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Income</span>
          <span className={styles.metricValue}>{fmt(income)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Balance</span>
          <span className={styles.metricValue} style={{ color: isPositive ? 'var(--accent)' : 'var(--red)' }}>
            {fmt(balance)}
          </span>
        </div>
      </div>
      <div className={styles.progressWrap}>
        <div className={styles.progressBg}>
          <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
        </div>
        <p className={styles.progressLabel}>
          {fmt(paid)} paid
        </p>
      </div>
    </div>
  );
}
