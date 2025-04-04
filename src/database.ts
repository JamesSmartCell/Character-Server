import BetterSqlite3 from 'better-sqlite3';
import { consoleLog } from './constants';

type CharacterStructure = {
    id: number;
    token_id: number;
    name: string;
    character_data: JSON;
    created_at: string;
    updated_at: string;
    character_metadata: JSON;
}

type CharacterMetadataStructure = {
    name: string;
    description: string;
    attributes: JSON;
}

export class SQLiteDatabase {

    db: BetterSqlite3.Database;

    constructor(dbName: string) {
        consoleLog(`dbName: ${dbName}`);
        this.db = new BetterSqlite3(dbName, { verbose: consoleLog });

        try {
            this.db.exec(`
            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_id INTEGER,
                name TEXT NOT NULL,
                character_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                character_metadata TEXT
                );
            `);

        } catch (error) {
            console.error("Error creating table:", error);
        }
    }

    //function to insert a character into the database
    // args are numeric tokenId, name and character_data JSON
    async insertCharacter(tokenId: number, name: string, character_data: JSON) {
        consoleLog(`tokenId: ${tokenId}, name: ${name}, character_data: '${JSON.stringify(character_data)}'`);
        try {   
            const stmt = this.db.prepare(`
                INSERT INTO characters (token_id, name, character_data)
                VALUES (?, ?, ?)
            `);
            consoleLog(`stmt: ${stmt}`);
            stmt.run(tokenId, name, JSON.stringify(character_data));
        } catch (error) {
            console.error("Error inserting character:", error);
            throw error; // Re-throw the error to handle it in the route handler
        }
    }

    async insertMetadata(tokenId: number, name: string, character_metadata: JSON) {
        consoleLog(`tokenId: ${tokenId}, name: ${name}, character_metadata: '${JSON.stringify(character_metadata)}'`);
        //get the entry from the characters table
        const character = this.db.prepare('SELECT * FROM characters WHERE token_id = ?').get(tokenId);

        if (!character) {
            console.error("Character not found");
            return;
        }

        //update the character_metadata field
        const stmt = this.db.prepare(`
            UPDATE characters 
            SET character_metadata = ? 
            WHERE token_id = ?
        `);
        stmt.run(JSON.stringify(character_metadata), tokenId);
    }

    //function to get a character from the database
    // args are numeric tokenId, should return the character data as JSON
    async getCharacter(tokenId: number) {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE token_id = ?');
        const character: CharacterStructure = stmt.get(tokenId) as CharacterStructure;
        if (!character) {
            return null;
        } else {
            //convert character_data to JSON
            //consoleLog(`character.character_data: ${character.character_data}`);
            return JSON.parse(character.character_data as unknown as string);
        }
    }

    async getCharacterMetadata(tokenId: number) {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE token_id = ?');
        const character: CharacterStructure = stmt.get(tokenId) as CharacterStructure;
        if (!character) {
            return null;
        } else {
            //convert character_metadata to JSON
            //consoleLog(`character.character_metadata: ${character.character_metadata}`);
            return JSON.parse(character.character_metadata as unknown as string);
        }
    }

    async getCharacterOverview(tokenId: number) {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE token_id = ?');
        const character: CharacterStructure = stmt.get(tokenId) as CharacterStructure;
        if (!character) {
            return null;
        }

        const overview = {
            name: character.name,
            //@ts-ignore
            description: character.character_data.description,
        }
        return overview;
    }

    //function to update a character in the database
    // args are numeric tokenId, name and character_data JSON
    async updateCharacter(tokenId: number, character_data: JSON) {
        const stmt = this.db.prepare(`
            UPDATE characters 
            SET character_data = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE token_id = ?
        `);
        stmt.run(JSON.stringify(character_data), tokenId);
    }

    //function to delete a character from the database
    // args are numeric tokenId
    async deleteCharacter(tokenId: number) {
        const stmt = this.db.prepare('DELETE FROM characters WHERE token_id = ?');
        stmt.run(tokenId);
    }

    //function to get all character names from the database
    async getAllCharacterNameandIds() {
        const stmt = this.db.prepare('SELECT name, token_id FROM characters');
        return stmt.all();
    }

    //function to get all agent names from the database
    async getAllAgentNames() {
        const stmt = this.db.prepare('SELECT name FROM characters');
        //return array of names
        return stmt.all().map((row: any) => row.name);
    }
}