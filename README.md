# Unternehmens-Assistent (Telegram-Bot MVP)

Privater KI-Assistent für Jonas auf Telegram. Antworten auf Deutsch, Fokus auf Unternehmensalltag — nicht auf Programmieren. Nur eine Telegram-User-ID hat Zugriff.

## Voraussetzungen

- Node.js 20 oder neuer
- Telegram-Bot-Token von [@BotFather](https://t.me/BotFather)
- OpenAI-API-Key mit Zugriff auf Chat Completions

## Installation

```bash
cd docs/telegram-business-bot
npm install
```

## Umgebung (.env)

```bash
cp .env.example .env
```

In `.env` eintragen (Werte nicht teilen oder committen):

| Variable | Bedeutung |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token vom BotFather |
| `OPENAI_API_KEY` | OpenAI-API-Schlüssel |
| `ALLOWED_TELEGRAM_USER_ID` | Erlaubte Telegram-ID (Standard: `8288800356`) |
| `OPENAI_MODEL` | Optional, Standard `gpt-4o-mini` |

Secrets nie in den Chat oder ins Repo legen — lokal nur in `.env`, in Cursor über Secrets.

## Lokal starten

Entwicklung (TypeScript direkt):

```bash
npm run dev
```

Oder bauen und starten:

```bash
npm run build
npm start
```

Der Bot nutzt Long Polling. Danach in Telegram den Bot öffnen und `/start` senden.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `/start` | Begrüßung |
| `/help` | Kurze Hilfe |
| `/reset` | Gesprächsverlauf löschen |

Normale Textnachrichten gehen an OpenAI; der Verlauf bleibt im Prozess-Speicher (geht beim Neustart verloren).

## Projektstruktur

```
src/
  index.ts          Einstieg
  bot.ts            Telegraf + Zugriffskontrolle
  config.ts         Umgebungsvariablen
  memory.ts         Gesprächsspeicher (in-process)
  openai.ts         Chat Completions
  system-prompt.ts  Systemrolle (Unternehmens-Assistent)
```

## Hinweise

- Andere Telegram-Nutzer erhalten eine Ablehnung.
- Keine Firmendaten oder Website-Anbindung in diesem MVP.
- Gesprächsspeicher ist flüchtig — später persistent erweiterbar.
