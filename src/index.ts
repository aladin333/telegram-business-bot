import { startAssignmentsServer } from "./assignments-server.js";
import { createBot } from "./bot.js";

async function main(): Promise<void> {
  const bot = createBot();
  const server = startAssignmentsServer();

  const shutdown = (signal: string) => {
    server.close();
    bot.stop(signal);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  server.on("error", (err: Error) => {
    console.error("HTTP-Server:", err.message);
    process.exit(1);
  });

  console.log("Unternehmens-Assistent startet (long polling)…");
  try {
    await bot.launch();
  } catch (err) {
    server.close();
    throw err;
  }
  console.log("Bot läuft. Warte auf Nachrichten.");
}

main().catch((err) => {
  console.error(
    "Start fehlgeschlagen:",
    err instanceof Error ? err.message : "unbekannt",
  );
  process.exit(1);
});
