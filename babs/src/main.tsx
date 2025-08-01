import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

import App from "./App.tsx";
import { config } from "./wagmi.ts";

import "./index.css";

const queryClient = new QueryClient();

// Initialize Farcaster SDK and hide splash screen when app is ready
const initFarcasterSDK = async () => {
  try {
    // Wait for the app to be fully loaded
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(true);
      } else {
        window.addEventListener('load', resolve);
      }
    });
    
    // Hide the splash screen
    await sdk.actions.ready();
    console.log('Farcaster SDK initialized successfully');
  } catch (error) {
    console.warn('Farcaster SDK initialization failed:', error);
  }
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);

// Initialize Farcaster SDK after React renders
initFarcasterSDK();
