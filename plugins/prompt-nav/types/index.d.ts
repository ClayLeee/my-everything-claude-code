export type Prompt = { text: string; id?: string };

declare module "claude-code" {
  interface PluginState {
    "prompt-nav": {
      prompts: Prompt[];
      current: number | null;
      query: string;
    };
  }
}
