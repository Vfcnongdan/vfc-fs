import { create } from 'zustand';

type Crop = {
  id: string;
  name: string;
  cropCode: string;
  imageUrl?: string;
};

interface CropState {
  userCrops: Crop[];
  isLoading: boolean;
  error: string | null;
  fetchUserCrops: (force?: boolean) => Promise<void>;
}

export const useCropStore = create<CropState>((set, get) => ({
  userCrops: [],
  isLoading: false,
  error: null,
  fetchUserCrops: async (force = false) => {
    // Avoid fetching if we already have data and not forcing
    if (get().userCrops.length > 0 && !force) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/farmer/crops");
      if (!res.ok) throw new Error("Failed to fetch crops");
      const data = await res.json();
      set({ userCrops: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      console.error("[CropStore fetchUserCrops]", err);
    }
  },
}));
