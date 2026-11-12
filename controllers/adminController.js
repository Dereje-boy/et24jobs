// Admin panel pages: dashboard, per-entity manage lists, delete and status
// actions. All routes here sit behind Middlewares/requireAdmin.js (see
// routes/adminRoute.js).
//
// Job create/edit/delete live on the existing public-style routes
// (/jobs/post, /jobs/:id/edit, /jobs/:id/delete) which are also gated by
// requireAdmin; the dashboard links to them.

const { Job, Scholarship, Internship } = require("../models");
const { notifyJobPublished } = require("../services/telegram");

// entity slug -> Sequelize model (used by the generic delete/status routes)
const ENTITIES = {
  jobs: Job,
  scholarships: Scholarship,
  internships: Internship,
};

const STATUSES = ["draft", "published", "expired", "archived"];

// True when a DATEONLY deadline is before today (local time). Same strict
// boundary as the isExpired() helper in app.js and the auto-expiry sweeper
// (Middlewares/expireJobs.js), so this warning can never disagree with
// what the sweeper will actually do.
const deadlineHasPassed = (deadline) => {
  if (!deadline) return false;
  const now = new Date();
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return String(deadline).slice(0, 10) < todayString;
};

// GET /admin - overview with per-entity counts and recent items.
exports.dashboard = async (req, res) => {
  try {
    const [
      jobCount,
      scholarshipCount,
      internshipCount,
      recentJobs,
      recentScholarships,
      recentInternships,
    ] = await Promise.all([
      Job.count(),
      Scholarship.count(),
      Internship.count(),
      Job.findAll({ order: [["created_at", "DESC"]], limit: 5 }),
      Scholarship.findAll({ order: [["created_at", "DESC"]], limit: 5 }),
      Internship.findAll({ order: [["created_at", "DESC"]], limit: 5 }),
    ]);

    res.render("admin/dashboard", {
      counts: {
        jobs: jobCount,
        scholarships: scholarshipCount,
        internships: internshipCount,
      },
      recentJobs: recentJobs.map((row) => row.toJSON()),
      recentScholarships: recentScholarships.map((row) => row.toJSON()),
      recentInternships: recentInternships.map((row) => row.toJSON()),
      adminUsername: req.session && req.session.adminUsername,
    });
  } catch (error) {
    console.log("Unable to load dashboard");
    console.error(error);
    res.status(500).send("Unable to load dashboard");
  }
};

