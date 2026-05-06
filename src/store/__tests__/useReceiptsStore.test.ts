import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "../../lib/supabase";
import useReceiptsStore from "../useReceiptsStore";

const fakeReceipts = [
  {
    id: "r1",
    order_id: "GPA.3303-0001",
    product_id: "budget_planner_paid_monthly",
    purchase_token: "tok-aaa",
    status: "purchased",
    purchased_at: "2026-04-01T10:00:00Z",
    expires_at: "2026-05-01T10:00:00Z",
  },
  {
    id: "r2",
    order_id: "GPA.3303-0002",
    product_id: "budget_planner_paid_monthly",
    purchase_token: "tok-bbb",
    status: "purchased",
    purchased_at: "2026-05-01T10:00:00Z",
    expires_at: "2026-06-01T10:00:00Z",
  },
];

function mockSupabaseFrom(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  useReceiptsStore.setState({
    records: [],
    loading: false,
    error: null,
    _lastUserId: null,
  });
});

// ─── loadReceipts() ───────────────────────────────────────────────────────────

describe("loadReceipts", () => {
  it("queries purchase_history for the given userId", async () => {
    const chain = mockSupabaseFrom({ data: fakeReceipts, error: null });

    await useReceiptsStore.getState().loadReceipts("uid-1");

    expect(supabase.from).toHaveBeenCalledWith("purchase_history");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "uid-1");
  });

  it("populates records on success", async () => {
    mockSupabaseFrom({ data: fakeReceipts, error: null });

    await useReceiptsStore.getState().loadReceipts("uid-1");

    const { records } = useReceiptsStore.getState();
    expect(records).toHaveLength(2);
    expect(records[0].orderId).toBe("GPA.3303-0001");
    expect(records[0].status).toBe("purchased");
  });

  it("sets loading true while fetching, then false on success", async () => {
    let capturedLoading = false;
    mockSupabaseFrom({ data: fakeReceipts, error: null });

    const promise = useReceiptsStore.getState().loadReceipts("uid-1");
    capturedLoading = useReceiptsStore.getState().loading;
    await promise;

    expect(capturedLoading).toBe(true);
    expect(useReceiptsStore.getState().loading).toBe(false);
  });

  it("sets error on Supabase failure", async () => {
    mockSupabaseFrom({ data: null, error: { message: "network error" } });

    await useReceiptsStore.getState().loadReceipts("uid-1");

    expect(useReceiptsStore.getState().error).toMatch(/load/i);
    expect(useReceiptsStore.getState().loading).toBe(false);
  });

  it("sets empty records (not error) when there are no purchases", async () => {
    mockSupabaseFrom({ data: [], error: null });

    await useReceiptsStore.getState().loadReceipts("uid-1");

    expect(useReceiptsStore.getState().records).toHaveLength(0);
    expect(useReceiptsStore.getState().error).toBeNull();
  });

  it("stores the userId so callers can retry without passing it again", async () => {
    mockSupabaseFrom({ data: fakeReceipts, error: null });

    await useReceiptsStore.getState().loadReceipts("uid-1");

    expect(useReceiptsStore.getState()._lastUserId).toBe("uid-1");
  });
});

// ─── retry() ─────────────────────────────────────────────────────────────────

describe("retry", () => {
  it("calls loadReceipts again with the last userId", async () => {
    mockSupabaseFrom({ data: fakeReceipts, error: null });
    useReceiptsStore.setState({
      _lastUserId: "uid-1",
      records: [],
      loading: false,
      error: "oops",
    });

    await useReceiptsStore.getState().retry();

    expect(supabase.from).toHaveBeenCalledWith("purchase_history");
    expect(useReceiptsStore.getState().error).toBeNull();
  });

  it("does nothing when there is no last userId", async () => {
    useReceiptsStore.setState({ _lastUserId: null });

    await useReceiptsStore.getState().retry();

    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─── openPlayReceipt() ───────────────────────────────────────────────────────

describe("openPlayReceipt", () => {
  it("calls window.open with a Google Play URL", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    useReceiptsStore.getState().openPlayReceipt("GPA.3303-0001");

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("play.google.com"),
      "_blank",
    );
  });
});

// ─── clearError() ─────────────────────────────────────────────────────────────

describe("clearError", () => {
  it("resets error to null", () => {
    useReceiptsStore.setState({ error: "something went wrong" });

    useReceiptsStore.getState().clearError();

    expect(useReceiptsStore.getState().error).toBeNull();
  });
});
