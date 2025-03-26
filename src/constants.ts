import dotenv from "dotenv";

dotenv.config();

export const SQLite_DB_FILE = process.env.SQLite_DB_FILE;
export const ELIZA_SERVER_URL = process.env.ELIZA_SERVER_URL;
const INFURA_KEY = "FAKE_INFURA_KEY";

export type ChainDetail = {
  name: string;
  RPCurl: string;
  chainId: number;
};

export const CHAIN_DETAILS: Record<string, ChainDetail> = {
  1: {
    name: "mainnet",
    RPCurl: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    chainId: 1,
  },
  11155111: {
    name: "sepolia",
    RPCurl: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
    chainId: 11155111,
  },
  42161: {
    name: "arbitrum-mainnet",
    RPCurl: `https://arbitrum-mainnet.infura.io/v3/${INFURA_KEY}`,
    chainId: 42161,
  },
  80001: {
    name: "polygon-mumbai",
    RPCurl: `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`,
    chainId: 80001,
  },
  137: {
    name: "polygon-mainnet",
    RPCurl: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
    chainId: 137,
  },
  10: {
    name: "optimism-mainnet",
    RPCurl: `https://optimism-mainnet.infura.io/v3/${INFURA_KEY}`,
    chainId: 10,
  },
  8453: {
    name: "base-mainnet",
    RPCurl: `https://base.drpc.org`,
    chainId: 8453,
  },
  84532: {
    name: "base-sepolia",
    RPCurl: `https://sepolia.base.org`,
    chainId: 84532,
  },
  17000: {
    name: "holesky",
    RPCurl: `https://holesky.infura.io/v3/${INFURA_KEY}`,
    chainId: 17000,
  },
  59144: {
    name: "linea-mainnet",
    RPCurl: `https://linea-mainnet.infura.io/v3/${INFURA_KEY}`,
    chainId: 59144,
  },
  59145: {
    name: "linea-sepolia",
    RPCurl: `https://linea-sepolia.infura.io/v3/${INFURA_KEY}`,
    chainId: 59145,
  },
};

let productionMode = process.env.NODE_ENV === "production";
export function consoleLog(...args: any[]) {
    if (!productionMode) {
        console.log(...args);
    }
}