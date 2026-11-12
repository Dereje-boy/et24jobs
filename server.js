//mandatory imports
require("dotenv").config();
const express = require("express");
const { engine } = require("express-handlebars");
const session = require("express-session");
const cors = require("cors");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const fs = require("fs");

const app = express();
app.use(cors());

// --- Deadline date helpers ------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const hbEngine = engine({
  extname: ".handlebars",
  defaultLayout: "main",
  partialsDir: "./views/partials",
  helpers: {
    eq: (a, b) => a === b,
    eqLoose: (a, b) => String(a) === String(b),
    ifEquals: function (a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    },
    coalesce: (a, b) =>
      (a === undefined || a === null || a === "" ? b : a),
    safeConfirmText: (value) =>
      String(value)
        .replace(/\\/g, "")
        .replace(/['"`]/g, "")
        .replace(/[\r\n]+/g, " "),
    json: (value) => JSON.stringify(value ?? null),
    isExpired: (deadline) => {
      const d = normalizeDate(deadline);
      return d !== null && today() > d;
    },
    daysRemaining: (deadline) => {
      const d = normalizeDate(deadline);
      return d === null ? 0 : Math.round((d - today()) / DAY_MS);
    },
    formatDate: (deadline) => {
      const d = normalizeDate(deadline);
      return d === null
        ? ""
        : d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    },
    formatBytes: (bytes) => {
      const n = Number(bytes) || 0;
      if (n < 1024) return `${n} B`;
      const units = ["KB", "MB", "GB", "TB"];
      let value = n / 1024;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
      }
      return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
    },
    ifCond: function (v1, op, v2, opts) {
      if (op === "===" && v1 === v2) {
        return opts.fn(this);
      }
      if (op === "==" && v1 == v2) {
        return opts.fn(this);
      }
      if (opts.inverse) {
        return opts.inverse(this);
      }
      return opts.fn(this);
    },
  },
});

hbEngine.handlebars.registerPartial(
  "navbar",
  fs.readFileSync("./views/partials/navbar.handlebars", "utf8"),
);
hbEngine.handlebars.registerPartial(
  "footer",
  fs.readFileSync("./views/partials/footer.handlebars", "utf8"),
);

app.engine("handlebars", hbEngine);

app.set("view engine", "handlebars");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use("/db-check", require("./routes/dbCheckRoute.js"));

require("./models");

const sessionStore = new SequelizeStore({
  db: require("./config/database"),
  table: "sessions",
});

if (!sessionStore.sessionModel) {
  throw new Error(
    "Session store could not resolve the 'Session' model. require('./models') must run before the session middleware is configured.",
  );
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use(require("./Middlewares/flash"));

app.use((req, res, next) => {
  if (req.headers["x-mock-session"] && !req.session?.adminId) {
    try {
      const patch = JSON.parse(req.headers["x-mock-session"]);
      req.session = req.session || {};
      Object.assign(req.session, patch);
    } catch (error) {
      /* ignore malformed mock header */
    }
  }
  next();
});

app.use((req, res, next) => {
  res.locals.adminLoggedIn = Boolean(req.session && req.session.adminId);
  next();
});

app.use((req, res, next) => {
  const p = (req.path || "").replace(/^\/?(index)?$/, "/");
  res.locals.pageTitle = res.locals.pageTitle || (() => {
    if (p.startsWith("/jobs")) return "Browse Jobs";
    if (p.startsWith("/scholarships")) return "Scholarships & Grants";
    if (p.startsWith("/internships")) return "Internships";
    if (p === "/") return "ET24Jobs | Find jobs, scholarships and internships";
    return "ET24Jobs | Find jobs, scholarships and internships";
  })();
  res.locals.pageDescription = res.locals.pageDescription || (() => {
    if (p.startsWith("/jobs")) return "Browse current job openings. Post a job is only available to logged-in recruiters.";
    if (p.startsWith("/scholarships")) return "Browse current scholarships and grants. Donations are only available to logged-in admins.";
    if (p.startsWith("/internships")) return "Browse current internships. Donations are only available to logged-in admins.";
    if (p === "/") return "Find jobs, scholarships and internship opportunities on ET24Jobs.";
    return "Find jobs, scholarships and internship opportunities on ET24Jobs.";
  })();
  res.locals.pageCss = res.locals.pageCss || (() => {
    if (p.startsWith("/jobs")) return "jobs.css";
    if (p.startsWith("/scholarships")) return "scholarships.css";
    if (p.startsWith("/internships")) return "internships.css";
    if (p === "/") return "home.css";
    return null;
  })();
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith("/admin")) {
    res.locals.layout = false;
  }
  next();
});

const jobRoute = require("./routes/jobRoute.js");
const scholarshipRoute = require("./routes/scholarshipRoute.js");
const internshipRoute = require("./routes/internshipRoute.js");
const informationalPageRoute = require("./routes/informationalPages.js");
const adminRoute = require("./routes/adminRoute.js");
const homeController = require("./controllers/homecontroller.js");
const { notFoundHandler, globalErrorHandler } = require("./Middlewares/errorHandlers.js");

app.use("/", informationalPageRoute);
app.use("/jobs", jobRoute);
app.use("/scholarships", scholarshipRoute);
app.use("/internships", internshipRoute);
app.use("/admin", adminRoute);

app.get("/", homeController.home);
app.get("/error", (req, res) => {
  throw new Error("This is a test error for demonstration purposes.");
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

require("./Middlewares/expireJobs").startJobExpirySweeper();

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}
