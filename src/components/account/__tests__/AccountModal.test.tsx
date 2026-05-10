import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock("../../../subscription/useSubscriptionStore");
vi.mock("../../../store/useBillingStore");
vi.mock("../SupportPanel", () => ({ default: () => null }));

import useProfileStore, {
  type Profile,
} from "../../../profile/useProfileStore";
import useAuthStore from "../../../auth/useAuthStore";
import useSubscriptionStore from "../../../subscription/useSubscriptionStore";
import useBillingStore from "../../../store/useBillingStore";
import AccountModal from "../AccountModal";

const fakeSession = {
  user: {
    id: "user-123",
    email: "alice@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
  },
  access_token: "tok",
  refresh_token: "ref",
} as never;

const fakeSessionUnverified = {
  user: {
    id: "user-123",
    email: "alice@example.com",
    email_confirmed_at: null,
  },
  access_token: "tok",
  refresh_token: "ref",
} as never;

const fakeProfile: Profile = {
  user_id: "user-123",
  display_name: "Alice",
  plan: "free",
  subscription_status: "active",
  renewal_date: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    session: fakeSession,
    loading: false,
    error: null,
    info: null,
    failedAttempts: 0,
    lockedUntil: null,
    emailSuccess: null,
    emailError: null,
  });
  useProfileStore.setState({
    profile: fakeProfile,
    loading: false,
    saving: false,
    error: null,
  });
  // Prevent loadProfile from hitting Supabase in tests that set state directly
  vi.spyOn(useProfileStore.getState(), "loadProfile").mockResolvedValue(
    undefined,
  );

  // Default: not in trial (called with selector)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (
    useSubscriptionStore as unknown as ReturnType<typeof vi.fn>
  ).mockImplementation((selector: any) =>
    selector({ rawStatus: null, trialEndsAt: null, trialStartedAt: null }),
  );

  // useBillingStore is called without a selector (destructuring pattern)
  (useBillingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    status: "idle",
    error: null,
    purchase: vi.fn(),
    openManageSubscription: vi.fn(),
    clearError: vi.fn(),
  });
});

describe("AccountModal", () => {
  it("renders email in an editable input", () => {
    render(<AccountModal onClose={vi.fn()} />);
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    expect(emailInput).toHaveValue("alice@example.com");
  });

  it("renders display name in an editable input", () => {
    render(<AccountModal onClose={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /display name/i });
    expect(input).toHaveValue("Alice");
  });

  it("renders plan as Free chip", () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders subscription status", () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows a hint that a confirmation email will be sent on change", () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByText(/confirmation email will be sent/i),
    ).toBeInTheDocument();
  });

  it("calls updateDisplayName with new name on save", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    useProfileStore.setState({
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    vi.spyOn(
      useProfileStore.getState(),
      "updateDisplayName",
    ).mockImplementation(mockUpdate);

    render(<AccountModal onClose={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: /display name/i });
    await userEvent.clear(input);
    await userEvent.type(input, "Bob");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("user-123", "Bob"),
    );
  });

  it("disables save button while saving", () => {
    useProfileStore.setState({
      profile: fakeProfile,
      loading: false,
      saving: true,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows error message when save fails", () => {
    useProfileStore.setState({
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: "Failed to save profile",
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
  });

  it("shows loading state while profile is loading", () => {
    useProfileStore.setState({
      profile: null,
      loading: true,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<AccountModal onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AccountModal — email verification banner", () => {
  beforeEach(() => {
    vi.spyOn(useProfileStore.getState(), "loadProfile").mockResolvedValue(
      undefined,
    );
  });

  it("shows verification banner when email is not confirmed", () => {
    useAuthStore.setState({
      session: fakeSessionUnverified,
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
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
  });

  it("does not show verification banner when email is confirmed", () => {
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
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows resend button in the banner for unverified users", () => {
    useAuthStore.setState({
      session: fakeSessionUnverified,
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
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument();
  });

  it("calls resendVerification with the user email when resend is clicked", async () => {
    const mockResendFn = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      session: fakeSessionUnverified,
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
      profile: fakeProfile,
      loading: false,
      saving: false,
      error: null,
    });
    vi.spyOn(useAuthStore.getState(), "resendVerification").mockImplementation(
      mockResendFn,
    );

    render(<AccountModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() =>
      expect(mockResendFn).toHaveBeenCalledWith("alice@example.com"),
    );
  });

  it("disables start free trial button when email is not confirmed", () => {
    useAuthStore.setState({
      session: fakeSessionUnverified,
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
      profile: { ...fakeProfile, plan: "free" },
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /start free trial/i }),
    ).toBeDisabled();
  });

  it("enables start free trial button when email is confirmed", () => {
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
      profile: { ...fakeProfile, plan: "free" },
      loading: false,
      saving: false,
      error: null,
    });
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /start free trial/i }),
    ).not.toBeDisabled();
  });
});

describe("AccountModal — email update", () => {
  beforeEach(() => {
    vi.spyOn(useProfileStore.getState(), "loadProfile").mockResolvedValue(
      undefined,
    );
  });

  it("shows an Update Email button", () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /update email/i }),
    ).toBeInTheDocument();
  });

  it("disables Update Email when the input matches the current email", () => {
    render(<AccountModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /update email/i }),
    ).toBeDisabled();
  });

  it("enables Update Email when the user types a different address", async () => {
    render(<AccountModal onClose={vi.fn()} />);
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "new@example.com");
    expect(
      screen.getByRole("button", { name: /update email/i }),
    ).not.toBeDisabled();
  });

  it("calls updateEmail with the new address on click", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAuthStore.getState(), "updateEmail").mockImplementation(
      mockUpdate,
    );

    render(<AccountModal onClose={vi.fn()} />);
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "new@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /update email/i }),
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("new@example.com"),
    );
  });

  it("shows success message after successful update", async () => {
    vi.spyOn(useAuthStore.getState(), "updateEmail").mockImplementation(
      async () => {
        useAuthStore.setState({
          emailSuccess:
            "Verification email sent. Check your inbox to confirm the new address.",
          emailError: null,
        });
      },
    );

    render(<AccountModal onClose={vi.fn()} />);
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "new@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /update email/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/verification email sent/i)).toBeInTheDocument(),
    );
  });

  it("shows error message when update fails", async () => {
    vi.spyOn(useAuthStore.getState(), "updateEmail").mockImplementation(
      async () => {
        useAuthStore.setState({
          emailError: "Email address already in use",
          emailSuccess: null,
        });
      },
    );

    render(<AccountModal onClose={vi.fn()} />);
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "taken@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: /update email/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/already in use/i)).toBeInTheDocument(),
    );
  });
});
