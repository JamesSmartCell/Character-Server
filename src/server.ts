import fastify from "fastify";
import { FastifyInstance } from "fastify/types/instance";
import { ethers } from "ethers";
// @ts-ignore
import {
  NODE_ENV, CERT_PATH, ChainDetail, CHAIN_DETAILS, SQLite_DB_FILE,
  consoleLog,
  SCRIPTS_FOLDER,
  CLOUDFLARE_PUBLIC_URL,
  ELIZA_SERVER_URL,
  ELIZA_CONTROL_URL,
  CHAIN_TO_CONTRACT,
  IMAGES_FOLDER,
  SIGNER_PRIVATE_KEY
} from "./constants";

import fs from "fs";
import cors from "@fastify/cors";
import path from 'path';
import { SQLiteDatabase } from "./database";
import { generateImage, getModelName, getSamplerName } from "./imagegen";
import { convertToAgentJson, generateAgentName, generatePrefillAgentProfile, createImagePrompt } from "./createAgent";
import { uploadFileToR2 } from "./bucket";

const CHALLENGE_STRINGS = ["Doge", "Inu", "Shib", "CryptoKitty", "SmartCat", "Pepe"];

interface BlockNumber {
  blockNumber: number;
  timestamp: number;
}

interface ChallengeEntry {
  challenge: string;
  timestamp: number;
  ip: string;
}

interface PendingImageUpdateEntry extends ChallengeEntry {
  chainId: string;
  contract: string;
  tokenId: string;
}

interface PendingImageEntry {
  tokenHash: string;
  derivativeId: string;
  model: number;
  chainid: string;
  timestamp: number;
  address: string;
  contract: string;
}

interface StreamTokenEntry {
  ip: string;
  timestampExpiry: number;
  tokenId: number
}

interface Character {
    tokenId: number;
    name: string;
    character_data: JSON;
}

const challenges: ChallengeEntry[] = [];
//create mapping of streamtoken to IP address
const streamTokens: Record<string, StreamTokenEntry> = {};
const pendingImages: PendingImageEntry[] = [];
const blockNumbers: Record<string, BlockNumber> = {};
const eventLogs: Record<string, (ethers.Log | ethers.EventLog)[]> = {};

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "0x3B43850ddd15D74A0DFd7859ceE950264e8a2362";
const CONTRACT_CHAIN_ID = parseInt(process.env.CONTRACT_CHAIN_ID || "84532");

const checkMintExpiry = 10 * 60 * 1000; // 10 minutes in milliseconds
const challengeExpiry = 10 * 60 * 1000; // 10 minutes in milliseconds
const streamTokenExpiry = 24 * 60 * 60 * 1000; // 1 day in milliseconds

export const db: SQLiteDatabase = new SQLiteDatabase(
  SQLite_DB_FILE!,
);

