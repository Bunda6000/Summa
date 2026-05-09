import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock stores ────────────────────────────────────────────────────────────────

vi.mock("../../../subscription/useSubscriptionStore");
vi.mock("../../../store/useBillingStore");

import useSubscriptionStore from "../../../subscription/useSubscriptionStore";
import useBillingStore from "../../../store/useBillingStore";
import GracePeriodBanner from "../GracePeriodBanner";

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockOpenManageSubscription = vi.fn();

function setSubscriptionState(
  rawStatus: string | null,
  gracePeriodEnd: string | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (
    useSubscriptionStore as unknown as ReturnType<typeof vi.fn>
  ).mockImplementation((selector: any) =>
    selector({ rawStatus, gracePeriodEnd }),
  );
}

function setManageSubscription(fn = mockOpenManageSubscription) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: any) => selector({ openManageSubscription: fn }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setManageSubscription();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GracePeriodBanner — visibility", () => {
  it("renders an alert banner when status is grace_period", () => {
    setSubscriptionState("grace_period", "2099-06-15T10:00:00Z");
    render(<GracePeriodBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders nothing when status is active", () => {
    setSubscriptionState("active", null);
    const { container } = render(<GracePeriodBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is free", () => {
    setSubscriptionState("free", null);
    const { container } = render(<GracePeriodBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is expired", () => {
    setSubscriptionState("expired", null);
    const { container } = render(<GracePeriodBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is null", () => {
    setSubscriptionState(null, null);
    const { container } = render(<GracePeriodBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("GracePeriodBanner — message content", () => {
  it("shows a payment issue message", () => {
    setSubscriptionState("grace_period", "2099-06-15T10:00:00Z");
    render(<GracePeriodBanner />);
    // Check that the headline text specifically contains payment/billing language
    expect(screen.getByText(/payment issue/i)).toBeInTheDocument();
  });

  it("shows the grace period end date when gracePeriodEnd is set", () => {
    setSubscriptionState("grace_period", "2099-06-15T10:00:00Z");
    render(<GracePeriodBanner />);
    // The formatted date should contain the year 2099
    expect(screen.getByText(/2099/)).toBeInTheDocument();
  });

  it("does not show a date when gracePeriodEnd is null", () => {
    setSubscriptionState("grace_period", null);
    render(<GracePeriodBanner />);
    // Should still show the banner — but without a date
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/2099/)).not.toBeInTheDocument();
  });
});

describe("GracePeriodBanner — Fix Payment button", () => {
  it('renders a "Fix Payment" button', () => {
    setSubscriptionState("grace_period", "2099-06-15T10:00:00Z");
    render(<GracePeriodBanner />);
    expect(
      screen.getByRole("button", { name: /fix payment/i }),
    ).toBeInTheDocument();
  });

  it("calls openManageSubscription when Fix Payment is clicked", async () => {
    setSubscriptionState("grace_period", "2099-06-15T10:00:00Z");
    render(<GracePeriodBanner />);
    await userEvent.click(screen.getByRole("button", { name: /fix payment/i }));
    expect(mockOpenManageSubscription).toHaveBeenCalledOnce();
  });
});
