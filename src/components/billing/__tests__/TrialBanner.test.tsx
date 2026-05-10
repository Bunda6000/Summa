import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../subscription/useSubscriptionStore");
vi.mock("../../../store/useBillingStore");

import useSubscriptionStore from "../../../subscription/useSubscriptionStore";
import useBillingStore from "../../../store/useBillingStore";
import TrialBanner from "../TrialBanner";

const mockPurchase = vi.fn();

function setSubscriptionState(
  rawStatus: string | null,
  trialEndsAt: string | null,
  trialStartedAt: string | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (
    useSubscriptionStore as unknown as ReturnType<typeof vi.fn>
  ).mockImplementation((selector: any) =>
    selector({ rawStatus, trialEndsAt, trialStartedAt }),
  );
}

function setBillingStore(fn = mockPurchase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: any) => selector({ purchase: fn }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setBillingStore();
});

describe("TrialBanner — visibility", () => {
  it("renders an alert banner when status is trial", () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders nothing when status is active", () => {
    setSubscriptionState("active", null, null);
    const { container } = render(<TrialBanner userId="user-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is free", () => {
    setSubscriptionState("free", null, null);
    const { container } = render(<TrialBanner userId="user-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is grace_period", () => {
    setSubscriptionState("grace_period", null, null);
    const { container } = render(<TrialBanner userId="user-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when status is null", () => {
    setSubscriptionState(null, null, null);
    const { container } = render(<TrialBanner userId="user-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TrialBanner — message content", () => {
  it("shows trial-related headline text", () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    expect(screen.getByText(/free trial active/i)).toBeInTheDocument();
  });

  it("shows the trial end date when trialEndsAt is set", () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    expect(screen.getByText(/Jun 15, 2099/)).toBeInTheDocument();
  });

  it("shows the trial start date when trialStartedAt is set", () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    expect(screen.getByText(/Jun 8, 2099/)).toBeInTheDocument();
  });
});

describe("TrialBanner — Subscribe Now button", () => {
  it('renders a "Subscribe Now" button', () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    expect(
      screen.getByRole("button", { name: /subscribe now/i }),
    ).toBeInTheDocument();
  });

  it("calls purchase with userId when Subscribe Now is clicked", async () => {
    setSubscriptionState(
      "trial",
      "2099-06-15T10:00:00Z",
      "2099-06-08T10:00:00Z",
    );
    render(<TrialBanner userId="user-1" />);
    await userEvent.click(
      screen.getByRole("button", { name: /subscribe now/i }),
    );
    expect(mockPurchase).toHaveBeenCalledWith("user-1");
  });
});
