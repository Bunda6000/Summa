import { useState, useEffect } from 'react';
import { getSupportMeta, buildMailtoHref, SUPPORT_EMAIL, type SupportMeta } from '../../utils/supportMeta';
import styles from './SupportPanel.module.css';

interface Props {
  variant?: 'general' | 'billing';
}

export default function SupportPanel({ variant = 'general' }: Props) {
  const [meta, setMeta] = useState<SupportMeta | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSupportMeta().then(setMeta);
  }, []);

  const href = meta ? buildMailtoHref(meta, variant) : '#';

  const handleClick = () => setShowFallback(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const label = variant === 'billing' ? 'Billing Support' : 'Contact Support';
  const description =
    variant === 'billing'
      ? 'Have a billing or subscription question? Our team is here to help.'
      : 'Our team can help with account setup, billing, and technical issues.';

  return (
    <div className={styles.panel}>
      <p className={styles.description}>{description}</p>
      <p className={styles.responseTime}>We typically respond within 24 hours.</p>

      <a
        href={href}
        className={styles.contactLink}
        onClick={handleClick}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>

      {showFallback && (
        <div className={styles.fallback}>
          <p className={styles.fallbackText}>
            Didn't open? Copy the support address:
          </p>
          <div className={styles.fallbackRow}>
            <span className={styles.fallbackEmail}>{SUPPORT_EMAIL}</span>
            <button
              className={styles.copyBtn}
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy email address'}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
