require("dotenv").config({ path: ".env" });
const http = require("http");
const app = require("../app");

const server = app.listen(0, () => {
  const port = server.address().port;

  function request(body, expect, sessionPatch) {
    const opts = {
      hostname: "127.0.0.1",
      port,
      path: "/jobs/cloudflare-upload-url",
      method: "POST",
      headers: { "content-type": "application/json" },
    };

    if (sessionPatch && typeof sessionPatch === "object") {
      opts.headers["x-mock-session"] = JSON.stringify(sessionPatch);
    }

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          parsed = null;
        }

        const reason = parsed && parsed.result ? parsed.result.reason : null;
        const pass =
          res.statusCode === expect.status &&
          parsed &&
          parsed.result &&
          parsed.result.reason === expect.reason;

        console.log(
          JSON.stringify({
            status: res.statusCode,
            expectedStatus: expect.status,
            reason,
            expectedReason: expect.reason,
            body: data,
            pass,
          }),
        );
        server.close();
      });
    });

    req.on("error", (error) => {
      console.log(JSON.stringify({ error: error.message, pass: false }));
      server.close();
    });

    req.end(body);
  }

  // Logged-out request should be rejected before file validation.
  request(
    JSON.stringify({ filename: "test.png", mimeType: "image/png", fileSize: 1234 }),
    { status: 403, reason: "unauthorized" },
  );

  // Logged-out request with bad payload should still fail at the guard.
  request(
    JSON.stringify({ filename: "", mimeType: "", fileSize: 0 }),
    { status: 403, reason: "unauthorized" },
  );

  // Logged-in admin request with bad payload should fail at validation.
  request(
    JSON.stringify({ filename: "", mimeType: "", fileSize: 0 }),
    { status: 422, reason: "invalid_request" },
    { adminId: 1 },
  );

  // Logged-in admin request with oversized file should fail at validation.
  request(
    JSON.stringify({ filename: "big.png", mimeType: "image/png", fileSize: 99999999999 }),
    { status: 422, reason: "file_too_large" },
    { adminId: 1 },
  );
});

setTimeout(() => {
  server.close();
  process.exit(2);
}, 15000);
