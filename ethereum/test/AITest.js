"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const { ethers, upgrades } = require("hardhat");
const { getContractAddress } = require('@ethersproject/address');
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
dotenv_1.default.config();
const network_helpers_1 = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const config = {
    solidity: "0.7.0",
};
exports.default = config;
function deployInitialFixture() {
    return __awaiter(this, void 0, void 0, function* () {
        // Contracts are deployed using the first signer/account by default
        const [owner, nftOwner, otherAccount2, otherAccount3, otherAccount4, regOwner] = yield ethers.getSigners();
        let primaryDeploy;
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            primaryDeploy = regOwner;
        }
        else {
            primaryDeploy = new ethers.Wallet(privateKey, ethers.provider);
        }
        // Define amounts to send (for example: 1 ether)
        const amountToSend = ethers.parseEther("1.0");
        // Send transaction to primary deploy key
        const tx1 = yield owner.sendTransaction({
            to: primaryDeploy.address,
            value: amountToSend
        });
        yield tx1.wait(); // Wait for the transaction to be mined
        const AIToken = yield ethers.getContractFactory("AIToken");
        //Deploy
        const aiToken = yield upgrades.deployProxy(AIToken.connect(primaryDeploy), ["AI Model Token", "MDL"], { kind: 'uups' });
        yield aiToken.waitForDeployment();
        console.log(`AIToken: ${aiToken.target}`);
        return {
            owner,
            regOwner,
            nftOwner,
            otherAccount2,
            otherAccount3,
            otherAccount4,
            aiToken,
            primaryDeploy
        };
    });
}
describe("AI Token", function () {
    it("mint and set scriptURI with owner", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { owner, regOwner, nftOwner, otherAccount2, otherAccount3, otherAccount4, aiToken, primaryDeploy } = yield (0, network_helpers_1.loadFixture)(deployInitialFixture);
            const scriptURI = ["https://scripttoken.net/script"];
            //set scriptURI
            yield aiToken.connect(primaryDeploy).setScriptURI(scriptURI);
            //mint a base token
            //takes a tokenhash and a signature
            //create a tokenhash which is a bytes32
            const hexString = '0x093b1202cae93a502fc53e4f9fb8862d46379e6719e8013a4711681dc391116e';
            //const tokenHash = ethers.hexZeroPad("0x093b1202cae93a502fc53e4f9fb8862d46379e6719e8013a4711681dc391116e", 32);
            //const tokenHash = ethers.encodeBytes32String("093b1202cae93a502fc53e4f9fb8862d46379e6719e8013a4711681dc391116e");
            //const bytes32Value = ethers.hexZeroPad(hexString, 32);
            const signature = "0x75ac76f2ff2862ccae003dccaf45645d41bf8494c0789209eaba9b2861bcd9c36cfc1f692ef1f94ba8b50ca3f6cbdea8e9db6db2e458c1b78a380531fafb06231c";
            const byteso = (0, ethers_1.hexlify)(hexString);
            const bytes32 = hexString;
            console.log(byteso);
            const bytes = (0, ethers_1.hexlify)(hexString);
            const dataHexString = hexString;
            // Convert to array
            const bytes32Value = hexStringToUint8Array(hexString);
            //now convert to bytes32
            const bytes32Valuea = ethers.hexlify(bytes32Value);
            console.log(bytes32Valuea); // Output: 0x
            yield aiToken.connect(otherAccount2).mint(dataHexString, signature);
            // mint a derivative
            yield aiToken.connect(otherAccount2).mintDerivative(owner.address, 1, scriptURI);
        });
    });
    function hexStringToUint8Array(hexString) {
        // Remove the '0x' prefix if present
        if (hexString.startsWith('0x') || hexString.startsWith('0X')) {
            hexString = hexString.slice(2);
        }
        // Validate hex string
        if (!/^[0-9a-fA-F]+$/g.test(hexString)) {
            throw new Error('Invalid hex string');
        }
        // Ensure the hex string has an even length
        if (hexString.length % 2 !== 0) {
            hexString = '0' + hexString; // Pad with a leading zero if necessary
        }
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
        }
        return bytes;
    }
});
