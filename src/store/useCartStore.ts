/**
 * Cart store — persisted to localStorage per user ID.
 * No DB table needed.
 */
import { create } from "zustand";

export type CartItem = {
  productId: string;
  name: string;
  imageUrl: string;
  unit: string;
  quantity: number;
};

type CartStore = {
  userId: string | null;
  items: CartItem[];
  /** Must be called once after auth resolves */
  init: (userId: string) => void;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  total: () => number;
};

function storageKey(userId: string) {
  return `vfc_cart_${userId}`;
}

function loadItems(userId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveItems(userId: string, items: CartItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export const useCartStore = create<CartStore>((set, get) => ({
  userId: null,
  items: [],

  init(userId) {
    const items = loadItems(userId);
    set({ userId, items });
  },

  add(item, qty = 1) {
    const { userId, items } = get();
    const existing = items.find((i) => i.productId === item.productId);
    let next: CartItem[];
    if (existing) {
      next = items.map((i) =>
        i.productId === item.productId
          ? { ...i, quantity: i.quantity + qty }
          : i,
      );
    } else {
      next = [...items, { ...item, quantity: qty }];
    }
    set({ items: next });
    if (userId) saveItems(userId, next);
  },

  setQty(productId, qty) {
    const { userId, items } = get();
    const next =
      qty <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.map((i) =>
            i.productId === productId ? { ...i, quantity: qty } : i,
          );
    set({ items: next });
    if (userId) saveItems(userId, next);
  },

  remove(productId) {
    const { userId, items } = get();
    const next = items.filter((i) => i.productId !== productId);
    set({ items: next });
    if (userId) saveItems(userId, next);
  },

  clear() {
    const { userId } = get();
    set({ items: [] });
    if (userId) saveItems(userId, []);
  },

  total() {
    return get().items.reduce((s, i) => s + i.quantity, 0);
  },
}));
