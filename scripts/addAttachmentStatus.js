// One-off (idempotent) migration: adds the per-attachment lifecycle status
// column used by the job edit form's published/draft/delete feature.
//
// Usage:
//   npm run migrate-attachments   (safe to re-run)
//
// - If job_attachments.status already exists, nothing is altered and the
//   script just reports the current state.
// - If the column is added, every existing row gets the DEFAULT 'published',
//   so no attachment disappears from the public site after the migration.

require("dotenv").config();

const { DataTypes } = require("sequelize");
const { db } = require("../models");

const STATUS_ATTRIBUTE = {
  type: DataTypes.ENUM("published", "draft"),
  allowNull: false,
  defaultValue: "published",
};

(async () => {
  try {
    const columns = await db
      .getQueryInterface()
      .describeTable("job_attachments");

    if (columns.status) {
      console.log(
        `Column job_attachments.status already exists (type: ${columns.status.type}) - nothing to do.`,
      );
    } else {
      await db
        .getQueryInterface()
        .addColumn("job_attachments", "status", STATUS_ATTRIBUTE);

      console.log(
        "Added job_attachments.status ENUM('published','draft') NOT NULL DEFAULT 'published'.",
      );
      console.log("All existing attachments were set to 'published'.");
    }

    // Report the current distribution so the result is easy to verify.
    const rows = await db.query(
      "SELECT status, COUNT(*) AS count FROM job_attachments GROUP BY status ORDER BY status",
      { type: db.QueryTypes.SELECT },
    );

    if (rows.length === 0) {
      console.log("job_attachments is empty - nothing to report.");
    } else {
      console.log("Attachment status distribution:");
      for (const row of rows) {
        console.log(`  ${row.status}: ${row.count}`);
      }
    }

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
})();
