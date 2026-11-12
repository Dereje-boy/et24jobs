//mendatory imports
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const connectEnsureLogin = require("connect-ensure-login");
const { engine } = require("express-handlebars");
const path = require("path");
const fs = require("fs");
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const app = express();

// Bootstrap
app.use(
  "/js/bootstrap.min.js",
  express.static("node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"),
);
app.use(
  "/bootstrap-slider/js/bootstrap-slider.min.js",
  express.static("node_modules/bootstrap-slider/dist/bootstrap-slider.min.js"),
);
app.use(
  "/bootstrap-slider/css/bootstrap-slider.min.css",
  express.static("node_modules/bootstrap-slider/dist/bootstrap-slider.min.css"),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
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

if (!hbEngine.handlebars) {
  throw new Error(
    "express-handlebars did not expose hbEngine.handlebars on this version",
  );
}

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
app.set("views", path.join(__dirname, "views"));
app.set("port", process.env.PORT || 5000);

// Add Bootstrap
app.use(
  "/css/bootstrap/bootstrap.min.css",
  express.static(
    path.join(__dirname, "node_modules/bootstrap/dist/css/bootstrap.min.css"),
  ),
);
app.use(
  "/css/bootstrap/bootstrap.min.css",
  express.static(
    path.join(__dirname, "node_modules/bootstrap/dist/css/bootstrap.min.css"),
  ),
);

// call session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "superSecretCookieSecret",
    resave: true,
    saveUninitialized: true,
    store: new SequelizeStore({ db: require("./config/database") }),
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false },
  }),
);

registerMiddleware(app, require("./utils/appUtils"));

// flash messages
app.use(connectEnsureLogin.ensureLoggedIn());

app.use("/job/delete", userMiddleware.redirectWithFlash);
app.use("/job/view/:id", userMiddleware.redirectWithFlash);
app.use("/job/edit/:id", userMiddleware.redirectWithFlash);
app.use("/scholarship/:id", userMiddleware.redirectWithFlash);
app.use("/scholarship/delete/:id", userMiddleware.redirectWithFlash);
app.use("/scholarship/edit/:id", userMiddleware.redirectWithFlash);
app.use("/internship/:id", userMiddleware.redirectWithFlash);
app.use("/internship/delete/:id", userMiddleware.redirectWithFlash);
app.use("/internship/edit/:id", userMiddleware.redirectWithFlash);
app.use("/announcements/:id", userMiddleware.redirectWithFlash);

// add as general middleware - `/admin/login`, `/admin/auth`, `/admin/logout`
app.use("/admin/login", adminMiddleware.filterLoginPage);
app.use("/admin/auth", adminMiddleware.filterAuthPage);
app.use("/admin/logout", adminMiddleware.filterLogoutPage);

// Flash messages
app.use(require("./Middlewares/flash"));

// add as general middleware
app.use("/", generalMiddleware.filterPage);

// load user
app.use("/", userMiddleware.loadUser);

// require admin - `/admin/home`, `/admin/add-job`, `/admin/add-scholarship` etc
app.use("/admin/home", connectEnsureLogin.ensureLoggedIn());
app.use("/admin/add-job", connectEnsureLogin.ensureLoggedIn());
app.use("/admin/add-scholarship", connectEnsureLogin.ensureLoggedIn());
app.use("/admin/add-internship", connectEnsureLogin.ensureLoggedIn());
app.use("/admin/add-announcements", connectEnsureLogin.ensureLoggedIn());

// Call the default connectEnsureLogin.ensureLoggedIn to ensure an user is
// authenticated before registering for an account
app.use(
  "/register",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login/register",
  }),
);

// Add the pageCss middleware
app.use((req, res, next) => {
  res.locals.pageCss = "site";
  next();
});

app.set("port", process.env.PORT || 5000);

app.use(express.static(path.join(__dirname, "public")));

app.use("/", home);
app.use("/job", jobs);
app.use("/scholarship", scholarships);
app.use("/internship", internships);
app.use("/announcements", announcements);
app.use("/contact", contactUs);
app.use("/unsubscribe", handler);

app.use("/admin", admin);

// Assets
app.get("/assets/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", req.params[0]));
});

// error handling
app.use(function (err, req, res) {
  const statusCode = err.status;
  const errCode = err.status || 500;
  const pkgJson = require(path.join(__dirname, "package.json"));
  res.status(errCode).render("error", {
    message: err.message,
    error: err,
    app: pkgJson.name,
    status: errCode,
  });
});

app.listen(app.get("port"), () => {
  console.log("Server reached. Running on port", app.get("port"));
  console.log("Press Ctrl + C to stop");
});

// global middleware configuration
function registerMiddleware(app, utils) {
  app.use(utils.perPage());
  app.use(utils.requireAdmin());
  app.use(utils.requireUser());
}
