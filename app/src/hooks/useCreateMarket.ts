import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { api } from "../lib/apiClient";
import PrivateMarketABI from "../lib/abi/PrivateMarket.json";
import { decodeEventLog, parseGwei } from "viem";

export type CreateMarketParams = {
  question: string;
  description?: string;
  sideALabel?: string;
  sideBLabel?: string;
  resolutionDate: string;
  minStake?: number;
  maxStake?: number;
  inviteCode?: string;
};

export function useCreateMarket() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const maxPriorityFeePerGas = parseGwei("30");
  const maxFeePerGas = parseGwei("60");

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : "Unknown error";

  const createMarket = async (params: CreateMarketParams) => {
    const { 
      question, 
      resolutionDate, 
    } = params;

    setIsLoading(true);
    setError(null);
    setStatus("Initializing market metadata...");

    let supabaseId: string | null = null;

    try {
      const tempChainId = Math.floor(Math.random() * 1000000000) * -1;

      const { data: marketData, error: dbError } = await api.markets.create({
        question_text: question,
        resolution_time: new Date(resolutionDate).toISOString(),
        creator_address: address || "UNKNOWN",
        chain_market_id: tempChainId,
      });

      if (dbError) throw new Error(`API Error: ${dbError.message}`);
      supabaseId = marketData.id;

      setStatus("Metadata created. Please confirm transaction in wallet...");

      const resolutionTimestamp = Math.floor(
        new Date(resolutionDate).getTime() / 1000,
      );

      const hash = await writeContractAsync({
        address: process.env.NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS as `0x${string}`,
        abi: PrivateMarketABI,
        functionName: "createMarket",
        args: [BigInt(resolutionTimestamp)],
        maxPriorityFeePerGas,
        maxFeePerGas,
      });

      setStatus("Transaction submitted. Waiting for confirmation...");

      if (!publicClient) throw new Error("Public Client not available");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let marketId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const check = decodeEventLog({
            abi: PrivateMarketABI,
            data: log.data,
            topics: log.topics,
          });
          if (check.eventName === "MarketCreated") {
            const args = check.args as { marketId?: bigint };
            if (typeof args.marketId === "bigint") {
              marketId = args.marketId;
            }
            break;
          }
        } catch {}
      }

      if (marketId === null) {
        throw new Error("MarketCreated event not found in transaction logs");
      }

      setStatus(`Market created on-chain. Linking metadata...`);

      const { error: updateError } = await api.markets.update(supabaseId!, {
        chain_market_id: Number(marketId),
      });

      if (updateError) throw new Error(`Failed to link market: ${updateError.message}`);

      setStatus("Success! Market created and linked.");
      setIsLoading(false);
      return { success: true, marketId: Number(marketId), supabaseId };
    } catch (err: unknown) {
      console.error(err);
      const message = getErrorMessage(err);
      setError(message);
      setStatus("Failed.");
      setIsLoading(false);

      if (supabaseId) {
        await api.markets.delete(supabaseId);
      }
      return { success: false, error: message };
    }
  };

  return { createMarket, isLoading, status, error };
}
