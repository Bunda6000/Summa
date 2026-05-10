import { create } from "zustand";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseRecord {
  id: string;
  orderId: string;
  productId: string;
  purchaseToken: string;
  status: "purchased" | "refunded";
  purchasedAt: string;
  expiresAt: string | null;
}

interface ReceiptsState {
  records: PurchaseRecord[];
  loading: boolean;
  error: string | null;
  _lastUserId: string | null;

  loadReceipts: (userId: string) => Promise<void>;
  openPlayReceipt: (orderId: string) => void;
  retry: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useReceiptsStore = create<ReceiptsState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  _lastUserId: null,

  loadReceipts: async (userId) => {
    set({ loading: true, error: null, _lastUserId: userId });

    const { data, error } = await supabase
      .from("purchase_history")
      .select(
        "id, order_id, product_id, purchase_token, status, purchased_at, expires_at",
      )
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false });

    if (error) {
      set({
        loading: false,
        error: "Failed to load billing data. Please try again.",
      });
      return;
    }

    const records: PurchaseRecord[] = (data ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      purchaseToken: row.purchase_token,
      status: row.status as "purchased" | "refunded",
      purchasedAt: row.purchased_at,
      expiresAt: row.expires_at ?? null,
    }));

    set({ loading: false, records });
  },

  openPlayReceipt: (_orderId) => {
    window.open(
      "https://play.google.com/store/account/subscriptions",
      "_blank",
    );
  },

  retry: async () => {
    const { _lastUserId, loadReceipts } = get();
    if (!_lastUserId) return;
    await loadReceipts(_lastUserId);
  },

  clearError: () => set({ error: null }),
}));

export default useReceiptsStore;
