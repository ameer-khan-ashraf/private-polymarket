import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "viem/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const config = getDefaultConfig({
  appName: "Private Polymarket",
  projectId: walletConnectProjectId,
  chains: [polygonAmoy],
  ssr: false,
});
