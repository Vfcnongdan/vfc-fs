"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "#064E3B",
          color: "#fff",
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
        },
        success: {
          style: {
            background: "#fff",
            color: "#064E3B",
            border: "1px solid rgba(6, 78, 59, 0.16)",
          },
          iconTheme: {
            primary: "#059669",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#EF4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
