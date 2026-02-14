import React from "react";
import { TrendingUp } from "lucide-react";
import { formatEther } from "viem";

type TugOfWarProps = {
  yesPool: bigint;
  noPool: bigint;
};

export const TugOfWar = ({ yesPool, noPool }: TugOfWarProps) => {
  const totalPool = yesPool + noPool;
  const yesPercent =
    totalPool > BigInt(0) ? Number((yesPool * BigInt(100)) / totalPool) : 50;
  const noPercent = 100 - yesPercent;

  return (
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-400" />
        Market Sentiment
      </h3>

      <div className="relative h-12 bg-gray-700 rounded-full overflow-hidden flex font-bold text-sm">
        {/* YES Section */}
        <div
          className="bg-emerald-500 text-emerald-950 flex items-center justify-start px-4 transition-all duration-500 ease-out"
          style={{ width: `${yesPercent}%` }}
        >
          {yesPercent > 10 && `YES ${yesPercent}%`}
        </div>

        {/* NO Section */}
        <div className="bg-rose-500 text-rose-950 flex items-center justify-end px-4 transition-all duration-500 ease-out flex-1">
          {noPercent > 10 && `${noPercent}% NO`}
        </div>
      </div>

      <div className="flex justify-between mt-3 text-sm text-gray-400">
        <div>Pool: {formatEther(yesPool)} ETH</div>
        <div>Pool: {formatEther(noPool)} ETH</div>
      </div>
    </div>
  );
};
