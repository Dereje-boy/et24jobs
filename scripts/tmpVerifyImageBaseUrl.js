// TEMPORARY verification for IMAGE_BASE_URL env refactor. Delete after use.
//   node scripts/tmpVerifyImageBaseUrl.js
// 1. verifies Telegram config is reachable (getChat)
// 2. uploads the site logo from disk to the configured channel as a single
//    photo (text caption) — exercises sendPhoto + callTelegram
// 3. removes the test post so the channel stays clean
// Captures exit status explicitly; does not call process.exit.

require("dotenv").config();

const { JobAttachment, Job } = require("../models");
const {
  isConfigured,
  verifyChannelAccess,
  notifyJobPublished,
} = require("../services/telegram");
const fs = require("fs");
const path = require("path");

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

(async () => {
  console.log("config:", JSON.stringify(
    { IMAGE_BASE_URL: process.env.IMAGE_BASE_URL ?? "(unset)", PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "(unset)", configured: isConfigured() },
    null, 2,
  ));

  check("isConfigured() true", isConfigured(), "env vars");

  if (!isConfigured()) {
    console.log("SKIP — no Telegram config; would need env vars to go further.");
    return;
  }

  const channelAccess = await verifyChannelAccess();
  check("getChat OK", channelAccess.ok, channelAccess.ok ? undefined : channelAccess.error);

  const logo = path.join(__dirname, "..", "public", "uploads", "logo.png");
  check("logo.png present on disk", fs.existsSync(logo), logo);

  if (!fs.existsSync(logo)) return;

  // Upload the logo as a standalone photo message (not via notifyJobPublished)
  // so we exercise the same sendPhoto path with a real file.
  const { sendPhoto } = require("../services/telegram");
  const caption = "ET24Jobs logo — verification of IMAGE_BASE_URL refactor";
  const result = await sendPhoto(
    process.env.TELEGRAM_CHANNEL_ID,
    caption,
    "logo.png",
    "image/png",
  ).catch((e) => ({ ok: false, error: e.message }));

  check("sendPhoto logo OK", result.ok, result.ok ? undefined : result.error);
  let msgId = null;
  try {
    const data = JSON.parse(result._debugRaw || "{}");
    msgId = (data.result && data.result.message_id) || null;
  } catch { /* ignore */ }

  if (!result.ok) {
    console.log("SKIP cleanup — no message id to delete.");
    return;
  }

  const { token } = { token: process.env.TELEGRAM_BOT_TOKEN };
  const deleteResult = await fetch(
    `https://api.telegram.org/bot${token}/deleteMessage`,
    {
      method: "POST",
      body: new URLSearchParams({ chat_id: process.env.TELEGRAM_CHANNEL_ID, message_id: String(msgId) }),
      signal: AbortSignal.timeout(15000),
    },
  ).then((r) => r.json()).catch(() => ({ ok: false }));
  check("deleteMessage OK", deleteResult.ok, deleteResult.ok ? undefined : JSON.stringify(deleteResult));
})().catch((e) => {
  console.error("UNEXPECTED:", e);
  failures++;
});
