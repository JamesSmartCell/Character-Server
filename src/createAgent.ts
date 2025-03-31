import { OpenAI } from "openai";
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { OPENAI_API_KEY, prefillAgentProfileSchema } from "./constants";
import { SQLiteDatabase } from "./database";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

export async function generateAgentName(db: SQLiteDatabase): Promise<string> {
    // Generate an agent for a random historical figure.
    //first let's pick a random age range, which should start from 80 years ago and go back in steps of 100 years to 2500 years ago.
    //number either 0 or 1
    const modernEra = Math.floor(Math.random() * 2);
    let approximateAge;
    if (modernEra === 1) {
        approximateAge = 70 + Math.floor(Math.random() * 250);
    } else {
        approximateAge = 80 + Math.floor(Math.random() * 250) * 10;
    }

    const approximateAgeRange = `${approximateAge} years ago`;

    //form list of names which have already been geenrated, from the database
    const existingNames = await getExistingNames(db);

    //convert list of names to a csv string
    const existingNamesCSV = existingNames.join(",");

    console.log(`existingNamesCSV: ${existingNamesCSV}`);

    let nameExists: boolean = true;
    let name: string = "";

    while (nameExists) {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: `Pick a random historical figure, from roughly ${approximateAgeRange} years ago. If the time exceeds 2000 years ago then you can pick any figure from history older than 2300 years ago. Pick the figure at random - it should be a different person each time this content message is called. Do not shy away from controversial figures like Karl Marx. Please just return the name of the figure in the content field, nothing else. Do not pick any name from ${existingNamesCSV}` }],
    });

    if (response.choices[0].message.content) {
      name = response.choices[0].message.content;
      if (!existingNames.includes(name)) {
        nameExists = false;
        return name;
      }
    } else {
      throw new Error("No response from OpenAI");
    }
  }

  return name;
}

async function getExistingNames(db: SQLiteDatabase): Promise<string[]> {
    //get list of names from the database
    const names = await db.getAllAgentNames();
    return names;
}

export async function generatePrefillAgentProfile(name: string) {

  const prompt = `
You are an advanced generative AI assistant tasked with generating a JSON configuration for an Eliza AI agent, based on ${name}. 
Generate a JSON configuration for an Eliza AI agent, based on the figure's personality and background.
The Eliza AI agent represent the soul of an NFT, with the awareness that the historical figure would have had.
Any message, chat or post from the Eliza AI agent should reflect the historical figure's personality and beliefs, although their perspectives could change over time.

Goal:
Produce a JSON object to configure an Eliza AI agent. The configuration should include the following sections:
- name: Use the name of the historical figure.
- NFT description: Based on elements of the historical figure's life, such as their beliefs, actions, and contributions to society.
- NFT attributes: 1-3 word attributes Based on the historical figure's life, such as their beliefs, actions, and contributions to society. Eg TraitType: "Belief", Value: "Atheism".
- Agent Personality: Recommendations for configuring the Eliza AI agent's personality, tone, and behavior, based on the user's inferred traits and preferences.

Instructions:
- Stick as close to the historical figure's known sources, but where information is scarce you can infer or guess properties.

Ensure the output is comprehensive, accurate, and creative while adhering to the schema.

Notes:
1. regarding the "messageExamples" field
  - It's a nested array, every element of the outer array represents a conversation, and every element of the inner array represents a message in that conversation.
  - For every conversation, it should include at least two messages: one from the "{{user1}}" and one from the agent.
  - For example
    [
      {
        "user": "{{user1}}",
        "content": {
          "text": "ANYONE THAT TALKS TO THE AGENT"
        }
      },
      {
        "user": "eliza",
        "content": {
          "text": "REPLY AS THE NFT SOUL AI AGENT"
        }
      }
    ],
`

  const { object } = await generateObject({
    model: google("gemini-2.0-flash-exp"),
    schema: prefillAgentProfileSchema,
    prompt,
  })

  return object
}

export function convertToAgentJson(agentData: any, originalName: string): JSON {
 const modelProviders = ["openai", "google"];
 const modelProvider = modelProviders[Math.floor(Math.random() * modelProviders.length)];

  const agentJson = {
    name: originalName,
    lore: agentData.agentTraits.lore,
    bio: agentData.agentTraits.bio,
    topics: agentData.agentTraits.topics,
    style: agentData.agentTraits.style,
    clients: [],
    modelProvider: modelProvider, // either "openai" or "google"
    settings: {},
    plugins: [],
    messageExamples: agentData.examples.messageExamples,
    postExamples: agentData.examples.postExamples,
    adjectives: agentData.adjectives
  }

  const agentString = JSON.stringify(agentJson);
  return JSON.parse(agentString);
}

export function createImagePrompt(agent: JSON): string {
  // @ts-ignore
  const prompt = `Draw a stylised image of ${agent.name} in the typical setting in which they would be found. If the subject is female, draw her younger and more attractive.`;
  return prompt;
}

