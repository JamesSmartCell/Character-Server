export interface CharacterModel {
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  frequency_penalty: number;
  presence_penalty: number;
  settings: {
    max_tokens: number;
  };
}

export interface CharacterWallet {
  type: string;
  network: string;
  chainId: number;
}

export interface CharacterSettings {
  voice?: {
    model: string;
  };
}

export interface CharacterPluginConfig {
  [key: string]: {
    enabled: boolean;
    wallet?: CharacterWallet;
    actions?: string[];
  };
}

export interface CharacterStyle {
  all: string[];
  chat: string[];
  post: string[];
}

export interface CharacterData {
  name: string;
  clients: string[];
  modelProvider: string;
  model: CharacterModel;
  wallet: CharacterWallet;
  settings: CharacterSettings;
  plugins: string[];
  pluginConfig: CharacterPluginConfig;
  disabledPlugins: string[];
  bio: string[];
  lore: string[];
  knowledge: string[];
  messageExamples: Array<Array<{
    user: string;
    content: {
      text: string;
      action?: string;
      actionData?: any;
    };
  }>>;
  postExamples: string[];
  topics: string[];
  style: CharacterStyle;
  adjectives: string[];
}

export interface CharacterSubmission {
  tokenId: number;
  name: string;
  character_data: CharacterData;
} 