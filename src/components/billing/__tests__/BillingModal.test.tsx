import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock("../../../store/useReceiptsStore");
vi.mock("../../../lib/billing");

import useProfileStore, {
  type Profile,
} from "../../../profile/useProfileStore";
import useAuthStore from "../../../auth/useAuthStore";
import useSubscriptionStore from "../../../subscription/useSubscriptionStore";
import useReceiptsStore from "../../../store/useReceiptsStore";
import BillingModal from "../BillingModal";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fakeSession = {
  user: {
    id: "user-123",
    email: "alice@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
  },
  access_token: "tok",
  refresh_token: "ref",
} as never;

const paidProfile: Profile = {
  user_id: "user-123",
  display_name: "Alice",
  plan: "paid",
  subscription_status: "active",
  renewal_date: "2026-06-01T10:00:00Z",
};

const freeProfile: Profile = {
  user_id: "user-123",
  display_name: "Alice",
  plan: "free",
  subscription_status: "active",
  renewal_date: null,
};

const fakeReceipts = [
  {
    id: "r1",
    orderId: "GPA.3303-0001",
    productId: "budget_planner_paid_monthly",
    purchaseToken: "tok-aaa",
    status: "purchased" as const,
    purchasedAt: "2026-04-01T10:00:00Z",
    expiresAt: "2026-05-01T10:00:00Z",
  },
];

function mockReceiptsStore(
  overrides?: Partial<ReturnType<typeof useReceiptsStore>>,
) {
  (useReceiptsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    records: [],
    loading: false,
    error: null,
    loadReceipts: vi.fn(),
    openPlayReceipt: vi.fn(),
    retry: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  useAuthStore.setState({
    session: fakeSession,
    loading: false,
    error: null,
    info: null,
    failedAttempts: 0,
    lockedUntil: null,
    resendCount: 0,
    resendCooldownUntil: null,
    verificationError: null,
  });

  useProfileStore.setState({
    profile: paidProfile,
    loading: false,
    saving: false,
    error: null,
  });
  vi.spyOn(useProfileStore.getState(), "loadProfile").mockResolvedValue(
    undefined,
  );

  useSubscriptionStore.setState({
    tier: "active",
    loading: false,
    rawStatus: "active",
    currentPeriodEnd: "2026-06-01T10:00:00Z",
    gracePeriodEnd: null,
  });

  mockReceiptsStore();
});

// ─── Billing summary — paid user ──────────────────────────────────────────────

describe("BillingModal — billing summary (paid user)", () => {
  it("renders the modal with correct aria role", () => {
    render(<BillingModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: /billing/i }),
    ).toBeInTheDocument();
  });

  it("shows the current plan as Paid", () => {
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/paid/i)).toBeInTheDocument();
  });

  it("shows the account email as billing email", () => {
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows renewal date formatted", () => {
    render(<BillingModal onClose={vi.fn()} />);
    // renewal_date = 2026-06-01
    expect(screen.getByText(/jun|june|2026/i)).toBeInTheDocument();
  });

  it("shows subscription status as Active", () => {
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<BillingModal onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ─── Subscription status labels ───────────────────────────────────────────────

describe("BillingModal — subscription status labels", () => {
  it('shows "Grace Period" when status is grace_period', () => {
    useSubscriptionStore.setState({
      rawStatus: "grace_period",
      tier: "grace_period",
      loading: false,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
    });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/grace period/i)).toBeInTheDocument();
  });

  it('shows "Expired" when status is expired', () => {
    useSubscriptionStore.setState({
      rawStatus: "expired",
      tier: "free",
      loading: false,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
    });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it('shows "Canceled" when status is canceled', () => {
    useSubscriptionStore.setState({
      rawStatus: "canceled",
      tier: "free",
      loading: false,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
    });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/canceled/i)).toBeInTheDocument();
  });
});

// ─── Receipts list ────────────────────────────────────────────────────────────

describe("BillingModal — receipts list", () => {
  it("calls loadReceipts on mount with the user id", () => {
    const loadReceipts = vi.fn();
    mockReceiptsStore({ loadReceipts });
    render(<BillingModal onClose={vi.fn()} />);
    expect(loadReceipts).toHaveBeenCalledWith("user-123");
  });

  it("renders each receipt row with date and status", () => {
    mockReceiptsStore({ records: fakeReceipts });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/GPA.3303-0001/i)).toBeInTheDocument();
    expect(screen.getByText(/purchased/i)).toBeInTheDocument();
  });

  it("shows a loading indicator while receipts are loading", () => {
    mockReceiptsStore({ loading: true });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("calls openPlayReceipt when a receipt row is clicked", async () => {
    const openPlayReceipt = vi.fn();
    mockReceiptsStore({ records: fakeReceipts, openPlayReceipt });
    render(<BillingModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByText(/GPA.3303-0001/i));
    expect(openPlayReceipt).toHaveBeenCalledWith("GPA.3303-0001");
  });

  it('shows "refunded" badge when receipt status is refunded', () => {
    const refunded = [{ ...fakeReceipts[0], status: "refunded" as const }];
    mockReceiptsStore({ records: refunded });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/refunded/i)).toBeInTheDocument();
  });
});

// ─── Free user — no billing info ──────────────────────────────────────────────

describe("BillingModal — free user / no subscription", () => {
  it("shows no-billing-info message for free users with no receipts", () => {
    useProfileStore.setState({
      profile: freeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    useSubscriptionStore.setState({
      rawStatus: null,
      tier: "free" as never,
      loading: false,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
    });
    mockReceiptsStore({ records: [] });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByText(/no billing information/i)).toBeInTheDocument();
  });

  it("does not show billing summary fields for a free user with no history", () => {
    useProfileStore.setState({
      profile: freeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    useSubscriptionStore.setState({
      rawStatus: null,
      tier: "free" as never,
      loading: false,
      currentPeriodEnd: null,
      gracePeriodEnd: null,
    });
    mockReceiptsStore({ records: [] });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.queryByText(/renewal date/i)).not.toBeInTheDocument();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("BillingModal — error state", () => {
  it("shows a friendly error message when receipts fail to load", () => {
    mockReceiptsStore({ error: "Failed to load billing data." });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/failed to load billing data/i),
    ).toBeInTheDocument();
  });

  it("shows a retry button in the error state", () => {
    mockReceiptsStore({ error: "Failed to load billing data." });
    render(<BillingModal onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls retry when the retry button is clicked", async () => {
    const retry = vi.fn();
    mockReceiptsStore({ error: "Failed to load billing data.", retry });
    render(<BillingModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(retry).toHaveBeenCalledOnce());
  });
});
