// Telegram channel announcements via the official Bot API.
//
// Setup (one-time, done in Telegram by the site owner):
//   1. Create a bot with @BotFather -> copy the bot token.
//   2. Add the bot to the public channel as an ADMIN with post permission.
//   3. Put in .env:
//        TELEGRAM_BOT_TOKEN=<token from BotFather>
//        TELEGRAM_CHANNEL_ID=@yourchannel      (public channel username)
//        PUBLIC_BASE_URL=https://etjobs.com    (used for the post's link)
//
// Behavior:
//   - notifyJobPublished(job) posts one announcement when a job BECOMES
//     published (draft/expired/archived -> published). Republishing an old
//     job re-announces it, by design; a no-op save of an already-published
//     job does not.
//   - If the job has published image attachments, the post carries them:
//     exactly 1 image -> sendPhoto (text as caption); 2+ images ->
//     sendMediaGroup album (max 10, caption on the first item only);
//     no images -> plain sendMessage.
//   - Photos are read from  public/uploads/jobs/  on this machine and
//     uploaded to Telegram as multipart/form-data. Telegram never fetches
//     them from a public URL, so the site does not have to be reachable
//     from the internet for images to post.
//   - The feature disables itself when the env vars are missing, so dev
//     machines and CI never break because Telegram is not configured.
//   - Never throws: callers get { ok: boolean, error? } and decide how to
//     surface failures. Requests are capped at 4s so an unreachable
//     Telegram can never hang an admin request.

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { JobAttachment } = require("../models");

const API_BASE = "https://api.telegram.org";
const TIMEOUT_MS = 350000;
const CAPTION_LIMIT = 1024;

// Job attachment files live on the app's own disk. Every photo is uploaded
// to Telegram as multipart/form-data bytes read from this folder - Telegram
// never fetches an image from a public URL, so no IMAGE_BASE_URL is needed
// and the host serving the site does not have to be reachable from Telegram.
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "jobs");

const truncateCaption = (caption) =>
  caption.length > CAPTION_LIMIT
    ? `${caption.slice(0, CAPTION_LIMIT - 3)}...`
    : caption;

const config = () => ({
  token: process.env.TELEGRAM_BOT_TOKEN || "",
  channel: process.env.TELEGRAM_CHANNEL_ID || "",
  baseUrl: (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
});

const isConfigured = () => {
  const { token, channel } = config();
  return Boolean(token && channel);
};

// HTML parse_mode: only & < > need escaping (titles are admin-entered but
// escaping is cheap insurance regardless).
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// DATEONLY "YYYY-MM-DD" -> "Sep 30, 2026" (same style as the site).
const formatDeadline = (deadline) => {
  const match = String(deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const buildAnnouncement = (job) => {
  const { baseUrl } = config();
  const lines = [
    "🔔 New job on ET24Jobs",
    "",
    `💼 <b>${escapeHtml(job.title)}</b>`,
  ];

  if (job.companyName) lines.push(`🏢 ${escapeHtml(job.companyName)}`);

  const metaBits = [job.location, job.employmentType].filter(Boolean);
  if (metaBits.length > 0) lines.push(`📍 ${escapeHtml(metaBits.join(" · "))}`);

  if (job.salary) lines.push(`💰 ${escapeHtml(job.salary)}`);

  if (job.deadline) {
    const formatted = formatDeadline(job.deadline);
    if (formatted) lines.push(`⏳ Deadline: ${formatted}`);
  }

  lines.push("", `👉 ${baseUrl}/jobs/${job.slug}`);
  return lines.join("\n");
};

// One Telegram API call. Never throws - resolves { ok, error? }.
const callTelegram = async (method, body) => {
  const { token } = config();
  console.log("Uploading images/text to telegram");

  try {
    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok !== true) {
      return {
        ok: false,
        error: (data && data.description) || `HTTP ${response.status}`,
      };
    }
    // console.log(data);
    return { ok: true };
  } catch (error) {
    console.log(error);
    return { ok: false, error: error.message };
  }
};

// Sanity check used by verification: can this bot see the channel?
const verifyChannelAccess = () => {
  const { channel } = config();
  const form = new URLSearchParams({ chat_id: channel });
  return callTelegram("getChat", form);
};

const sendText = (chatId, text) => {
  const form = new URLSearchParams({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
  return callTelegram("sendMessage", form);
};

// Sends one photo by uploading the file bytes from local disk.
const sendPhoto = async (chatId, caption, storedName, mimeType) => {
  const filePath = path.join(UPLOAD_DIR, storedName);
  const fileBuffer = await fs.promises.readFile(filePath);

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", truncateCaption(caption));
  form.append("parse_mode", "HTML");
  form.append(
    "photo",
    new Blob([fileBuffer], { type: mimeType || "image/jpeg" }),
    storedName,
  );

  return callTelegram("sendPhoto", form);
};

// Several images -> one sendMediaGroup album (Telegram caps albums at 10
// media items; the caption + parse_mode belong to the FIRST item only).
// Every photo is read from local disk and attached as multipart/form-data.
const buildGroupForm = async (chatId, caption, images) => {
  const form = new FormData();
  form.append("chat_id", chatId);

  const media = await Promise.all(
    images.map(async (image, index) => {
      const item = {
        type: "photo",
        media: `attach://photo${index}`,
      };
      if (index === 0) {
        item.caption = truncateCaption(caption);
        item.parse_mode = "HTML";
      }

      const filePath = path.join(UPLOAD_DIR, image.storedName);
      const fileBuffer = await fs.promises.readFile(filePath);

      form.append(
        `photo${index}`,
        new Blob([fileBuffer], { type: image.mimeType || "image/jpeg" }),
        image.storedName,
      );

      return item;
    }),
  );
  form.append("media", JSON.stringify(media));

  return form;
};

const sendPhotoGroup = async (chatId, caption, images) => {
  const form = await buildGroupForm(chatId, caption, images);
  return callTelegram("sendMediaGroup", form);
};

const notifyJobPublished = async (job) => {
  if (!isConfigured()) return { ok: false, disabled: true };

  const { channel } = config();
  const text = buildAnnouncement(job);

  // Published image attachments, oldest first (= the order shown in the
  // job page's gallery).
  let images = [];
  try {
    images = await JobAttachment.findAll({
      where: {
        jobId: job.id,
        status: "published",
        mimeType: { [Op.like]: "image/%" },
      },
      order: [["id", "ASC"]],
    });
  } catch (error) {
    console.error("[telegram] attachment lookup failed:", error.message);
  }

  // Telegram allows at most 10 items per media group.
  const album = images.slice(0, 10);
  const onSendError = (error) => ({ ok: false, error: error.message });

  const result =
    album.length === 0
      ? await sendText(channel, text)
      : album.length === 1
        ? await sendPhoto(
            channel,
            text,
            album[0].storedName,
            album[0].mimeType,
          ).catch(onSendError)
        : await sendPhotoGroup(channel, text, album).catch(onSendError);

  if (result.ok) {
    console.log(
      `[telegram] announcement posted for job ${job.id} ("${job.title}")`,
    );
  } else if (!result.disabled) {
    console.error(
      `[telegram] announcement failed for job ${job.id}:`,
      result.error,
    );
  }
  console.log(result);
  return result;
};

module.exports = {
  isConfigured,
  verifyChannelAccess,
  notifyJobPublished,
};
