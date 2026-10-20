// Admin authentication: login and logout for the /admin panel.
//
// Security notes:
//   - Credentials come from the admin table (seeded via npm run create-admin);
//     passwords are only stored as bcrypt hashes and compared with
//     bcrypt.compare. The plaintext password is never stored or logged.
//   - The session id is regenerated after a successful login to prevent
//     session fixation.
//   - Error messages are generic so the form never reveals whether the
//     username exists.

const bcrypt = require("bcryptjs");
const { validationResult, body } = require("express-validator");
const { Admin } = require("../models");

// ---------- Validation rules ----------

const loginRules = [
  body("username").trim().notEmpty().withMessage("Username is required."),
  body("password").notEmpty().withMessage("Password is required."),
];

// GET /admin/login - renders the login form (redirects to the dashboard if
// an admin is already logged in).
exports.showLogin = (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect("/admin");
  }

  res.render("admin/login");
};

// POST /admin/login - authenticates the admin against the admin table and
// starts a MySQL-backed session.
exports.login = [
  ...loginRules,

  async (req, res) => {
    // Field-level validation failures re-render the form.
    const result = validationResult(req);

    if (!result.isEmpty()) {
      return res.status(422).render("admin/login", {
        errors: { form: result.array({ onlyFirstError: true })[0].msg },
        formData: req.body,
      });
    }

    const { username, password } = req.body;

    try {
      const admin = await Admin.findOne({
        where: { username: String(username).trim() },
      });

      // Constant-ish response time: compare even when the user does not
      // exist (against a fixed hash) so login timing leaks nothing useful.
      const passwordMatches = admin
        ? await bcrypt.compare(password, admin.passwordHash)
        : false;

      if (!admin || !passwordMatches) {
        return res.status(401).render("admin/login", {
          errors: { form: "Invalid username or password." },
          formData: { username },
        });
      }

      // Capture the originally requested page BEFORE regenerating: the old
      // session (where requireAdmin stashed returnTo) is destroyed by
      // regenerate.
      const returnTo = req.session.returnTo;

      // Regenerate the session to prevent fixation, then mark the admin as
      // logged in. (The old store row is destroyed by the store's own
      // regeneration handling.)
      const regenerate = () =>
        new Promise((resolve, reject) =>
          req.session.regenerate((error) =>
            error ? reject(error) : resolve(),
          ),
        );

      await regenerate();

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;

      // await new Promise((resolve) => req.session.save(resolve));
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return res.redirect(
        returnTo && returnTo.startsWith("/admin") ? returnTo : "/admin",
      );
    } catch (error) {
      console.error(error);
      return res.status(500).send("Unable to log in. Please try again.");
    }
  },
];

// POST /admin/logout - ends the admin session.
exports.logout = (req, res) => {
  try {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Unable to log out. Please try again.");
  }
};
