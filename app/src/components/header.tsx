import { Link } from "@tanstack/react-router";
import type { Network } from "@/lib/sui";
import { getStoredNetwork, setStoredNetwork } from "@/lib/network";
import { useState } from "react";

const NETWORKS: Network[] = ["mainnet", "testnet", "devnet", "localnet"];

export function Header() {
  const [network, setNetworkState] = useState<Network>(getStoredNetwork());

  const setNetwork = (n: Network) => {
    setNetworkState(n);
    setStoredNetwork(n);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent("network-change", { detail: n }));
  };

  return (
    <header className="shrink-0 border-b px-6 py-4">
      <div className="mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            className="size-6 rounded-md"
          >
            <rect
              width="32"
              height="32"
              fill="currentColor"
              className="text-foreground"
            />
            <circle cx="8" cy="16" r="3.5" className="fill-background" />
            <circle cx="16" cy="16" r="3.5" className="fill-background" />
            <circle cx="24" cy="16" r="3.5" className="fill-background" />
          </svg>
          <h1 className="text-lg font-semibold tracking-tight">
            Move Decompiler
          </h1>
        </Link>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
          className="rounded-3xl border border-transparent bg-input/50 px-4 py-1.5 font-mono text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {NETWORKS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
