// TEMPORARY cloud-deployment helper: test MySQL connection settings from
// INSIDE the deployed app (the machine that will actually run the queries),
// so host/port/user/password/SSL can be corrected until one combination
// works. Nothing is persisted: credentials live only in the request body for
// the duration of the test and are never logged.
//
// Why it is mounted before the session middleware (see app.js):
//   the session store is MySQL-backed, so a login-protected page would be
//   unreachable exactly when the DB is unreachable. This route therefore
//   uses its own token gate instead of requireAdmin.
//
// Usage:
//   1. Set DB_CHECK_TOKEN=<long random string> in the host's env vars and
//      redeploy/restart.
//   2. Open  https://<your-app>/db-check?token=<that string>
//   3. Enter host(s)/port/user/password/database, press "Test".
//   4. Copy the generated DB_* block into the host's env vars.
//   5. DELETE this file and its two lines in app.js, then redeploy.
//
// Security notes:
//   - No token configured => the route refuses every request (fail closed).
//   - The token is compared in constant time and is never echoed back.
//   - Anyone holding the token can make the server open TCP connections to
//     arbitrary hosts/ports (SSRF-style probing), which is why this is a
//     short-lived tool: keep the token secret and remove the route after use.
//   - Responses are marked no-store/noindex; the password is never rendered
//     into logs, only into the form the caller just submitted.

const crypto = require("crypto");
const dns = require("dns");
const express = require("express");
const mysql = require("mysql2/promise");

const router = express.Router();

const MAX_HOSTS = 8;
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 30000;
const SSL_MODES = ["off", "required", "verify"];

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const constantTimeEqual = (a, b) => {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
};

// Accepts "10.0.0.5, db.example.com\n203.0.113.9" and de-duplicates.
const parseHosts = (raw) =>
  String(raw || "")
    .split(/[\s,;]+/)
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => host.replace(/^mysql:\/\//i, "").replace(/\/.*$/, ""))
    .slice(0, MAX_HOSTS);

const parsePort = (raw) => {
  const port = Number(raw || 3306);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
};

const parseTimeout = (raw) => {
  const value = Number(raw || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.round(value), MAX_TIMEOUT_MS);
};

// Turns a mysql2 error into something actionable for a first-time cloud
// deployment (firewall/whitelist, TLS, auth, wrong schema).
const explain = (error) => {
  const code = error.code || "";
  const text = String(error.message || "");

  if (/ENOTFOUND|EAI_AGAIN/.test(code)) {
    return "The hostname does not resolve from this server. Check the host for typos, or use the database's IP address. Private/VPC hostnames only resolve inside the provider's network.";
  }
  if (/ETIMEDOUT|ETIMEOUT/.test(code) || /timeout/i.test(text)) {
    return "No answer before the timeout. This is almost always a firewall: the database's allowed-IP list does not include this app's outbound IP (see the row above), or the provider requires a private/VPC network connection.";
  }
  if (/ECONNREFUSED/.test(code)) {
    return "Host reachable but nothing is listening on that port. Check the port (3306 is the default; some managed providers use 25060, 3307, or a custom port) and that the database is running.";
  }
  if (/ER_ACCESS_DENIED_ERROR/.test(code)) {
    return "MySQL rejected the username/password. Check that the user exists for the host this app connects FROM (MySQL users are 'user'@'host'), e.g. 'app'@'%' or 'app'@'1.2.3.4'; a user that only exists as 'user'@'localhost' cannot be used remotely.";
  }
  if (/ER_DBACCESS_DENIED_ERROR/.test(code)) {
    return "Credentials are valid but this user may not use that database. Grant it: GRANT ALL ON `db`.* TO 'user'@'%';";
  }
  if (/ER_BAD_DB_ERROR/.test(code)) {
    return "The database name does not exist on this server. Leave the database field empty to list what is available (if the user has permission).";
  }
  if (/ER_NOT_SUPPORTED_AUTH_MODE/.test(code)) {
    return "The server wants an auth plugin this client cannot use. Cloud MySQL 8 often needs TLS; try SSL = required, or switch the user to caching_sha2_password / mysql_native_password.";
  }
  if (/HANDSHAKE|PROTOCOL_CONNECTION_LOST|ECONNRESET/i.test(code + text)) {
    return "The handshake broke. Managed providers frequently REQUIRE TLS - try SSL = required. It can also mean the port is another service (e.g. a proxy) rather than MySQL.";
  }
  if (/SELF_SIGNED_CERT|UNABLE_TO_VERIFY|CERT/i.test(code + text)) {
    return "TLS certificate could not be verified. Use SSL = required (encrypt without verifying the provider's CA) or install the provider's CA bundle.";
  }
  return "Unexpected failure. The raw code/message above is what the MySQL driver returned.";
};

const lookupHost = async (host) => {
  try {
    const addresses = await dns.promises.lookup(host, {
      all: true,
      verbatim: true,
    });
    return addresses.map((a) => a.address).join(", ");
  } catch (error) {
    return `lookup failed (${error.code || error.message})`;
  }
};

// Outbound IP of THIS server: what must be whitelisted on the database.
const egressIp = async () => {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(4000),
    });
    const data = await response.json();
    return data.ip || "unknown";
  } catch (error) {
    return "unavailable (no outbound internet or ipify blocked)";
  }
};

