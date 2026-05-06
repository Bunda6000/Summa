import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: Props) {
  return (
    <div className={styles.overlay} onClick={onCancel} aria-label="Confirm action overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Keep Subscription
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
