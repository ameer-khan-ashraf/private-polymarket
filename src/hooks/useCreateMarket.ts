import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { supabase } from "../lib/supabaseClient";
import PrivateMarketABI from "../lib/abi/PrivateMarket.json";
import { decodeEventLog, parseGwei } from "viem";

export type CreateMarketParams = {
  question: string;
  resolutionDate: string;
};

export function useCreateMarket() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const minPriorityFeePerGas = parseGwei("30");
  const maxFeePerGas = parseGwei("60");

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : "Unknown error";

  const createMarket = async ({
    question,
    resolutionDate,
  }: CreateMarketParams) => {
    setIsLoading(true);
    setError(null);
    setStatus("Initializing market metadata...");

    let supabaseId: string | null = null;

    try {
      // Step A: Insert into Supabase (Pending)
      // We use a temporary distinct negative ID or allow null if schema permits.
      // Since schema has UNIQUE constraint on chain_market_id, and it is NOT NULL (based on migration),
      // we must provide a unique temporary ID.
      // A large negative random number is a safe bet for a few concurrent users.
      const tempChainId = Math.floor(Math.random() * 1000000000) * -1;

      const { data: marketData, error: dbError } = await supabase
        .from("markets")
        .insert([
          {
            question_text: question,
            resolution_time: new Date(resolutionDate).toISOString(),
            creator_address: address || "UNKNOWN",
            chain_market_id: tempChainId,
          },
        ])
        .select()
        .single();

      if (dbError) throw new Error(`Supabase Error: ${dbError.message}`);
      supabaseId = marketData.id;

      setStatus("Metadata created. Please confirm transaction in wallet...");

      // Step B: Write to Blockchain
      const resolutionTimestamp = Math.floor(
        new Date(resolutionDate).getTime() / 1000,
      );

      const hash = await writeContractAsync({
        address: process.env
          .NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS as `0x${string}`,
        abi: PrivateMarketABI,
        functionName: "createMarket",
        args: [BigInt(resolutionTimestamp)],
        maxPriorityFeePerGas: minPriorityFeePerGas,
        maxFeePerGas,
      });

      setStatus("Transaction submitted. Waiting for confirmation...");

      // Step C: Wait for Receipt & Link
      if (!publicClient) throw new Error("Public Client not available");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse Logs to get real marketId
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
        } catch {
          // Ignore logs that don't match or fail decode
        }
      }

      if (marketId === null) {
        throw new Error("MarketCreated event not found in transaction logs");
      }

      setStatus(
        `Market created on-chain (ID: ${marketId}). Linking metadata...`,
      );

      // Step D: Update Supabase
      const { error: updateError } = await supabase
        .from("markets")
        .update({ chain_market_id: Number(marketId) }) // Convert BigInt to number
        .eq("id", supabaseId);

      if (updateError)
        throw new Error(`Failed to link market: ${updateError.message}`);

      setStatus("Success! Market created and linked.");
      setIsLoading(false);
      return { success: true, marketId: Number(marketId), supabaseId };
    } catch (err: unknown) {
      console.error(err);
      const message = getErrorMessage(err);
      setError(message);
      setStatus("Failed.");
      setIsLoading(false);

      // Rollback: Delete Supabase row if it exists and we failed BEFORE linking (or parsing)
      if (supabaseId) {
        console.warn("Rolling back Supabase entry...");
        await supabase.from("markets").delete().eq("id", supabaseId);
      }
      return { success: false, error: message };
    }
  };

  return {
    createMarket,
    isLoading,
    status,
    error,
  };
}