async function createServer() {
  let app: FastifyInstance;

  app = fastify({
    maxParamLength: 1024,
    ...(process.env.NODE_ENV === "production"
      ? {
        https: {
          key: fs.readFileSync(`${CERT_PATH}/privkey.pem`),
          cert: fs.readFileSync(`${CERT_PATH}/fullchain.pem`)
        }
      }
      : {}),
  });

  await app.register(cors, {
    origin: "*",
  });

  app.get("/genagent", async (request, reply) => {
    const name = await generateAgentName(db);
    consoleLog("name", name);
    const agentData = await generatePrefillAgentProfile(name);
    consoleLog("agentData", JSON.stringify(agentData));
    const agentJson = convertToAgentJson(agentData, name);
    // convert JSON to string but don't de-reference it
    const agentJsonString = JSON.stringify(agentJson);
    // 3. write this to the database.
    //const { tokenId, name, character_data } = request.body as Character;
    consoleLog(name, agentJsonString);

    return { data: agentJson };
  });

  app.get("/challenge", async (request, reply) => {
    //create a challenge string consisting of a random word selected from CHALLENGE_STRINGS followed by a random hex string
    //form a random hex string of length 10 characters
    let challenge =
      CHALLENGE_STRINGS[Math.floor(Math.random() * CHALLENGE_STRINGS.length)] +
      "-" +
      Math.random().toString(36).substring(2, 15);

    const clientIp = request.ip;
    consoleLog("Client IP:", clientIp);
    challenges.push({ challenge, timestamp: Date.now(), ip: clientIp });
    //purge expired entries
    purgeExpiredChallenges();
    consoleLog("challenges", challenges);
    return { data: `${challenge}` };
  });

  app.post(`/verify`, async (request, reply) => {
    //recover the address from the signature
    // @ts-ignore
    const { signature, tokenId, token1155Id, chainId, contract } = request.body;
    consoleLog("verify", signature, tokenId);
    consoleLog("challenges", challenges);

    const clientIp = request.ip;

    const numericTokenId = tokenId ? parseInt(tokenId) : parseInt(token1155Id);
    consoleLog("numericTokenIdA ", numericTokenId);
    consoleLog("chainId", chainId);
    consoleLog("contract", contract);

    const ownsToken = await checkOwnership("", signature, numericTokenId, clientIp, chainId, contract);

    if (ownsToken) {
      // generate a random token
      const streamToken = Math.random().toString(36).substring(2, 15);
      streamTokens[streamToken] = { ip: clientIp, timestampExpiry: Date.now() + streamTokenExpiry, tokenId: numericTokenId };
      consoleLog("streamToken: ", streamToken);
      return { data: `pass`, token: `${streamToken}` }
    } else {
      return reply.status(500).send({ data: `signature not valid` });
    }

  });

//   app.post('/create-nft-metadata', async (request, reply) => {
//     // @ts-ignore 
//     //const { tokenId, challenge, contract, chainId, signature } = request.body;
//     const { uid, tokenId, name, bio, style, avatarUrl } = request.body;

//     consoleLog("create-nft-metadata", uid, tokenId, name, bio, style, avatarUrl);
//     //download the image from the url
//     const imageResponse = await fetch(avatarUrl);
//     const imageBuffer = await imageResponse.arrayBuffer();
//     fs.writeFileSync(path.join(__dirname, IMAGES_FOLDER, `${uid}.jpg`), Buffer.from(imageBuffer));
//     // now copy the image to the cloudflare
//     consoleLog("uploading image to cloudflare");
//     await uploadFileToR2(`${uid}.jpg`);
//     //now delete the local file
//     fs.unlinkSync(path.join(__dirname, IMAGES_FOLDER, `${uid}.jpg`));

//     consoleLog("image uploaded to cloudflare");
//     //Now create the entry

//     //write the metadata to the database
//     db.createNFTMetadataEntry(uid, name, bio, style, tokenId);

//     return { data: "true" };
//   });

  async function getBlockNumber(chainId: string): Promise<number> {
    // get the block number
    const provider = getProvider(chainId);
    //get current block number
    if (provider === null) return 0;
    const currentBlockEntry = blockNumbers[chainId];
    if (currentBlockEntry !== undefined && currentBlockEntry.timestamp + 9000 > Date.now()) {
      return currentBlockEntry.blockNumber;
    } else {
      const blockNumber = await provider.getBlockNumber();
      consoleLog("blockNumber", blockNumber);
      blockNumbers[chainId] = { blockNumber, timestamp: Date.now() };
      return blockNumber;
    }
  }

  let timerRunning = false;
  let interval: NodeJS.Timeout; // Define the interval variable

  // start a timer to check if the NFT has been minted
  function startMintCheck() {
    if (timerRunning) {
      return;
    }
    timerRunning = true;
    // check if the NFT has been minted every 10 seconds
    interval = setInterval(async () => {
      consoleLog("checking for mints:", pendingImages.length);
      // loop through pendingImages and check if the NFT has been minted
      for (let i = 0; i < pendingImages.length; i++) {
        const thisImage = pendingImages[i];
        const mintedTokenId = await checkMinted(thisImage.tokenHash, thisImage.chainid, thisImage.contract);
        if (mintedTokenId > 0) {
          // NFT has been minted
          // remove from pendingImages
          console.log(`NFT has been minted: ${thisImage.tokenHash} : ${mintedTokenId}`);
          pendingImages.splice(i, 1);
          // now create the image
          await completeImageCreation(thisImage, mintedTokenId, thisImage.chainid, thisImage.contract, thisImage.model);
          break;
        } else {
          //check timestamp expired remove from pendingImages
          if (thisImage.timestamp + checkMintExpiry < Date.now()) {
            pendingImages.splice(i, 1);
            break;
          }
        }
      }

      if (pendingImages.length === 0) {
        timerRunning = false;
        // stop the timer
        clearInterval(interval);
        return;
      }
    }, 10000);
  }

  let eventTimerRunning = false;
  let eventInterval: NodeJS.Timeout;

  function checkEventStack() {
    if (eventTimerRunning) {
      return;
    }
    eventTimerRunning = true;
    // check events on 
    eventInterval = setInterval(async () => {
      consoleLog("checking for events:", challenges.length);
      let eventCount = 0;
      // loop through pendingImages and check if the NFT has been minted
      for (let i = 0; i < challenges.length; i++) {
        // @ts-ignore
        if (challenges[i].chainId === undefined) continue;

        const thisChallenge = challenges[i] as PendingImageUpdateEntry;
        eventCount++;

        const eventGeneratedBy = await checkEvent(thisChallenge);
        if (eventGeneratedBy.length > 0) {
          // The event has
          consoleLog(`Event has completed: ${thisChallenge.challenge} : ${thisChallenge.tokenId} ${eventGeneratedBy}`);
          //await completeIterativeGeneration(thisChallenge, eventGeneratedBy);
          //remove from challenges
          challenges.splice(i, 1);
          break;
        }
      }

      purgeExpiredChallenges();

      if (eventCount === 0) {
        eventTimerRunning = false;
        // stop the timer
        clearInterval(eventInterval);
        return;
      }
    }, 10000);
  }

  let eventAbi = [
    "event Iterate(bytes32 indexed uid, uint256 indexed tokenId, address indexed generatedBy)"
  ];

  async function getEventLogs(chainId: string, contractAddress: string): Promise<ethers.Log[]> {
    const blockNumber = await getBlockNumber(chainId);
    //form event logs key
    const eventLogsKey = `${chainId}-${contractAddress}-${blockNumber}`;
    if (eventLogs[eventLogsKey] !== undefined) {
      return eventLogs[eventLogsKey];
    }

    const provider = getProvider(chainId);
    if (provider === null) return [];
    const contract = new ethers.Contract(contractAddress, eventAbi, provider);
    const filter = contract.filters.Iterate();
    const theseEventLogs = await contract.queryFilter(filter, blockNumber - 20);
    eventLogs[eventLogsKey] = theseEventLogs;
    return theseEventLogs;
  }

  async function checkEvent(thisChallenge: PendingImageUpdateEntry): Promise<string> {
    const eventLogs = await getEventLogs(thisChallenge.chainId, thisChallenge.contract);

    for (let i = 0; i < eventLogs.length; i++) {
      try {
        const thisEvent = eventLogs[i];
        // @ts-ignore
        const thisTokenId: string = thisEvent.args.tokenId.toString();
        // @ts-ignore
        const thisUid: string = thisEvent.args.uid;
        // @ts-ignore
        const thisGeneratedBy: string = thisEvent.args.generatedBy;
        // @ts-ignore
        if (thisUid === thisChallenge.challenge && thisTokenId === thisChallenge.tokenId) {
          console.log(`event detected ${thisGeneratedBy}`);
          return thisGeneratedBy;
        }
      } catch {
        //ignore
      }
    }
    // check if the event has been detected
    return "";
  }

  async function checkMinted(tokenHash: string, chainId: string, contractAddress: string): Promise<number> {
    // check the smart contract for token hash, and get the tokenId
    let tokenId = 0;
    const provider = getProvider(chainId);
    //consoleLog("provider", provider);

    const queryContract = new ethers.Contract(
      contractAddress,
      ["function getTokenIdFromHash(bytes32 tokenHash) view returns (uint256)"],
      provider);

    consoleLog(`queryContract ${chainId} ${contractAddress}`);

    try {
      tokenId = await queryContract.getTokenIdFromHash(tokenHash);
    } catch (e) {
      console.log("error", e);
    }

    consoleLog(`tokenId (result) ${tokenId}`);

    return tokenId;
  }

  async function completeImageCreation(thisImage: PendingImageEntry, mintedTokenId: number, chainId: string, contractAddress: string, modelNumber: number) {
    consoleLog("completeImageCreation", thisImage);

    consoleLog("tokenIdHash", thisImage.tokenHash);
    // 1. Pick a random historical figure.
    const name = await generateAgentName(db);
    // 2. Generate the Agent JSON
    const agentData = await generatePrefillAgentProfile(name);
    const agentJson = convertToAgentJson(agentData, name);
    // 3. write this to the database.
    consoleLog(mintedTokenId, name, JSON.stringify(agentJson));
    await db.insertCharacter(mintedTokenId, name, agentJson);

    // now create the image
    const imagePrompt = createImagePrompt(agentJson);

    //pick modelname and sampler
    const modelName = getModelName();
    const samplerName = getSamplerName();

    //signal load of new agent to Eliza server
    const elizaResponse = await fetch(`${ELIZA_CONTROL_URL}/newagent/${mintedTokenId}`, {
      method: 'POST'
    });

    generateImage(imagePrompt, modelName, samplerName, async (imageData: string) => {
      // @ts-ignore
      const imageUrl = imageData.image_url;
      //save the image to the database
      //db.createModelTextEntry(thisImage.tokenHash, thisImage.prompt, modelMeta.id.toString(), derivativeHash, name, mintedTokenString, contractAddress);
      //download the image from the url
      const imageResponse = await fetch(imageUrl);

      const imageBuffer = await imageResponse.arrayBuffer();
      fs.writeFileSync(path.join(__dirname, IMAGES_FOLDER, `${thisImage.tokenHash}.jpg`), Buffer.from(imageBuffer));
      await uploadFileToR2(`${thisImage.tokenHash}.jpg`);

      //finally remove the local file
      fs.unlinkSync(path.join(__dirname, IMAGES_FOLDER, `${thisImage.tokenHash}.jpg`));

      const nftMetadata = {
        "name": name,
        "description": agentData.nftDescription,
        "image": `${CLOUDFLARE_PUBLIC_URL}/${thisImage.tokenHash}.jpg`,
        "attributes": agentData.nftAttributes
      }

      const nftMetadataJson = JSON.stringify(nftMetadata);

      consoleLog("nftMetadata", nftMetadataJson);
      
      //insert the metadata to the database
      db.insertMetadata(mintedTokenId, name, JSON.parse(nftMetadataJson));
    });

    //pull standard model names from the database
    /*const modelMeta = await db.getModelMeta(modelNumber);

    consoleLog("modelMeta", modelMeta);

    //generate full derivative prompt.
    //first get the model text for the derivative tokenId
    consoleLog("Start Derivative Text Form");
    let fullPrompt = db.formDerivativeText(derivativeHash, thisImage.prompt);

    generateImage(fullPrompt, modelMeta.modelName, modelMeta.samplerName, async (imageData: string) => {
      // @ts-ignore
      const imageUrl = imageData.image_url;
      const name = await generateName(thisImage.prompt);
      //save the image to the database
      db.createModelTextEntry(thisImage.tokenHash, thisImage.prompt, modelMeta.id.toString(), derivativeHash, name, mintedTokenString, contractAddress);
      //download the image from the url
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      fs.writeFileSync(path.join(__dirname, IMAGES_FOLDER, `${thisImage.tokenHash}.jpg`), Buffer.from(imageBuffer));
      await uploadFileToR2(`${thisImage.tokenHash}.jpg`);
    });*/
  }

//   async function completeIterativeGeneration(thisChallenge: PendingImageUpdateEntry, generatedBy: string) {
//     console.log("completeIterativeGeneration", thisChallenge);

//     const tokenId = `${thisChallenge.chainId}-${thisChallenge.tokenId}`;
//     const imageHash = `${thisChallenge.challenge}`;
//     const contract = thisChallenge.contract;

//     const baseTokenHash = db.getTokenHash(`${thisChallenge.chainId}-${parseInt(thisChallenge.tokenId)}`, thisChallenge.contract);
//     const fullPrompt = db.formDerivativeText(baseTokenHash, "");
//     const imageEntry = db.getImageDetails(baseTokenHash);
//     const modelMeta = db.getModelMeta(imageEntry.modelId);

//     consoleLog("modelMeta", modelMeta);

//     generateImage(fullPrompt, modelMeta.modelName, modelMeta.samplerName, async (imageData: string) => {
//       // @ts-ignore
//       const imageUrl = imageData.image_url;
//       //save the image to the database
//       db.createIterativeImageEntry(imageHash, tokenId, contract, generatedBy);
//       const imageResponse = await fetch(imageUrl);
//       const imageBuffer = await imageResponse.arrayBuffer();
//       fs.writeFileSync(path.join(__dirname, IMAGES_FOLDER, `${imageHash}.jpg`), Buffer.from(imageBuffer));
//     });
//   }

  // Mark this as ready once image is generated
  app.post(`/imageready`, async (request, res) => {
    // @ts-ignore
    const { tokenHash } = request.body;
    const filePath = path.join(__dirname, IMAGES_FOLDER, `${tokenHash}.jpg`);
    if (fs.existsSync(filePath)) {
      return res.send({ "data": "true" });
    } else {
      return res.send({ "data": "false" });
    }
  });
  
  app.get('/characteroverview/:tokenId', async (request, res) => {
    // @ts-ignore
    const { tokenId } = request.params;
    const character = await db.getCharacter(tokenId);
    if (character === null) {
      return res.send({ "data": { name: '', lore: '' } });
    } else {
      const overview = {
        "name": character.name,
        "lore": character.lore
      }
      return res.send({ "data": overview });
    }
  });

//   app.get('/latestiterative/:chainId/:contract/:tokenId/:address', async (request, res) => {
//     // @ts-ignore
//     const { chainId, contract, tokenId, address } = request.params;
//     const latestIterative = db.getLatestIterativeImage(`${chainId}-${tokenId}`, contract, address);
//     if (latestIterative !== null && latestIterative.length > 0) {
//       const filePath = path.join(__dirname, IMAGES_FOLDER, `${latestIterative}.jpg`);
//       if (fs.existsSync(filePath)) {
//         res.header('Content-Type', 'image/jpeg');
//         return res.send(fs.createReadStream(filePath));
//       } else {
//         return res.status(404).send({ error: 'Image not found' });
//       }
//     } else {
//       return res.status(404).send({ error: 'Image not found' });
//     }
//   });

  // after verification, create an image using the novita Client, download the image and store locally in the images folder
  app.post('/createmint', async (request, res) => {
    // @ts-ignore
    let { chainId, challenge, contract } = request.body;

    // verify: this string to verify is challenge + prompt + tokenid + derivative
    consoleLog("challenges", challenge);
    consoleLog("contract", contract);
    consoleLog("chainId", chainId);

    if (contract === undefined) {
      contract = CHAIN_TO_CONTRACT[chainId] || CONTRACT_ADDRESS;
    }

    consoleLog(`Contract: ${chainId} ${contract}`);
    //first check this is a valid challenge
    const isValidChallenge = checkChallenge(challenge, request.ip);
    if (!isValidChallenge) {
      return res.status(400).send({ error: 'Invalid challenge' });
    }

    //declare new signing key from SIGNER_PRIVATE_KEY
    if (!SIGNER_PRIVATE_KEY) {
      throw new Error("SIGNER_PRIVATE_KEY is not defined");
    }
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);

    const challengeHash = ethers.hashMessage(challenge);
    const signatureObj = signer.signingKey.sign(challengeHash);
    consoleLog(`signatureObj: ${JSON.stringify(signatureObj)}`);
    const signature = ethers.Signature.from(signatureObj).serialized;
    consoleLog(`signature: ${signature}`);

    const resolvedAddress = ethers.verifyMessage(
        challenge,
        signature
    );

    consoleLog("recoveredAddress", resolvedAddress);

    const tokenHash = ethers.hashMessage(challenge);

    consoleLog("tokenHash", tokenHash);

    consoleLog(`creating entry in pendingImages array ${tokenHash} ${challenge} ${chainId} ${contract}`);
    pendingImages.push({ tokenHash, derivativeId: "0", model: 1, timestamp: Date.now(), chainid: chainId, address: resolvedAddress, contract: contract });
    
    // start a timer to check if the NFT has been minted
    startMintCheck();

    consoleLog("returning tokenHash", tokenHash);
    const returnObject = {
      hash: tokenHash,
      signature: signature
    }
    // now return the token hash and wait for the NFT to be minted
    return res.send({ data: returnObject });
  });

  function checkChallenge(challenge: string, ip: string): boolean {
    //check if the challenge is in the challenges array
    const challengeEntry = challenges.find(c => c.challenge === challenge);
    consoleLog(`challengeEntry ${JSON.stringify(challengeEntry)} ${ip}`);
    if (challengeEntry === undefined || challengeEntry.ip !== ip) {
      return false;
    } else {
      //remove the challenge from the challenges array
      challenges.splice(challenges.indexOf(challengeEntry), 1);
      return true;
    }
  }

  app.get('/metadataai/:tokenId', async (request, res) => {
    // @ts-ignore
    const { tokenId } = request.params;
    const metadata = await db.getCharacterMetadata(tokenId);
    if (metadata === null) {
      return res.status(404).send({ error: 'Error generating metadata' });
    } else {
      return res.send(metadata);
    }
  });

  app.get('/script/:scriptname', async (request, res) => {
    // @ts-ignore
    const { scriptname } = request.params;
    const filePath = path.join(__dirname, SCRIPTS_FOLDER, `${scriptname}`);
    if (fs.existsSync(filePath)) {
      res.header('Content-Type', 'text/xml');
      return res.send(fs.createReadStream(filePath));
    } else {
      return res.status(404).send({ error: 'Script not found' });
    }
  });

  app.get('/getimages/:chainId/:tree/:contract?', async (request, res) => {
    // @ts-ignore
    const { chainId, tree, contract } = request.params;
    consoleLog("tree", tree);
    // tree is a string of uint256 numbers separated by commas
    const treeArray = tree.split(',');
    consoleLog("treeArray", treeArray);
    // now get the image URLs for each of the tokenIds in the tree
    // @ts-ignore
    let imageURLs = treeArray.map(tokenId => `${CLOUDFLARE_PUBLIC_URL}/${db.getTokenHash(`${chainId}-${parseInt(tokenId)}`, contract)}.jpg`);
    consoleLog("imageURLs", imageURLs);

    //prune the imageURLs if the entry has not tokenHash ie it's just CLOUDFLARE_PUBLIC_URL/
    for (let i = 0; i < imageURLs.length; i++) {
      if (imageURLs[i] === `${CLOUDFLARE_PUBLIC_URL}/.jpg`) {
        imageURLs.splice(i, 1);
        i = 0;
      }
    }

    const data = {
      "image_urls": imageURLs
    }
    return res.send(data);
  });

  type ElizaResponse = {
    user: string;
    text: string;
    action: string;
  }

  app.post('/chat/:streamtoken', async (request, res) => {
    // @ts-ignore
    const { message } = request.body;
    // @ts-ignore
    const { streamtoken } = request.params;

    if (!message) {
      return res.status(400).send({ error: 'Message is required' });
    }

    if (!streamTokens[streamtoken] || streamTokens[streamtoken].ip !== request.ip || streamTokens[streamtoken].timestampExpiry < Date.now()) {
      return res.status(400).send({ error: 'Chat not authenticated' });
    }

    let numericTokenId = streamTokens[streamtoken].tokenId;
    console.log("message", message);

    //get the agent ID
    const agent = await db.getCharacter(numericTokenId);
    const agentName = agent.name;

    //get the list of agents from http://localhost:3000/agents
    const agentsResponse = await fetch(`${ELIZA_SERVER_URL}/agents`);
    const agents = await agentsResponse.json();

    //find the agent in the list of agents
    // @ts-ignore
    const thisAgent = agents.agents.find((agent: any) => agent.name === agentName);
    const agentId = thisAgent.id;

    //forward message to the appropriate eliza server
    const formData = new FormData();
    formData.append('text', message);
    formData.append('user', 'user');

    const response = await fetch(`${ELIZA_SERVER_URL}/${agentId}/message`, {
      method: 'POST',
      body: formData
    });

    const elizaData = await response.json() as ElizaResponse[];
    if (elizaData.length > 0) {
      return { chat: `${elizaData[0].text}` }
    } else {
      res.status(500).send({ error: 'Error processing message' });
    }

  });

  app.post('/getupdatecode', async (request, res) => {
    // @ts-ignore
    let { chainId, contract, tokenId } = request.body;
    // generate a secure random 32 byte hash hex
    //const uid: string = Math.random().toString(36).substring(2, 34);
    const randomBytes = ethers.randomBytes(32);
    // Convert to hex string
    const uid = ethers.hexlify(randomBytes);

    const pendingUpdateEntry: PendingImageUpdateEntry = { challenge: uid, timestamp: Date.now(), ip: request.ip, chainId: chainId, contract: contract, tokenId: tokenId };

    challenges.push(pendingUpdateEntry);

    //purge expired entries
    purgeExpiredChallenges();

    //dump the challenges array
    consoleLog("challenges", challenges);

    checkEventStack();

    return res.send({ uid });
  });

  
