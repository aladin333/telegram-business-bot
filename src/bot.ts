import { Telegraf } from "telegraf";
import { saveAssignmentFromMessage } from "./assignments.js";
import { config } from "./config.js";
import { appendTurn, clearHistory, getHistory } from "./memory.js";
import { chatCompletion } from "./openai.js";

function isAllowed(userId: number | undefined): boolean {
  return userId === config.allowedTelegramUserId;
}

export function createBot(): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);

  bot.start(async (ctx) => {
    if (!isAllowed(ctx.from?.id)) {
      await ctx.reply("Dieser Bot ist privat und nicht für dich freigeschaltet.");
      return;
    }
    await ctx.reply(
      "Hallo Jonas — ich bin dein Unternehmens-Assistent. Schreib mir einfach eine normale Nachricht. Mit /reset löschst du den Gesprächsverlauf.",
    );
  });

  bot.command("reset", async (ctx) => {
    if (!isAllowed(ctx.from?.id)) {
      await ctx.reply("Dieser Bot ist privat und nicht für dich freigeschaltet.");
      return;
    }
    clearHistory(ctx.from.id);
    await ctx.reply("Gesprächsverlauf gelöscht. Wir starten neu.");
  });

  bot.command("help", async (ctx) => {
    if (!isAllowed(ctx.from?.id)) {
      await ctx.reply("Dieser Bot ist privat und nicht für dich freigeschaltet.");
      return;
    }
    await ctx.reply(
      "Befehle:\n/start — Begrüßung\n/reset — Gesprächsverlauf löschen\n/help — diese Hilfe\n\nSonst einfach normal schreiben (Termine, Aufgaben, Formulierungen, Überblick).",
    );
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!isAllowed(userId)) {
      await ctx.reply("Dieser Bot ist privat und nicht für dich freigeschaltet.");
      return;
    }

    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) {
      return;
    }

    try {
      const saved = await saveAssignmentFromMessage(text);
      if (saved) console.log("Zuweisung gespeichert.");
    } catch (err) {
      console.error(
        "Zuweisung speichern fehlgeschlagen:",
        err instanceof Error ? err.message : "unbekannt",
      );
    }

    await ctx.sendChatAction("typing");

    try {
      const history = getHistory(userId);
      const reply = await chatCompletion(history, text);
      appendTurn(userId, text, reply);
      await ctx.reply(reply);
    } catch (err) {
      console.error("Antwort fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
      await ctx.reply(
        "Entschuldigung, gerade konnte ich keine Antwort erzeugen. Bitte versuche es gleich noch einmal.",
      );
    }
  });

  bot.catch((err) => {
    console.error("Bot-Fehler:", err instanceof Error ? err.message : "unbekannt");
  });

  return bot;
}
