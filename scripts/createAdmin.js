// Seeds the admin account from environment variables.
//
// Usage:
//   1. Add ADMIN_USERNAME and ADMIN_PASSWORD to .env
//   2. Run: npm run create-admin
//
// Creates the admin if it does not exist; if the username exists, its
// password hash is updated to the current ADMIN_PASSWORD. Safe to re-run.

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Admin } = require("../models");

const BCRYPT_ROUNDS = 12;

(async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "Missing ADMIN_USERNAME or ADMIN_PASSWORD in .env - cannot create admin.",
    );
    process.exit(1);
  }

  if (String(password).length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters long.");
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [admin, created] = await Admin.findOrCreate({
      where: { username },
      defaults: { username, passwordHash },
    });

    if (!created) {
      await admin.update({ passwordHash });
      console.log(`Admin "${username}" already existed - password reset.`);
    } else {
      console.log(`Admin "${username}" created successfully.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Unable to create admin:", error.message);
    process.exit(1);
  }
})();