const testOne = async (options) => {
  const startedAt = Date.now();
  const result = {
    host: options.host,
    port: options.port,
    ssl: options.sslMode,
    addresses: await lookupHost(options.host),
    ok: false,
    elapsedMs: 0,
    serverVersion: "",
    currentUser: "",
    database: "",
    charset: "",
    tls: "",
    databases: [],
    code: "",
    message: "",
    hint: "",
  };

  let connection;
  try {
    connection = await mysql.createConnection({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database || undefined,
      connectTimeout: options.timeoutMs,
      ssl:
        options.sslMode === "off"
          ? undefined
          : { rejectUnauthorized: options.sslMode === "verify" },
    });

    const [rows] = await connection.query(
      "SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS currentUser, @@character_set_server AS charset",
    );
    const info = rows[0] || {};
    result.serverVersion = info.version || "";
    result.database = info.db || "";
    result.currentUser = info.currentUser || "";
    result.charset = info.charset || "";

    try {
      const [sslRows] = await connection.query("SHOW STATUS LIKE 'Ssl_cipher'");
      result.tls = (sslRows[0] && sslRows[0].Value) || "";
    } catch (error) {
      result.tls = "";
    }

    if (options.listDatabases) {
      try {
        const [dbRows] = await connection.query("SHOW DATABASES");
        result.databases = dbRows
          .map((row) => Object.values(row)[0])
          .filter(Boolean);
      } catch (error) {
        result.databases = [];
      }
    }

    result.ok = true;
  } catch (error) {
    result.code = error.code || "";
    result.message = error.message || String(error);
    result.hint = explain(error);
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }

  result.elapsedMs = Date.now() - startedAt;
  return result;
};

// ---------------------------------------------------------------------------
// HTML (self-contained: this page must render with no DB and no layout)
// ---------------------------------------------------------------------------

