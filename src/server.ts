import 'dotenv/config';
import fastify from 'fastify';
import { SQLiteDatabase } from './database';
import { SQLite_DB_FILE, ELIZA_SERVER_URL, consoleLog } from './constants';

interface Character {
  tokenId: number;
  name: string;
  character_data: JSON;
}

const app = fastify({
  logger: true
});

// Initialize database
export const db: SQLiteDatabase = new SQLiteDatabase(
  SQLite_DB_FILE!,
);

// Example route
app.get('/', async (request, reply) => {
  return { hello: 'world' };
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
  const elizaResponse = await fetch(`${ELIZA_SERVER_URL}/init-characters`, {
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
    }
    if (new_character_data.settings.twitter) {
      character.settings.twitter = new_character_data.settings.twitter;
    }
    if (new_character_data.settings.telegram) {
      character.settings.telegram = new_character_data.settings.telegram;
    }
    if (new_character_data.settings.farcaster) {
      character.settings.farcaster = new_character_data.settings.farcaster;
    }
    if (new_character_data.settings.lens) {
      character.settings.lens = new_character_data.settings.lens;
    }
    if (new_character_data.settings.whatsapp) {
      character.settings.whatsapp = new_character_data.settings.whatsapp;
    }

    consoleLog(`character: ${JSON.stringify(character)}`);

    await db.updateCharacter(tokenId, character);
    return { message: 'Character updated' };
  } else {
    return { message: 'Character not found' };
  }
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server is running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start(); 