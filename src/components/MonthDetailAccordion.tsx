import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import styles from './MonthDetailAccordion.module.css';

interface MonthDetailAccordionProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function MonthDetailAccordion({ children, className, style }: MonthDetailAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ''}`} style={style}>
      <button
        className={styles.toggle}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Monthly detail ${open ? 'collapse' : 'expand'}`}
        style={{ touchAction: 'manipulation' }}
      >
        <span>Monthly Detail</span>
        <span className={styles.chevron} aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
}