const page = ({ token, body, results, egress, error, notice }) => {
  const hostValue = esc(body.host || "");
  const portValue = esc(body.port || "3306");
  const userValue = esc(body.user || "");
  const passwordValue = esc(body.password || "");
  const databaseValue = esc(body.database || "");
  const sslMode = SSL_MODES.includes(body.sslMode) ? body.sslMode : "required";
  const timeoutValue = esc(parseTimeout(body.timeout));
  const listDatabases = body.listDatabases ? "checked" : "";

  const env = (process.env.DB_HOST && `DB_HOST=${process.env.DB_HOST}`) || "";
  const envLine = [
    env,
    process.env.DB_PORT ? `DB_PORT=${process.env.DB_PORT}` : "",
    process.env.DB_USER ? `DB_USER=${process.env.DB_USER}` : "",
    process.env.DB_NAME ? `DB_NAME=${process.env.DB_NAME}` : "",
    process.env.DB_SSL ? `DB_SSL=${process.env.DB_SSL}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const success = (results || []).find((row) => row.ok);

  const envBlock = success
    ? [
        `DB_HOST=${success.host}`,
        `DB_PORT=${success.port}`,
        `DB_USER=${body.user || ""}`,
        `DB_PASSWORD=${body.password || ""}`,
        `DB_NAME=${success.database || body.database || ""}`,
        `DB_SSL=${success.ssl !== "off" ? "true" : "false"}`,
      ].join("\n")
    : "";

  const rowsHtml = (results || [])
    .map((row) => {
      const badge = row.ok
        ? '<span class="ok">SUCCESS</span>'
        : '<span class="bad">FAILED</span>';
      const detail = row.ok
        ? `<div class="kv">server: <b>${esc(row.serverVersion)}</b></div>
           <div class="kv">current user: <b>${esc(row.currentUser)}</b></div>
           <div class="kv">default schema: <b>${esc(row.database || "(none selected)")}</b></div>
           <div class="kv">charset: <b>${esc(row.charset)}</b></div>
           <div class="kv">TLS: <b>${row.tls ? esc(row.tls) : "not encrypted"}</b></div>`
        : `<div class="kv">code: <code>${esc(row.code || "(none)")}</code></div>
           <div class="kv">message: ${esc(row.message)}</div>
           <div class="hint">${esc(row.hint)}</div>`;
      const dbs =
        row.ok && row.databases.length
          ? `<div class="kv">databases: ${row.databases.map(esc).join(", ")}</div>`
          : "";
      return `<tr>
        <td><b>${esc(row.host)}</b><br><span class="muted">${esc(row.addresses)}</span></td>
        <td>${row.port}</td>
        <td>${badge}<div class="muted">${row.elapsedMs} ms</div></td>
        <td>${detail}${dbs}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>DB connection check</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 28px; background: #f5f6f8; color: #1b1f24; }
  @media (prefers-color-scheme: dark) { body { background: #14171c; color: #e6e9ef; } .card, table { background: #1c2027 !important; } input, select { background: #11141a !important; color: #e6e9ef !important; border-color: #333a45 !important; } .muted { color: #98a2b3 !important; } }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  .card { background: #fff; border: 1px solid #e3e6ea; border-radius: 10px; padding: 18px; max-width: 1000px; margin: 0 auto 18px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e6ea; border-radius: 10px; overflow: hidden; font-size: 14px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eceff3; vertical-align: top; }
  th { background: #f0f2f5; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #5a6473; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #5a6473; margin-bottom: 4px; }
  input, select { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cfd5dd; border-radius: 6px; font: inherit; background: #fff; }
  textarea { width: 100%; box-sizing: border-box; min-height: 62px; padding: 8px 10px; border: 1px solid #cfd5dd; border-radius: 6px; font: inherit; background: #fff; }
  button { margin-top: 14px; padding: 10px 18px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  .ok { color: #067647; font-weight: 700; }
  .bad { color: #b42318; font-weight: 700; }
  .muted { color: #667085; font-size: 12px; }
  .kv { margin: 2px 0; }
  .hint { margin-top: 6px; padding: 8px 10px; border-left: 3px solid #d97706; background: rgba(217,119,6,.08); border-radius: 0 6px 6px 0; }
  pre { background: #0f1217; color: #d7e0ea; padding: 14px; border-radius: 8px; overflow: auto; font-size: 13px; }
  .warn { border-left: 4px solid #b42318; background: rgba(180,35,24,.08); padding: 10px 12px; border-radius: 0 6px 6px 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: end; }
  .row > div { flex: 1 1 150px; }
</style>
</head><body>

<div class="card">
  <h1>MySQL connection check</h1>
  <p class="muted">Runs from this deployed server. Nothing is saved. Delete this route once the app is live.</p>
  ${
    error
      ? `<div class="warn"><b>${esc(error)}</b></div>`
      : ""
  }
  ${notice ? `<div class="hint">${esc(notice)}</div>` : ""}
  <p class="kv">Server outbound IP (whitelist this on the database): <b>${esc(egress)}</b></p>
  ${
    envLine
      ? `<details><summary class="muted">Currently configured (env)</summary><pre>${esc(envLine)}</pre></details>`
      : ""
  }

  <form method="POST" action="/db-check" autocomplete="off">
    <input type="hidden" name="token" value="${esc(token)}">
    <h2>Target</h2>
    <div class="grid">
      <div style="grid-column: 1 / -1;">
        <label for="host">Host(s) — IP or hostname, comma/newline separated</label>
        <textarea id="host" name="host" spellcheck="false" placeholder="db.example.com&#10;203.0.113.10">${hostValue}</textarea>
      </div>
      <div><label for="port">Port</label><input id="port" name="port" value="${portValue}"></div>
      <div><label for="user">User</label><input id="user" name="user" value="${userValue}"></div>
      <div><label for="password">Password</label><input id="password" name="password" type="password" value="${passwordValue}"></div>
      <div><label for="database">Database (optional)</label><input id="database" name="database" value="${databaseValue}"></div>
      <div>
        <label for="sslMode">SSL / TLS</label>
        <select id="sslMode" name="sslMode">
          <option value="off"${sslMode === "off" ? " selected" : ""}>off</option>
          <option value="required"${sslMode === "required" ? " selected" : ""}>required (encrypt, do not verify)</option>
          <option value="verify"${sslMode === "verify" ? " selected" : ""}>required + verify certificate</option>
        </select>
      </div>
      <div><label for="timeout">Timeout (ms)</label><input id="timeout" name="timeout" value="${timeoutValue}"></div>
    </div>
    <label style="margin-top:12px; text-transform:none; font-weight:400;">
      <input type="checkbox" name="listDatabases" value="1" ${listDatabases} style="width:auto"> also list databases visible to this user
    </label>
    <button type="submit">Test connection</button>
  </form>
</div>

${
  results && results.length
    ? `<div class="card">
        <h2 style="margin-top:0">Results</h2>
        <table>
          <thead><tr><th>Host</th><th>Port</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`
    : ""
}

${
  envBlock
    ? `<div class="card">
        <h2 style="margin-top:0">Env block for this host</h2>
        <p class="muted">Paste into the host's environment variables, then redeploy.</p>
        <pre id="envblock">${esc(envBlock)}</pre>
        <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('envblock').textContent).then(()=>{this.textContent='Copied'})">Copy</button>
      </div>`
    : ""
}

<div class="card">
  <div class="warn">
    This page can make the server connect to arbitrary hosts/ports and accepts credentials.
    Remove <code>routes/dbCheckRoute.js</code> and its <code>app.use("/db-check", ...)</code> line in
    <code>app.js</code> once the database is connected, and unset <code>DB_CHECK_TOKEN</code>.
  </div>
</div>

</body></html>`;
};

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

const tokenConfigured = () => Boolean(process.env.DB_CHECK_TOKEN);

const tokenValid = (candidate) =>
  tokenConfigured() &&
  typeof candidate === "string" &&
  constantTimeEqual(candidate, process.env.DB_CHECK_TOKEN);

const deny = (res, status, message) =>
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><meta name="robots" content="noindex"><body style="font:15px system-ui;padding:32px;max-width:640px;margin:auto">
         <h1 style="font-size:18px">DB check unavailable</h1><p>${esc(message)}</p></body>`,
    );

const guard = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  });

  if (!tokenConfigured()) {
    return deny(
      res,
      503,
      "DB_CHECK_TOKEN is not set on this server, so the checker stays disabled. Add it to the environment variables and restart.",
    );
  }

  const candidate = req.method === "POST" ? req.body.token : req.query.token;
  if (!tokenValid(candidate)) {
    return deny(res, 403, "Missing or invalid token.");
  }

  return next();
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/", guard, async (req, res) => {
  const egress = await egressIp();
  res.type("html").send(
    page({
      token: req.query.token,
      body: {},
      egress,
    }),
  );
});

router.post("/", guard, async (req, res) => {
  const body = req.body || {};
  const hosts = parseHosts(body.host);
  const port = parsePort(body.port);
  const timeoutMs = parseTimeout(body.timeout);
  const sslMode = SSL_MODES.includes(body.sslMode) ? body.sslMode : "required";
  const user = String(body.user || "");
  const password = String(body.password || "");
  const database = String(body.database || "").trim();
  const listDatabases = Boolean(body.listDatabases);

  if (hosts.length === 0 || !port || !user) {
    const egress = await egressIp();
    return res.status(422).type("html").send(
      page({
        token: body.token,
        body,
        egress,
        error: "Host, port and user are required.",
      }),
    );
  }

  const egress = await egressIp();
  const results = await Promise.all(
    hosts.map((host) =>
      testOne({
        host,
        port,
        user,
        password,
        database,
        sslMode,
        timeoutMs,
        listDatabases,
      }),
    ),
  );

  const notice = results.some((row) => row.ok)
    ? "At least one host connected. Copy the env block below, then delete this route."
    : "No host connected. Read the hint under each failure - the first one is usually the real cause.";

  return res.type("html").send(
    page({
      token: body.token,
      body,
      results,
      egress,
      notice,
    }),
  );
});

module.exports = router;
