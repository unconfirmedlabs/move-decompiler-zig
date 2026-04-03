import type { Network } from "./sui";

const STORAGE_KEY = "move-decompiler-network";
const VALID: Set<string> = new Set(["mainnet", "testnet", "devnet", "localnet"]);

export function getStoredNetwork(): Network {
  const val = localStorage.getItem(STORAGE_KEY);
  return val && VALID.has(val) ? (val as Network) : "mainnet";
}

export function setStoredNetwork(network: Network) {
  localStorage.setItem(STORAGE_KEY, network);
}

export function resolveNetwork(queryParam?: string): Network {
  if (queryParam && VALID.has(queryParam)) return queryParam as Network;
  return getStoredNetwork();
}
