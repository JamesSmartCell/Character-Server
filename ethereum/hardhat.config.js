"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("@nomicfoundation/hardhat-verify");
require('@openzeppelin/hardhat-upgrades');
let { PRIVATE_KEY, INFURA_KEY, ETHERSCAN_API_KEY, PRIVATE_KEY2, POLYGONSCAN_API_KEY, BASESCAN_API_KEY, ARBITRUM_API_KEY, OPTIMISM_API_KEY } = process.env;
const config = {
    solidity: { compilers: [{ version: "0.8.24" }, { version: "0.8.24" }], settings: { optimizer: { enabled: true, runs: 400 }, evmVersion: "cancun" } },
    networks: {
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: [`${PRIVATE_KEY}`]
        },
        sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
            accounts: [`${PRIVATE_KEY}`],
        },
        holesky: {
            url: `https://holesky.infura.io/v3/${INFURA_KEY}`,
            //url: `http://192.168.50.184:8545`,
            accounts: [`${PRIVATE_KEY}`],
        },
        baseSepolia: {
            url: `https://sepolia.base.org`,
            accounts: [`${PRIVATE_KEY}`]
        },
        klaytnbaobab: {
            url: `https://klaytn-baobab.blockpi.network/v1/rpc/public`,
            accounts: [`${PRIVATE_KEY}`]
        },
        klaytn: {
            url: `https://public-en.node.kaia.io`,
            accounts: [`${PRIVATE_KEY}`]
        },
        amoy: {
            url: `https://polygon-amoy.infura.io/v3/${INFURA_KEY}`,
            accounts: [`${PRIVATE_KEY}`]
        },
        base: {
            url: `https://developer-access-mainnet.base.org`,
            accounts: [`${PRIVATE_KEY}`]
        },
        polygon: {
            url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: [`${PRIVATE_KEY}`]
        },
        mantlesepolia: {
            url: `https://rpc.sepolia.mantle.xyz`,
            accounts: [`${PRIVATE_KEY}`]
        },
        mantle: {
            url: `https://rpc.mantle.xyz`,
            accounts: [`${PRIVATE_KEY}`]
        },
        arbitrum: {
            url: `https://rpc.ankr.com/arbitrum`,
            accounts: [`${PRIVATE_KEY}`]
        },
        arbitrumsepolia: {
            url: `https://arbitrum-sepolia.infura.io/v3/${INFURA_KEY}`,
            accounts: [`${PRIVATE_KEY}`]
        },
        hardhat: {
            gasPrice: 100000000000,
            allowUnlimitedContractSize: true,
        },
        mint: {
            url: `https://global.rpc.mintchain.io`,
            accounts: [`${PRIVATE_KEY}`]
        },
        mintsepolia: {
            url: `https://sepolia-testnet-rpc.mintchain.io`,
            accounts: [`${PRIVATE_KEY}`]
        },
        optimism: {
            url: `https://mainnet.optimism.io`,
            accounts: [`${PRIVATE_KEY}`]
        }
    },
    etherscan: {
        apiKey: {
            mint: "empty",
            optimisticEthereum: `${OPTIMISM_API_KEY}`,
            arbitrumOne: `${ARBITRUM_API_KEY}`,
            mainnet: `${ETHERSCAN_API_KEY}`,
            holesky: `${ETHERSCAN_API_KEY}`,
            polygon: `${POLYGONSCAN_API_KEY}`,
            base: `${BASESCAN_API_KEY}`,
            baseSepolia: `${BASESCAN_API_KEY}`,
        },
        customChains: [
            {
                network: "mint",
                chainId: 185,
                urls: {
                    apiURL: "https://explorer.mintchain.io/api",
                    browserURL: "https://explorer.mintchain.io:443"
                }
            }
        ]
    }
};
exports.default = config;
