import dotenv from "dotenv";
import { z } from "zod"

dotenv.config();

export const SQLite_DB_FILE = process.env.SQLite_DB_FILE;
export const ELIZA_SERVER_URL = process.env.ELIZA_SERVER_URL;
export const ELIZA_CONTROL_URL = process.env.ELIZA_CONTROL_URL;
export const CERT_PATH = process.env.CERT_PATH;
export const NODE_ENV = process.env.NODE_ENV;
export const CLOUDFLARE_URL = process.env.CLOUDFLARE_URL;
export const CLOUDFLARE_PUBLIC_URL = process.env.CLOUDFLARE_PUBLIC_URL;
export const CLOUDFLARE_ACCESS_KEY = process.env.CLOUDFLARE_ACCESS_KEY;
export const CLOUDFLARE_SECRET_KEY = process.env.CLOUDFLARE_SECRET_KEY;
export const NOVITA_API_KEY = process.env.NOVITA_API_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;

export const IMAGES_FOLDER = "../images";
export const SCRIPTS_FOLDER = "../scripts";

const INFURA_KEY = "FAKE_INFURA_KEY";

export type ChainDetail = {
  name: string;
  RPCurl: string;
  chainId: number;
};

export const CHAIN_TO_CONTRACT: Record<string, string> = {
  "84532": "0x8b0fefd94667fdd8cef52f8c1eeb5baec8d64a00",
  "8453": "",
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

//schema for the prefill agent profile
export const prefillAgentProfileSchema = z.object({
  nftDescription: z.string(),
  nftAttributes: z.array(z.object({
    trait_type: z.string(),
    value: z.string(),
  })),
  agentTraits: z.object({
    name: z.string(),
    bio: z.array(z.string()),
    lore: z.array(z.string()),
    topics: z.array(z.string()),
    style: z.object({
      all: z.array(z.string()),
      chat: z.array(z.string()),
      post: z.array(z.string()),
    }),
  }),
  examples: z.object({
    messageExamples: z.array(
      z.array(
        z.object({ user: z.string(), content: z.object({ text: z.string() }) })
      )
    ),
    postExamples: z.array(z.string()),
  }),
  adjectives: z.array(z.string()),
})