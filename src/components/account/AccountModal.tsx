import { useState, useEffect, type ChangeEvent } from "react";
import PixelModalOverlay from "../PixelModalOverlay";
import useProfileStore from "../../profile/useProfileStore";
import useAuthStore from "../../auth/useAuthStore";
import useBillingStore from "../../store/useBillingStore";
import useSubscriptionStore from "../../subscription/useSubscriptionStore";
import useBudgetStore from "../../store/useBudgetStore";
import ConfirmDialog from "./ConfirmDialog";
import SupportPanel from "./SupportPanel";
import { LEGAL_URLS } from "../../constants";
import styles from "./AccountModal.module.css";
import { detectLegacyData } from "../../migration/migrateLocalData";
import MigrationPanel from "../migration/MigrationPanel";
import type { AppData } from "../../types";

interface Props {
  onClose: () => void;
  onOpenBilling?: () => void;
}

function getInitials(name: string, email: string): string {
  const trimmedName = name.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email[0].toUpperCase() : "?";
}

export default function AccountModal({ onClose, onOpenBilling }: Props) {
  const {
    session,
    signOut,
    resendVerification,
    deleteAccount,
    updateEmail,
    clearEmailStatus,
    loading: authLoading,
    error: authError,
    info: authInfo,
    emailSuccess,
    emailError,
  } = useAuthStore();
  const { profile, loading, saving, error, loadProfile, updateDisplayName } =
    useProfileStore();
  const {
    status: billingStatus,
    error: billingError,
    purchase,
    openManageSubscription,
    clearError,
  } = useBillingStore();
  const dark = useBudgetStore((state) => state.dark);
  const toggleDark = useBudgetStore((state) => state.toggleDark);

  const userId = session?.user.id ?? "";
  const email = session?.user.email ?? "";
  const isEmailVerified = !!session?.user.email_confirmed_at;

  const [emailInput, setEmailInput] = useState(email);
  const [displayName, setDisplayName] = useState("");
  const [editingField, setEditingField] = useState<"email" | "name" | null>(
    null,
  );
  const [migrateLegacy, setMigrateLegacy] = useState<AppData | null>(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId, loadProfile]);

  useEffect(() => {
    detectLegacyData().then((data) => setMigrateLegacy(data));
  }, []);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
    if (emailSuccess || emailError) clearEmailStatus();
  };

  const openEditEmail = () => {
    setEmailInput(email);
    if (emailSuccess || emailError) clearEmailStatus();
    setEditingField("email");
  };

  const openEditName = () => setEditingField("name");

  const cancelEdit = () => {
    setEditingField(null);
    setEmailInput(email);
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (emailSuccess || emailError) clearEmailStatus();
  };

  const handleUpdateEmail = async () => {
    const trimmed = emailInput.trim();
    if (!trimmed || trimmed === email) return;
    await updateEmail(trimmed);
  };

  const handleSaveName = async () => {
    if (!userId) return;
    await updateDisplayName(userId, displayName);
    if (!useProfileStore.getState().error) setEditingField(null);
  };

  const handleResend = async () => {
    if (email) await resendVerification(email);
  };

  const handleUpgrade = async () => {
    if (!userId) return;
    clearError();
    await purchase(userId);
  };

  const handleManageSubscription = async () => {
    await openManageSubscription();
  };

  const rawStatus = useSubscriptionStore((state) => state.rawStatus);
  const trialStartedAt = useSubscriptionStore((state) => state.trialStartedAt);
  const trialEndsAt = useSubscriptionStore((state) => state.trialEndsAt);
  const isTrial = rawStatus === "trial";

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const planLabel =
    profile?.plan === "paid" ? "Paid" : isTrial ? "Trial" : "Free";
  const isActivePlan = profile?.plan === "paid" || isTrial;
  const statusLabel =
    profile?.subscription_status === "active"
      ? "Active"
      : profile?.subscription_status === "cancelled"
        ? "Cancelled"
        : "Past Due";

  const initials = getInitials(displayName, email);

  return (
    <PixelModalOverlay
      onClose={onClose}
      overlayClass={`overlay-mobile ${styles.overlay}`}
      innerClass="modal-mobile"
    >
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Account">
        <div className={styles.header}>
          <div className={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <div className={styles.headerText}>
            <h2 className={styles.name}>{displayName || "Account"}</h2>
            <div className={styles.emailRow}>
              <span className={styles.emailText}>{email}</span>
              {isEmailVerified ? (
                <span className={styles.verifiedTag}>✓ Verified</span>
              ) : (
                <span className={styles.unverifiedTag}>Unverified</span>
              )}
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <>
            {/* Email verification banner */}
            {!isEmailVerified && (
              <div role="alert" className={styles.verifyBanner}>
                <p className={styles.verifyBannerText}>
                  Verify your email address to unlock all features.
                </p>
                {authInfo && <p className={styles.verifySuccess}>{authInfo}</p>}
                {authError && <p className={styles.verifyError}>{authError}</p>}
                <button
                  className={styles.resendBtn}
                  onClick={handleResend}
                  disabled={authLoading}
                >
                  {authLoading ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}

            {/* Plan */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Plan</h3>
              <div
                className={`${styles.planCard} ${isActivePlan ? styles.planCardActive : ""}`}
              >
                <div className={styles.planCardTop}>
                  <span
                    className={`${styles.chip} ${profile?.plan === "paid" || isTrial ? styles.chipPaid : styles.chipFree}`}
                  >
                    {planLabel}
                  </span>
                  {profile?.plan === "paid" && (
                    <button
                      className={styles.editToggleBtn}
                      onClick={handleManageSubscription}
                    >
                      Manage
                    </button>
                  )}
                </div>

                {isTrial && trialStartedAt && (
                  <span className={styles.planMeta}>
                    Trial started {fmtDate(trialStartedAt)}
                  </span>
                )}
                {isTrial && trialEndsAt && (
                  <span className={styles.planMeta}>
                    Trial ends {fmtDate(trialEndsAt)}
                  </span>
                )}
                {!isTrial && profile?.plan === "paid" && (
                  <span className={styles.planMeta}>{statusLabel}</span>
                )}
              </div>

              {isTrial && (
                <button
                  className={styles.btnPrimary}
                  style={{ width: "100%" }}
                  onClick={handleUpgrade}
                  disabled={!isEmailVerified || billingStatus === "purchasing"}
                  title={
                    !isEmailVerified
                      ? "Verify your email to subscribe"
                      : undefined
                  }
                >
                  {billingStatus === "purchasing"
                    ? "Processing…"
                    : "Subscribe Now"}
                </button>
              )}

              {profile?.plan === "free" && !isTrial && (
                <>
                  <button
                    className={styles.btnPrimary}
                    style={{ width: "100%" }}
                    onClick={handleUpgrade}
                    disabled={!isEmailVerified || billingStatus === "purchasing"}
                    title={
                      !isEmailVerified
                        ? "Verify your email to upgrade"
                        : undefined
                    }
                  >
                    {billingStatus === "purchasing"
                      ? "Processing…"
                      : "Start Free Trial"}
                  </button>
                  {!isEmailVerified && (
                    <span className={styles.hint}>
                      Email verification required to purchase a subscription.
                    </span>
                  )}
                </>
              )}

              {billingError && <p className={styles.errorMsg}>{billingError}</p>}
            </div>

            {/* Account fields */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Account</h3>

              {editingField === "email" ? (
                <div className={styles.editBlock}>
                  <label htmlFor="email" className={styles.label}>
                    Email
                  </label>
                  <input
                    id="email"
                    aria-label="Email"
                    type="email"
                    value={emailInput}
                    onChange={handleEmailChange}
                    className={styles.input}
                    disabled={authLoading}
                    autoFocus
                  />
                  <span className={styles.hint}>
                    A confirmation email will be sent to verify the new address.
                  </span>
                  {emailSuccess && (
                    <p className={styles.successMsg}>{emailSuccess}</p>
                  )}
                  {emailError && <p className={styles.verifyError}>{emailError}</p>}
                  <div className={styles.editActions}>
                    <button className={styles.btnGhost} onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      className={styles.btnPrimary}
                      onClick={handleUpdateEmail}
                      disabled={
                        authLoading ||
                        !emailInput.trim() ||
                        emailInput.trim() === email
                      }
                    >
                      {authLoading ? "Updating…" : "Update"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.field}>
                  <div className={styles.fieldMain}>
                    <span className={styles.label}>Email</span>
                    <span className={styles.value}>{email}</span>
                  </div>
                  <button className={styles.editToggleBtn} onClick={openEditEmail}>
                    Edit
                  </button>
                </div>
              )}

              {editingField === "name" ? (
                <div className={styles.editBlock}>
                  <label htmlFor="display-name" className={styles.label}>
                    Display name
                  </label>
                  <input
                    id="display-name"
                    aria-label="Display name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={styles.input}
                    disabled={saving}
                    autoFocus
                  />
                  {error && <p className={styles.errorMsg}>{error}</p>}
                  <div className={styles.editActions}>
                    <button className={styles.btnGhost} onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      className={styles.btnPrimary}
                      onClick={handleSaveName}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.field}>
                  <div className={styles.fieldMain}>
                    <span className={styles.label}>Display name</span>
                    <span className={styles.value}>{displayName || "—"}</span>
                  </div>
                  <button className={styles.editToggleBtn} onClick={openEditName}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Preferences</h3>
              <div className={styles.field}>
                <div className={styles.fieldMain}>
                  <span className={styles.label}>Appearance</span>
                  <span className={styles.value}>{dark ? "Dark" : "Light"}</span>
                </div>
                <button
                  className={styles.themeToggleBtn}
                  onClick={toggleDark}
                  style={{ transform: dark ? "rotate(180deg)" : "rotate(0deg)" }}
                  aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                  title={dark ? "Light mode" : "Dark mode"}
                >
                  {dark ? "☀" : "☾"}
                </button>
              </div>
            </div>

            {/* Offline data migration */}
            {migrateLegacy && (
              <div className={styles.section}>
                <hr className={styles.divider} />
                <h3 className={styles.sectionTitle}>Offline Data</h3>
                {!showMigrationPanel ? (
                  <div className={styles.field}>
                    <div className={styles.fieldMain}>
                      <span className={styles.value}>
                        Local data hasn't been imported yet.
                      </span>
                    </div>
                    <button
                      className={styles.editToggleBtn}
                      onClick={() => setShowMigrationPanel(true)}
                    >
                      Migrate →
                    </button>
                  </div>
                ) : (
                  <MigrationPanel
                    userId={userId}
                    legacyData={migrateLegacy}
                    onComplete={async () => {
                      setMigrateLegacy(null);
                      setShowMigrationPanel(false);
                      useBudgetStore.getState().resetStore();
                      if (userId)
                        await useBudgetStore.getState().initStore(userId);
                    }}
                    onSkip={() => setShowMigrationPanel(false)}
                  />
                )}
              </div>
            )}

            {/* Billing & support actions */}
            <div className={styles.actionsRow}>
              {onOpenBilling && (
                <button className={styles.btnGhost} onClick={onOpenBilling}>
                  Billing & Receipts
                </button>
              )}
            </div>

            <SupportPanel variant="billing" />

            <hr className={styles.divider} />

            {/* Log out / delete */}
            <div className={styles.actionsRow}>
              <button className={styles.btnGhost} onClick={signOut}>
                Log Out
              </button>
            </div>

            <div className={styles.dangerZone}>
              <button
                className={styles.deleteBtn}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDialogOpen(true);
                }}
                disabled={authLoading}
              >
                {authLoading ? "Deleting…" : "Delete Account"}
              </button>
              {deleteError && <p className={styles.errorMsg}>{deleteError}</p>}
            </div>

            <hr className={styles.divider} />

            <p className={styles.sectionTitle}>Support</p>
            <SupportPanel />

            <p className={styles.legalText}>
              <a
                href={LEGAL_URLS.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.legalLink}
              >
                Privacy Policy
              </a>
              {" · "}
              <a
                href={LEGAL_URLS.terms}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.legalLink}
              >
                Terms of Service
              </a>
            </p>
          </>
        )}
      </div>

      {deleteDialogOpen && (
        <ConfirmDialog
          title="Delete Account?"
          message="This will permanently delete your account and all your data. This action cannot be undone."
          confirmLabel="Delete Forever"
          onConfirm={async () => {
            setDeleteDialogOpen(false);
            await deleteAccount();
            const err = useAuthStore.getState().error;
            if (!err) {
              onClose();
            } else {
              setDeleteError(err);
            }
          }}
          onCancel={() => setDeleteDialogOpen(false)}
        />
      )}
    </PixelModalOverlay>
  );
}
