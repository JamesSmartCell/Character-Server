import dotenv from "dotenv";
import { ethers } from "hardhat";
import { getContractAddress } from '@ethersproject/address';
import hre from "hardhat";
const { upgrades } = require("hardhat");

dotenv.config();

const aiBaseTokenAddress = "0x794482Ab124B3ae94521AFeB01f0406c1e1449Ce";
const aiBaseDeploymentAddress = "0x4b0e68010646ce0ac125a5a57c1baf2dfe4cd232";

const aiHoleskyTokenAddress = "0x203Ea32130251f4A2391291425166a4AD87ECfB7";
const aiHoleskyDeploymentAddress = "0x203Ea32130251f4A2391291425166a4AD87ECfB7";

const aiBaseSepoliaTokenAddress = "0x8b0fefd94667fdd8cef52f8c1eeb5baec8d64a00";
const aiBaseSepoliaDeploymentAddress = "0xB7C31C0731DE35e1c2577Cde493D94ca453eA4DF";

// Helper script to re-assign ownership of ENS domain to the registry contract
async function main() {
    let tokenAddress;
    let contractAddress;
    let scriptURI;
    let privateKey;

    const network = await ethers.provider.getNetwork();

    if (network.name === "base") {
        tokenAddress = aiBaseTokenAddress;
        contractAddress = aiBaseDeploymentAddress;
        //console.log(`Base Script URI: ${scriptURI}`);
        privateKey = process.env.PRIVATE_KEY;
    } else if (network.name === "holesky") {
        tokenAddress = aiHoleskyTokenAddress;
        contractAddress = aiHoleskyDeploymentAddress;
        //console.log(`Holesky Script URI: ${scriptURI}`);
        privateKey = process.env.PRIVATE_KEY_2;
    } else if (network.name === "baseSepolia") {
        tokenAddress = aiBaseSepoliaTokenAddress;
        contractAddress = aiBaseSepoliaDeploymentAddress;
        //console.log(`Base Sepolia Script URI: ${scriptURI}`);
        privateKey = process.env.PRIVATE_KEY_2;
    } else {
        throw new Error(`NETWORK not found in .env file: ${network}`);
    }

    if (!privateKey) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

    const primaryDeployKey = new ethers.Wallet(privateKey, ethers.provider);
    console.log(`ADDR: ${primaryDeployKey.address}`);

    const AIToken = await ethers.getContractFactory("AgentToken");

    //Deploy
    const aiToken = await upgrades.deployProxy(AIToken.connect(primaryDeployKey), ["Agents of Advocacy", "AoA", tokenAddress], { kind: 'uups' });
    await aiToken.waitForDeployment();
    //wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));


    //connect to the existing contract
    //const aiToken = AIToken.attach(contractAddress);


    console.log(`AIToken: ${aiToken.target}`);

    

    // Verify the contract on Etherscan
    await hre.run("verify:verify", {
        address: aiToken.target,
        constructorArguments: ["Agents of Advocacy", "AoA", tokenAddress],
    });

    //wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(aiToken.target);
    console.log(`Implementation Address: ${implementationAddress}`);

    // Verify the contract on Etherscan
    await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [], //"Agents of Advocacy", "AoA", tokenAddress
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

    // to run: npx hardhat run .\scripts\deployContracts.ts --network baseSepolia
    // to verify logic: npx hardhat verify 0x30Af1aea43490e2F03d4d7eF3116b745D7D58c30 --network mainnet 
    // to verify full: npx hardhat verify 0x0077380bCDb2717C9640e892B9d5Ee02Bb5e0682 --network mainnet "ERC-7738 Script Registry", "ERC7738", 0x276d7760fA6774E3AE8F8a7446B88fb2479D38aC, 0x527E7E85cF60390b56bE953888e0cb036682761B

    // verify metadata logic: npx hardhat verify 0x276d7760fA6774E3AE8F8a7446B88fb2479D38aC --network mainnet

    // verify ensAssigner logic: npx hardhat verify 0x527E7E85cF60390b56bE953888e0cb036682761B --network mainnet

// npx hardhat verify 0x30Af1aea43490e2F03d4d7eF3116b745D7D58c30 --network arbitrum
// npx hardhat verify 0x276d7760fA6774E3AE8F8a7446B88fb2479D38aC --network arbitrum
// npx hardhat verify 0x97b0341BEdbC521778B669550774691918202e65 --network arbitrum
// npx hardhat verify 0x527E7E85cF60390b56bE953888e0cb036682761B --network arbitrum
// npx hardhat verify 0x0077380bCDb2717C9640e892B9d5Ee02Bb5e0682 --network arbitrum "ERC-7738 Script Registry", "ERC7738", 0x276d7760fA6774E3AE8F8a7446B88fb2479D38aC, 0x527E7E85cF60390b56bE953888e0cb036682761B
