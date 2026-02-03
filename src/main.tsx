import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";

// Check if we're in the tray popup window
const isTrayPopup = window.location.hash === "#tray";

// Dynamically import tray popup only when needed
const TrayPopupLazy = React.lazy(() =>
  import("./components/tray/tray-popup").then(mod => ({ default: mod.TrayPopup }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isTrayPopup ? (
      <QueryClientProvider client={queryClient}>
        <React.Suspense fallback={<div className="h-screen w-screen" />}>
          <TrayPopupLazy />
        </React.Suspense>
      </QueryClientProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
