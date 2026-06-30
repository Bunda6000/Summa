import styles from './CategoryGridCard.module.css';

interface CategoryGridCardProps {
  name: string;
  hasDataThisMonth: boolean;
  onPress: () => void;
}

export default function CategoryGridCard({ name, hasDataThisMonth, onPress }: CategoryGridCardProps) {
  return (
    <button
      className={styles.card}
      onClick={onPress}
      style={{ touchAction: 'manipulation' }}
    >
      {hasDataThisMonth && (
        <span className={styles.activeDot} data-active-dot aria-hidden="true" />
      )}
      <span className={styles.name}>{name}</span>
    </button>
  );
}
