// Client-side validation for the job create/edit forms.
//
// Mirrors Middlewares/validateJob.js rule-for-rule. The numeric limits and
// enums come from window.JOB_VALIDATION (injected by app.js from
// Middlewares/jobValidationConstants.js), so both sides share one source of
// truth.
//
// On any failure the submit is prevented, failing fields get the same
// is-invalid / invalid-feedback styling the server re-render uses, and the
// page scrolls to the first error.
//
// KNOWN LIMITATIONS (mirrored deliberately - these stay server-only):
//   - Slug uniqueness needs a DB query, only checkable server-side.
//   - This is UX, not security; the backend chain remains the real gate.

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants from the server (single source of truth)
  // ---------------------------------------------------------------------------

  const V = window.JOB_VALIDATION || {};
  const TITLE = V.title || { min: 5, max: 255 };
  const ORGANIZATION = V.organization || { min: 3, max: 255 };
  const CATEGORY_ID = V.categoryId || { min: 1 };
  const LOCATION = V.location || { max: 150 };
  const SLUG = V.slug || { max: 300 };
  const SALARY = V.salary || { max: 150 };
  const APPLICATION_URL = V.applicationUrl || { max: 500 };
  const APPLICATION_EMAIL = V.applicationEmail || { max: 255 };
  const SOURCE_NAME = V.sourceName || { max: 255 };
  const SOURCE_URL = V.sourceUrl || { max: 500 };
  const MAX_TEXT_LENGTH = V.maxTextLength || 60000;
  const EMPLOYMENT_TYPES = V.employmentTypes || [
    "full-time",
    "part-time",
    "contract",
    "temporary",
    "internship",
    "volunteer",
  ];
  const STATUSES = V.statuses || ["draft", "published"];

  // ---------------------------------------------------------------------------
  // Per-field rules (exactly the server's criteria)
  // ---------------------------------------------------------------------------

  const RULES = [
    {
      field: "title",
      validate: (value) => {
        const v = value.trim();
        if (!v) return "Job title is required.";
        if (v.length > TITLE.max)
          return `Job title must be ${TITLE.max} characters or fewer.`;
        if (v.length < TITLE.min)
          return `Job title must be at least ${TITLE.min} characters long.`;
        return null;
      },
    },
    {
      field: "organization",
      validate: (value) => {
        const v = value.trim();
        if (!v) return "Organization name is required.";
        if (v.length < ORGANIZATION.min)
          return `Organization name must be at least ${ORGANIZATION.min} characters long.`;
        if (v.length > ORGANIZATION.max)
          return `Organization name must be ${ORGANIZATION.max} characters or fewer.`;
        return null;
      },
    },
    {
      field: "categoryId",
      validate: (value) => {
        if (!value) return null; // optional (falsy values skipped server-side)
        const n = Number(value);
        if (!Number.isInteger(n) || n < CATEGORY_ID.min)
          return "Selected category is invalid.";
        return null;
      },
    },
    {
      field: "location",
      validate: (value) => {
        if (!value.trim()) return null;
        return value.trim().length > LOCATION.max
          ? `Location must be ${LOCATION.max} characters or fewer.`
          : null;
      },
    },
    {
      field: "employmentType",
      validate: (value) => {
        if (!value) return null;
        return EMPLOYMENT_TYPES.includes(value)
          ? null
          : "Employment type is invalid.";
      },
    },
    {
      field: "slug",
      validate: (value) => {
        if (!value.trim()) return null;
        return value.trim().length > SLUG.max
          ? `Slug must be ${SLUG.max} characters or fewer.`
          : null;
      },
    },
    {
      field: "salary",
      validate: (value) => {
        if (!value.trim()) return null;
        return value.trim().length > SALARY.max
          ? `Salary must be ${SALARY.max} characters or fewer.`
          : null;
      },
    },
    {
      field: "deadline",
      validate: (value) => {
        if (!value) return null;

        // Server format: strict YYYY-MM-DD (the date input supplies this).
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return "Deadline must be a valid date in YYYY-MM-DD format.";
        }

        // Edit mode: an UNCHANGED (possibly past) deadline is allowed,
        // mirroring the server rule - the job simply expired; rejecting the
        // whole edit would make old jobs impossible to fix.
        const current =
          window.JOB_EDIT && window.JOB_EDIT.currentDeadline
            ? String(window.JOB_EDIT.currentDeadline).slice(0, 10)
            : null;
        if (current && current === value) {
          return null;
        }

        // Same comparison as the server: local midnight vs local midnight.
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const deadline = new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
        );
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return deadline < today
          ? "Deadline must be today or a future date."
          : null;
      },
    },
    {
      field: "description",
      validate: (value) => {
        const v = value.trim();
        if (!v) return "Description is required.";
        if (v.length > MAX_TEXT_LENGTH) return "Description is too long.";
        return null;
      },
    },
    {
      field: "responsibilities",
      validate: (value) =>
        value.trim().length > MAX_TEXT_LENGTH
          ? "Responsibilities are too long."
          : null,
    },
    {
      field: "requirements",
      validate: (value) =>
        value.trim().length > MAX_TEXT_LENGTH
          ? "Requirements are too long."
          : null,
    },
    {
      field: "qualifications",
      validate: (value) =>
        value.trim().length > MAX_TEXT_LENGTH
          ? "Qualifications are too long."
          : null,
    },
    {
      field: "applicationUrl",
      validate: (value) => {
        if (!value.trim()) return null;
        // Server checks length only for applicationUrl (no format rule) -
        // mirror exactly. Note: the input's type="url" is browser-native
        // and stricter; it already blocks malformed URLs before this runs.
        return value.trim().length > APPLICATION_URL.max
          ? `Application URL must be ${APPLICATION_URL.max} characters or fewer.`
          : null;
      },
    },
    {
      field: "applicationEmail",
      validate: (value) => {
        const v = value.trim();
        if (!v) return null;
        if (v.length > APPLICATION_EMAIL.max)
          return `Application email must be ${APPLICATION_EMAIL.max} characters or fewer.`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          return "Application email must be a valid email address.";
        return null;
      },
    },
    {
      field: "applicationInstructions",
      validate: (value) =>
        value.trim().length > MAX_TEXT_LENGTH
          ? "Application instructions are too long."
          : null,
    },
    {
      field: "sourceName",
      validate: (value) => {
        if (!value.trim()) return null;
        return value.trim().length > SOURCE_NAME.max
          ? `Source name must be ${SOURCE_NAME.max} characters or fewer.`
          : null;
      },
    },
    {
      field: "sourceUrl",
      validate: (value) => {
        const v = value.trim();
        if (!v) return null;
        if (v.length > SOURCE_URL.max)
          return `Source URL must be ${SOURCE_URL.max} characters or fewer.`;
        // Server: isURL({ require_protocol: true })
        if (!/^https?:\/\/\S+\.\S+/.test(v))
          return "Source URL must be a valid URL (e.g. https://source.com/job).";
        return null;
      },
    },
    {
      field: "status",
      validate: (value) => {
        // Backend: optional({ values: "falsy" }) - empty falls through to
        // the controller, which defaults to "published". Mirror that.
        if (!value) return null;
        return STATUSES.includes(value)
          ? null
          : "Status must be either 'draft' or 'published'.";
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  const getFeedbackEl = (field) => {
    const input = document.getElementById(field);
    if (!input) return null;
    let feedback = input.parentElement.querySelector(".invalid-feedback");
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.className = "invalid-feedback";
      input.insertAdjacentElement("afterend", feedback);
    }
    return feedback;
  };

  const showFieldError = (field, message) => {
    const input = document.getElementById(field);
    const feedback = getFeedbackEl(field);
    if (input) input.classList.add("is-invalid");
    if (feedback) feedback.textContent = message;
  };

  const clearFieldError = (field) => {
    const input = document.getElementById(field);
    const feedback = input && input.parentElement.querySelector(".invalid-feedback");
    if (input) input.classList.remove("is-invalid");
    if (feedback && feedback.textContent) feedback.textContent = "";
  };

  const validateField = (field) => {
    const input = document.getElementById(field);
    if (!input) return true;

    const rule = RULES.find((r) => r.field === field);
    if (!rule) return true;

    const error = rule.validate(input.value || "");
    if (error) {
      showFieldError(field, error);
      return false;
    }

    clearFieldError(field);
    return true;
  };

  const validateJobForm = () => {
    let firstInvalid = null;

    for (const rule of RULES) {
      const ok = validateField(rule.field);
      if (!ok && !firstInvalid) firstInvalid = rule.field;
    }

    if (firstInvalid) {
      const el = document.getElementById(firstInvalid);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus({ preventScroll: true });
    }

    return !firstInvalid;
  };

  const form = document.querySelector('form[action$="/create"], form[action$="/edit"]');

  if (form) {
    // Block submit when client validation fails.
    form.addEventListener("submit", (event) => {
      if (!validateJobForm()) {
        event.preventDefault();
      }
    });

    // Live re-validation once a field has been marked invalid.
    RULES.forEach(({ field }) => {
      const input = document.getElementById(field);
      if (!input) return;

      input.addEventListener("input", () => {
        if (input.classList.contains("is-invalid")) {
          validateField(field);
        }
      });
      input.addEventListener("change", () => {
        if (input.classList.contains("is-invalid")) {
          validateField(field);
        }
      });
    });
  }

  // Expose for tests / console debugging.
  window.validateJobForm = validateJobForm;
})();
