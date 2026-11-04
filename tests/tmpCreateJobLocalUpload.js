require("dotenv").config({ path: ".env" });
const http = require("http");
const app = require("../app");

const server = app.listen(0, () => {
  const port = server.address().port;
  console.log("BOOT_PORT=" + port);

  const boundary = "----et24jobs-create-test";
  const lines = [];

  const field = (name, value) => {
    lines.push("--" + boundary);
    lines.push("Content-Disposition: form-data; name=\"" + name + "\"");
    lines.push("");
    lines.push(value);
  };

  field("title", "Cloudflare Removed Test Job");
  field("organization", "ET24Jobs Test");
  field("categoryId", "1");
  field("employmentType", "full-time");
  field("location", "Addis Ababa");
  field("salary", "Negotiable");
  field("deadline", "2027-12-31");
  field("description", "This job was submitted after Cloudflare direct upload was removed.");
  field("responsibilities", "Test responsibility 1\nTest responsibility 2");
  field("requirements", "Test requirement");
  field("applicationUrl", "https://example.com/apply");
  field("applicationInstructions", "Apply with the test form.");
  field("sourceName", "Internal test");
  field("status", "draft");

  lines.push("--" + boundary);
  lines.push(
    "Content-Disposition: form-data; name=\"attachments\"; filename=\"et24jobs-test.txt\""
  );
  lines.push("Content-Type: text/plain");
  lines.push("");
  lines.push("Cloudflare direct upload is no longer used for job attachments.");
  lines.push("--" + boundary + "--");
  lines.push("");

  const body = lines.join("\r\n");

  const opts = {
    hostname: "127.0.0.1",
    port,
    path: "/jobs/create",
    method: "POST",
    headers: {
      "content-type":
        "multipart/form-data; boundary=----et24jobs-create-test",
      "x-mock-session": JSON.stringify({ adminId: 1 }),
    },
  };

  const req = http.request(opts, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      const location = res.headers["location"] || "";
      const match = location.match(/\/jobs\/([^/]+)$/);
      const slug = match ? match[1] : null;

      console.log("create-status", res.statusCode);
      console.log("create-location", location);
      console.log("create-slug", slug);

      if (slug) {
        fetchJob(slug);
        return;
      }

      if (res.statusCode >= 300 && res.statusCode < 400) {
        fetchListing();
        return;
      }

      console.log("create-body", data.slice(0, 800).replace(/\r?\n/g, " "));
      server.close();
      process.exit(4);
    });
  });

  req.on("error", (error) => {
    console.error("request-error", error.message);
    server.close();
    process.exit(5);
  });

  req.write(body);
  req.end();
});

function fetchJob(slug) {
  http.get(
    {
      hostname: "127.0.0.1",
      port: server.address().port,
      path: "/jobs/" + slug,
      headers: {
        "x-mock-session": JSON.stringify({ adminId: 1 }),
      },
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.log("detail-status", res.statusCode);
        console.log("attachment-hits", (body.match(/et24jobs-test.txt/g) || []).length);
        console.log("attachment-text-hits", (body.match(/Cloudflare direct upload is no longer used/g) || []).length);
        console.log("detail-snippet", body.slice(0, 800).replace(/\r?\n/g, " "));
        const ok = body.includes("et24jobs-test.txt") ||
          body.includes("Cloudflare direct upload is no longer used");
        server.close();
        process.exit(ok ? 0 : 3);
      });
    }
  );
}

function fetchListing() {
  http.get(
    {
      hostname: "127.0.0.1",
      port: server.address().port,
      path: "/jobs",
      headers: {
        "x-mock-session": JSON.stringify({ adminId: 1 }),
      },
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.log("listing-status", res.statusCode);
        console.log("slug-on-listing", body.includes("cloudflare-removed-test-job"));
        console.log("attachment-on-listing", body.includes("et24jobs-test.txt"));
        console.log("listing-snippet", body.slice(0, 800).replace(/\r?\n/g, " "));
        const ok = body.includes("cloudflare-removed-test-job") ||
          body.includes("et24jobs-test.txt");
        server.close();
        process.exit(ok ? 0 : 3);
      });
    }
  );
}

setTimeout(() => {
  server.close();
  console.error("timeout");
  process.exit(6);
}, 25000);
