import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/** In-process conversation memory (MVP). Lost on restart. */
const MAX_MESSAGES_PER_USER = 40;

const store = new Map<number, ChatCompletionMessageParam[]>();

export function getHistory(userId: number): ChatCompletionMessageParam[] {
  return store.get(userId) ?? [];
}

export function appendTurn(
  userId: number,
  userText: string,
  assistantText: string,
): void {
  const history = [...getHistory(userId)];
  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: assistantText });

  while (history.length > MAX_MESSAGES_PER_USER) {
    history.shift();
  }

  store.set(userId, history);
}

export function clearHistory(userId: number): void {
  store.delete(userId);
}
