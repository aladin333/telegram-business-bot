import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "./config.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const client = new OpenAI({ apiKey: config.openaiApiKey });

export async function chatCompletion(
  history: ChatCompletionMessageParam[],
  userText: string,
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userText },
  ];

  const response = await client.chat.completions.create({
    model: config.openaiModel,
    messages,
    temperature: 0.4,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Leere Antwort von OpenAI.");
  }
  return text;
}
