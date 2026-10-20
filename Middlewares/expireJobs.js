// --- Auto-expire sweeper ----------------------------------------------------
// Flips published jobs whose deadline has passed to status 'expired'.
//
// How it keeps working without restarts: setInterval registers a recurring
// timer INSIDE the running Node process, so it keeps firing for the whole
// lifetime of the server (days, months, years). Nothing is scheduled per
// job - each run recomputes "today" at the moment it executes, so any job
// created in the future is picked up automatically on the first sweep after
// its deadline passes. The boot run is only catch-up for jobs that lapsed
// while the server was down.
//
// Boundary matches the isExpired() view helper in app.js exactly: strict
// "deadline < today", so a job closing TODAY stays live all day and is
// expired by the first sweep after local midnight.
//
// The WHERE clause only targets status='published', therefore:
//   - archived rows are never touched (the archive feature is preserved)
//   - rows already expired are a no-op (idempotent, safe across restarts)
//   - drafts with past deadlines stay drafts (invisible to the public)
//   - NULL deadlines never match (NULL < x is NULL in SQL), so open-ended
//     jobs stay published, same as the isExpired() display behavior.

const { Op } = require("sequelize");
const { Job } = require("../models");

// 12 hours - deliberately slow so the periodic query never makes the
// server busy. Worst case a job flips up to 12h after its deadline day.
const SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Same local-midnight date the isExpired()/today() helpers in app.js use,
// as a "YYYY-MM-DD" string for DATEONLY comparison. Local time (not UTC)
// so the sweeper and the badge shown on the site can never disagree.
const todayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sweepExpiredJobs = async () => {
  try {
    const [expiredCount] = await Job.update(
      { status: "expired" },
      {
        where: {
          status: "published",
          deadline: { [Op.lt]: todayString() },
        },
      },
    );

    if (expiredCount > 0) {
      console.log(
        `[expireJobs] ${expiredCount} job(s) past their deadline were marked expired.`,
      );
    }
  } catch (error) {
    // Never let a failed sweep crash the server (an unhandled rejection
    // inside a setInterval callback would take down the process). The
    // next sweep simply retries.
    console.error("[expireJobs] sweep failed:", error.message);
  }
};

const startJobExpirySweeper = () => {
  // Catch-up sweep at boot, then every 12 hours for the life of the process.
  sweepExpiredJobs();
  setInterval(sweepExpiredJobs, SWEEP_INTERVAL_MS);
};

module.exports = { startJobExpirySweeper, sweepExpiredJobs, todayString };
