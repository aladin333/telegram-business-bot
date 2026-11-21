import { createBot } from "./bot.js";

async function main(): Promise<void> {
  const bot = createBot();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  console.log("Unternehmens-Assistent startet (long polling)…");
  await bot.launch();
  console.log("Bot läuft. Warte auf Nachrichten.");
}

main().catch((err) => {
  console.error(
    "Start fehlgeschlagen:",
    err instanceof Error ? err.message : "unbekannt",
  );
  process.exit(1);
});
