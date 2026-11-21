import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Fehlende Umgebungsvariable: ${name}. Bitte in .env setzen (siehe .env.example).`,
    );
  }
  return value;
}

const allowedRaw =
  process.env.ALLOWED_TELEGRAM_USER_ID?.trim() || "8288800356";
const allowedId = Number(allowedRaw);
if (!Number.isFinite(allowedId) || allowedId <= 0) {
  throw new Error(
    "ALLOWED_TELEGRAM_USER_ID muss eine positive Zahlen-ID sein.",
  );
}

export const config = {
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  allowedTelegramUserId: allowedId,
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
} as const;