// route to add a character to the database, should be a POST request that takes a JSON object and a tokenId
app.post('/character', async (request, reply) => {
    try {
      const { tokenId, name, character_data } = request.body as Character;
      consoleLog(tokenId, name, character_data);
      await db.insertCharacter(tokenId, name, character_data);
      return { 
        success: true,
        message: 'Character added to database',
        data: { tokenId, name }
      };
    } catch (error) {
      console.error(error);
      request.log.error(error);
      reply.status(500).send({
        success: false,
        message: 'Error adding character to database',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // route to get a character from the database, should be a GET request that takes a tokenId
  app.get('/character/:tokenId', async (request, reply) => {
    const { tokenId } = request.params as { tokenId: number };
    const character = await db.getCharacter(tokenId);
    if (!character) {
      return reply.status(404).send({
        success: false,
        message: 'Character not found',
        error: 'Character not found'
      });
    } else {
      return { character };
    }
  });
  
  // This route takes no args, fetches all character names from the database and sends a call to our eliza server to init all the characters
  //the format should be an array of entries which are the tokenId and the name
  app.get('/init-characters', async (request, reply) => {
    const characterNames = await db.getAllCharacterNameandIds();
    // this returns an array of objects like {name: 'name': 'name', token_id: 'token id'}
    consoleLog(`characterNames: ${JSON.stringify(characterNames)}`);
    const elizaResponse = await fetch(`${ELIZA_CONTROL_URL}/init-characters`, {
      method: 'POST',
      body: JSON.stringify(characterNames),
    });
    return { message: 'Characters initialized' };
  });
  
  app.get('/fetch-characters', async (request, reply) => {
    const characterNames = await db.getAllCharacterNameandIds();
    consoleLog(`characterNames: ${JSON.stringify(characterNames)}`);
    return { characterNames };
  });
  
  app.post('/update-character-settings', async (request, reply) => {
    // @ts-ignore
    const { tokenId, new_character_data } = request.body;
    consoleLog(tokenId, new_character_data);
    // pull character JSON from db
    const character = await db.getCharacter(tokenId);
    if (character) {
      // update character JSON with new data
      // can be either voice, discord, twitter, telegram, farcaster, lens, whatsapp
      if (new_character_data.settings.voice) {
        character.settings.voice = new_character_data.settings.voice;
      }
      if (new_character_data.settings.discord) {
        character.settings.discord = new_character_data.settings.discord;
        registerClient(character, 'discord');
      }
      if (new_character_data.settings.twitter) {
        character.settings.twitter = new_character_data.settings.twitter;
        registerClient(character, 'twitter');
      }
      if (new_character_data.settings.telegram) {
        character.settings.telegram = new_character_data.settings.telegram;
        registerClient(character, 'telegram');
      }
      if (new_character_data.settings.farcaster) {
        character.settings.farcaster = new_character_data.settings.farcaster;
        registerClient(character, 'farcaster');
      }
      if (new_character_data.settings.lens) {
        character.settings.lens = new_character_data.settings.lens;
        registerClient(character, 'lens');
      }
      if (new_character_data.settings.whatsapp) {
        character.settings.whatsapp = new_character_data.settings.whatsapp;
        registerClient(character, 'whatsapp');
      }
  
      consoleLog(`character: ${JSON.stringify(character)}`);
  
      await db.updateCharacter(tokenId, character);
  
      // now push the updated character to the eliza server
      const elizaResponse = await fetch(`${ELIZA_CONTROL_URL}/update-character-settings`, {
        method: 'POST',
        body: JSON.stringify(character),
      });
      return { message: 'Character updated' };
    } else {
      return { message: 'Character not found' };
    }
  });
  
  function registerClient(character: any, client: string) {
    //check if the client is present in the "clients" array
    consoleLog(`clients: ${JSON.stringify(character.clients)}`);
    if (!character.clients.includes(client)) {
      character.clients.push(client);
    }
  
    consoleLog(`clients: ${JSON.stringify(character.clients)}`);
  }

  function purgeExpiredChallenges() {
    for (let i = 0; i < challenges.length; i++) {
      const thisChallenge = challenges[i];
      if (thisChallenge.timestamp + challengeExpiry < Date.now()) {
        challenges.splice(i, 1);
        i = 0;
      }
    }
  }

  function removeStreamTokens() {
    for (const token in streamTokens) {
      if (streamTokens[token].timestampExpiry < Date.now()) {
        delete streamTokens[token];
      }
    }
  }

  consoleLog("Returning app from function");
  return app;
}

function getProvider(useChainId: string): ethers.JsonRpcProvider | null {
  consoleLog("getProvider useChainId", useChainId);
  const chainDetails: ChainDetail = CHAIN_DETAILS[useChainId];
  consoleLog("chainDetails", JSON.stringify(chainDetails));

  if (chainDetails !== null) {
    return new ethers.JsonRpcProvider(chainDetails.RPCurl, {
      chainId: chainDetails.chainId,
      name: chainDetails.name,
    });
  } else {
    return null;
  }
}

function recoverAddress(
  challenge: string,
  signature: string,
  prompt: string
): string {
  consoleLog("recoverAddress", challenge, signature, prompt);

  let recoveredAddress = "";
  let signedMessage = challenge + prompt;

  for (let i = 0; i < challenges.length; i++) {
    const thisChallenge = challenges[i];
    if (thisChallenge.challenge !== challenge) {
      continue;
    }

    consoleLog(
      "thisChallenge",
      thisChallenge + prompt,
      thisChallenge.timestamp + challengeExpiry > Date.now()
    );
    if (thisChallenge.timestamp + challengeExpiry >= Date.now()) {
      //recover the address
      recoveredAddress = ethers.verifyMessage(
        signedMessage,
        addHexPrefix(signature)
      );

      //now remove the challenge from the challenges array
      challenges.splice(i, 1);
      break;
    } else {
      //remove expired entry
      challenges.splice(i, 1);
      //begin from start again
      i = 0;
    }
  }
  return recoveredAddress;
}

async function checkOwnership(
  challengeSuffix: string,
  signature: string,
  tokenId: number | undefined,
  clientIp: string,
  chainId: string,
  contract: string
): Promise<boolean> {

  consoleLog("challenges tokenOwner", challenges);

  try {

    for (let i = 0; i < challenges.length; i++) {
      const thisChallenge = challenges[i];
      const message = challengeSuffix || '' + thisChallenge.challenge;
      consoleLog(
        "thisChallenge",
        message,
        thisChallenge.timestamp + challengeExpiry > Date.now()
      );
      consoleLog(`thisChallengeIP: ${thisChallenge.ip} clientIp: ${clientIp}`);
      if (thisChallenge.timestamp + challengeExpiry >= Date.now() && thisChallenge.ip === clientIp) {
        //recover the address
        const address = ethers.verifyMessage(
          message,
          addHexPrefix(signature)
        );

        let isOwner = false;
        let tokenOwner = "-";
        if (tokenId !== undefined && !Number.isNaN(tokenId)) {
          tokenOwner = await getTokenOwner(tokenId, chainId, contract);
        } else {
          //check balance of ERC-721 if required
          tokenOwner = await getNFTTokenOwner(address, chainId, contract);
        }

        consoleLog("address", address);
        consoleLog("tokenOwner", tokenOwner);
        consoleLog("isOwner", isOwner);

        if (isOwner || address.toLowerCase() === tokenOwner.toLowerCase()) {
          console.log("PASS!");
          //if the address matches the token owner, return true
          //remove entry from challenges
          challenges.splice(i, 1);
          return true;
        }
      } else if (thisChallenge.timestamp + challengeExpiry < Date.now()) {
        //remove expired entry
        challenges.splice(i, 1);
        //begin from start again
        i = 0;
      }
    }
  }
  catch (e) {
    console.log("error", e);
  }

  return false;
}

async function is1155TokenOwner(address: string, tokenId: number, chainId: string): Promise<boolean> {
  consoleLog("isTokenOwner", address);
  const provider = getProvider(chainId);
  consoleLog("provider", provider);

  const queryContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ["function balanceOf(address owner, uint256 tokenId) public view returns (uint256)"],
    provider
  );

  try {
    consoleLog("queryContract", queryContract);
    const balance = await queryContract.balanceOf(address, tokenId);
    consoleLog("balance", balance);
    return balance > 0;
  } catch (e) {
    console.log("error", e);
    return false;
  }
}

async function getNFTTokenOwner(wallet: string, chainId: string, contract: string): Promise<string> {
  consoleLog("getNFTTokenOwner", wallet);
  const provider = getProvider(chainId);
  consoleLog("provider", provider);

  const contractAddress = contract || CONTRACT_ADDRESS;

  const queryContract = new ethers.Contract(
    contractAddress,
    ["function balanceOf(address wallet) view returns (uint256)"],
    provider);

  try {
    const balance = await queryContract.balanceOf(wallet);
    if (balance > 0) {
      return wallet;
    }
  } catch (e) {
    console.log("error", e);
  }

  return "-";
}

async function getTokenOwner(tokenId: number, chainId: string, contract: string): Promise<string> {
  console.log("getTokenOwner", tokenId);
  const provider = getProvider(chainId);
  consoleLog("provider", provider);

  const contractAddress = contract || CONTRACT_ADDRESS;

  const queryContract = new ethers.Contract(
    contractAddress,
    ["function ownerOf(uint256 tokenId) view returns (address)"],
    provider
  );

  consoleLog("queryContract", queryContract);
  try {
    return await queryContract.ownerOf(tokenId);
  } catch (e) {
    console.log("error", e);
    return "";
  }
}

function addHexPrefix(hex: string): string {
  if (hex.startsWith("0x")) {
    return hex;
  } else {
    return "0x" + hex;
  }
}

const start = async () => {
  try {
    const app = await createServer();

    if (NODE_ENV === "production") {
      console.log("NODE_ENV", NODE_ENV);
    }

    const host = "0.0.0.0";
    const port = Number(process.env.PORT);
    await app.listen({ port, host });
    console.log(`Server is listening on ${host} ${port}`);

    //create IMAGE_FOLDER if it doesn't exist
    if (!fs.existsSync(IMAGES_FOLDER)) {
      fs.mkdirSync(IMAGES_FOLDER, { recursive: true });
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

start();