// Normalizes a job/scholarship/internship row into the shape the shared
// admin list view (views/admin/entityList.handlebars) renders.
const toListItem = (row, entity) => {
  const data = row.toJSON();
  const subtitles = {
    jobs: data.companyName,
    scholarships: data.providerName,
    internships: data.organizationName,
  };

  return {
    id: data.id,
    title: data.title,
    subtitle: subtitles[entity] || "",
    slug: data.slug,
    status: data.status,
    views: data.views,
    deadline: data.deadline,
    createdAt: data.created_at
      ? new Date(data.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "",
    // Public detail URL and (jobs only, for now) the edit URL
    detailUrl: `/${entity}/${data.slug}`,
    editUrl: entity === "jobs" ? `/jobs/${data.id}/edit` : null,
  };
};

// GET /admin/jobs - all jobs, any status, newest first.
exports.listJobs = async (req, res) => {
  try {
    const jobs = await Job.findAll({
      order: [["created_at", "DESC"]],
    });

    res.render("admin/entityList", {
      entity: "jobs",
      entityTitle: "Jobs",
      newUrl: "/jobs/post",
      statuses: STATUSES,
      items: jobs.map((row) => toListItem(row, "jobs")),
      adminUsername: req.session && req.session.adminUsername,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to load jobs");
  }
};

// GET /admin/scholarships - all scholarships, any status.
// (Creation/edit forms for scholarships are not built yet; the public post
// pages are stubs. List, delete and status switching work from here.)
exports.listScholarships = async (req, res) => {
  try {
    const scholarships = await Scholarship.findAll({
      order: [["created_at", "DESC"]],
    });

    res.render("admin/entityList", {
      entity: "scholarships",
      entityTitle: "Scholarships",
      newUrl: null,
      statuses: STATUSES,
      items: scholarships.map((row) => toListItem(row, "scholarships")),
      adminUsername: req.session && req.session.adminUsername,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to load scholarships");
  }
};

// GET /admin/internships - all internships, any status.
// (Creation/edit forms for internships are not built yet; the public post
// pages are stubs. List, delete and status switching work from here.)
exports.listInternships = async (req, res) => {
  try {
    const internships = await Internship.findAll({
      order: [["created_at", "DESC"]],
    });

    res.render("admin/entityList", {
      entity: "internships",
      entityTitle: "Internships",
      newUrl: null,
      statuses: STATUSES,
      items: internships.map((row) => toListItem(row, "internships")),
      adminUsername: req.session && req.session.adminUsername,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to load internships");
  }
};

// POST /admin/:entity/:id/delete - jobs are archived, not deleted: the row,
// its attachment rows and files all stay, and the job can be restored from
// the list below (Restore button) or re-hidden later. Scholarships and
// internships are still permanently deleted.
exports.destroyEntity = async (req, res) => {
  try {
    const { entity } = req.params;
    const id = Number(req.params.id);

    const Model = ENTITIES[entity];
    if (!Model || !Number.isInteger(id) || id <= 0) {
      // Bootstrap 5 has no alert-error class, so the type name must be
      // Bootstrap's "danger" for the view's alert-{{flash.type}} to work.
      req.flash("danger", "Unknown item type.");
      return res.redirect("/admin");
    }

    const row = await Model.findByPk(id);
    if (!row) {
      req.flash("danger", "Item not found.");
      return res.redirect(`/admin/${entity}`);
    }

    if (entity === "jobs") {
      // Soft delete: keep everything, just hide from the public site.
      await row.update({ status: "archived" });
      req.flash(
        "success",
        `"${row.title}" archived — restore it anytime from this list.`,
      );
    } else {
      await row.destroy();
      req.flash("success", `"${row.title}" permanently deleted.`);
    }

    res.redirect(`/admin/${entity}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to delete the item");
  }
};

// POST /admin/:entity/:id/status - quick status switch from the list pages.
exports.updateStatus = async (req, res) => {
  try {
    const { entity } = req.params;
    const id = Number(req.params.id);
    const { status } = req.body;

    const Model = ENTITIES[entity];
    if (!Model || !Number.isInteger(id) || id <= 0) {
      req.flash("danger", "Unknown item type.");
      return res.redirect("/admin");
    }

    if (!STATUSES.includes(status)) {
      req.flash("danger", `"${status}" is not a valid status.`);
      return res.redirect(`/admin/${entity}`);
    }

    const row = await Model.findByPk(id);
    if (!row) {
      req.flash("danger", "Item not found.");
      return res.redirect(`/admin/${entity}`);
    }

    // publishedAt set/cleared on the published<->draft transitions.
    const previousStatus = row.status;
    const patch = { status };
    if (status === "published" && !row.publishedAt) {
      patch.publishedAt = new Date();
    }
    await row.update(patch);

    if (status === "draft" && previousStatus === "archived") {
      req.flash("success", `"${row.title}" restored as draft.`);
    } else {
      req.flash("success", `Status changed to ${status}.`);
    }

    // Announce on the Telegram channel when a job goes live (any transition
    // TO published - republishing an expired/restored job re-announces).
    // Awaited so a failure can be flashed; capped at 4s inside the service
    // so an unreachable Telegram never hangs the admin's request.
    if (
      entity === "jobs" &&
      status === "published" &&
      previousStatus !== "published"
    ) {
      const telegram = await notifyJobPublished(row);
      if (!telegram.ok && !telegram.disabled) {
        req.flash(
          "warning",
          `"${row.title}" was published, but the Telegram announcement failed - check the server log.`,
        );
      }
    }

    // Warn before the sweeper undoes it: publishing an already-lapsed job
    // gets re-expired on the next sweep unless the deadline is extended.
    // (Overwrites the flashes above on purpose - losing the job to the
    // sweeper matters more than how it was announced.)
    if (status === "published" && deadlineHasPassed(row.deadline)) {
      req.flash(
        "warning",
        `"${row.title}" was published, but its deadline has passed — the auto-expiry will hide it again on the next sweep unless you extend the deadline in Edit.`,
      );
    }

    res.redirect(`/admin/${entity}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to update the status");
  }
};
