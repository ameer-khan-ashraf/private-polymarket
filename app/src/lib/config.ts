import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "viem/chains";
import { fallback, http } from "viem";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

// Override rpcUrls so MetaMask gets a working RPC when it switches to Amoy.
// The viem default (rpc-amoy.polygon.technology) is CORS-blocked from browsers.
const amoyChain = {
  ...polygonAmoy,
  rpcUrls: {
    default: { http: ["https://polygon-amoy.drpc.org"] },
    public: { http: ["https://polygon-amoy.drpc.org", "https://polygon-amoy-bor-rpc.publicnode.com"] },
  },
};

export const config = getDefaultConfig({
  appName: "Private Polymarket",
  projectId: walletConnectProjectId,
  chains: [amoyChain],
  transports: {
    [amoyChain.id]: fallback([
      ...(process.env.NEXT_PUBLIC_AMOY_RPC_URL
        ? [http(process.env.NEXT_PUBLIC_AMOY_RPC_URL, { retryCount: 0, timeout: 8_000 })]
        : []),
      http("https://polygon-amoy.drpc.org", { retryCount: 0, timeout: 8_000 }),
      http("https://polygon-amoy-bor-rpc.publicnode.com", { retryCount: 0, timeout: 8_000 }),
    ], {
      rank: false,
      retryCount: 2,
      retryDelay: 200,
    }),
  },
  ssr: false,
});
