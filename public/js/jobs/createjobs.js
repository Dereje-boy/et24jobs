console.log("ET24Jobs - Create Job Page Loaded");

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

const titleInput = document.getElementById("title");
const organizationInput = document.getElementById("organization");
const slugInput = document.getElementById("slug");

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

titleInput.addEventListener("input", updateSlug);
// organizationInput.addEventListener("input", updateSlug);

function updateSlug() {
  let combinedText =
    titleInput.value +
    " " +
    organizationInput.value +
    " " +
    new Date().toString().split(" ").slice(1, 4).join("-");
  slugInput.value = generateSlug(combinedText);
}

// ---------------------------------------------------------------------------
// Attachments dropzone
//
// Keeps a curated list of File objects; removals are applied by re-filling
// the hidden file input through DataTransfer before the form is submitted.
// Limits mirror Middlewares/uploadJobFiles.js on the server.
// ---------------------------------------------------------------------------

// Limits come from the server-injected shared constants (one source of
// truth with Middlewares/uploadJobFiles.js). Fallbacks match those values.
// NOTE: if you want different limits, change ONLY
// Middlewares/jobValidationConstants.js - multer, this script and the
// injected window.JOB_VALIDATION all follow it.
const JOB_FILES = (window.JOB_VALIDATION && window.JOB_VALIDATION.files) || {};
const MAX_FILES = JOB_FILES.max || 5;
const MAX_FILE_SIZE = JOB_FILES.maxSizeBytes || 10 * 1024 * 1024; // 10 MB per file

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("attachments");
const fileList = document.getElementById("fileList");

let selectedFiles = [];

const CLOUDFLARE_UPLOAD_URL_PATH = "/jobs/cloudflare-upload-url";
const ATTACHMENT_SUMMARY_FIELD = "attachmentSummary";

const formatBytes = (bytes) => {
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
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isImage = (file) => Boolean(file.type) && file.type.startsWith("image/");

const statusLabel = (status) => {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "requesting":
      return "Requesting upload URL";
    case "uploading":
      return "Uploading";
    case "uploaded":
      return "Uploaded";
    case "failed":
      return "Failed";
    default:
      return status;
  }
};

const retryableError = (reason, errorText) => {
  if (reason === "upload_unavailable") return true;
  if (reason === "network" || reason === "put_failed") return true;
  if (errorText && errorText.toLowerCase().includes("fail")) return true;
  return false;
};

const buildFileEntry = (file) => ({
  file,
  name: file.name,
  mimeType: file.type,
  size: file.size,
  status: "waiting",
  uploadUrl: null,
  key: null,
  expiresIn: null,
  error: null,
  retries: 0,
});

let renderScheduled = false;
const renderFiles = () => {
  renderScheduled = false;
  fileList.innerHTML = "";

  selectedFiles.forEach((entry, index) => {
    const safeName = escapeHtml(entry.name);
    const preview = isImage(entry.file)
      ? `<img class="file-thumb" src="${URL.createObjectURL(entry.file)}" alt="${safeName}" />`
      : `<div class="file-thumb-placeholder"><i class="bi bi-file-earmark"></i></div>`;

    const statusHtml =
      entry.status === "failed"
        ? `<div class="text-danger mt-1 fw-semibold">${escapeHtml(statusLabel(entry.status))}</div>`
        : `<div class="text-success mt-1 fw-semibold">${escapeHtml(statusLabel(entry.status))}</div>`;

    const errorHtml = entry.error
      ? `<small class="text-danger d-block mt-1" title="${escapeHtml(entry.error)}">${escapeHtml(entry.error)}</small>`
      : "";

    const retryHtml =
      entry.status === "failed" &&
      retryableError(entry.errorReason, entry.error)
        ? `<button type="button" class="btn btn-sm btn-outline-primary mt-2 upload-retry" data-index="${index}">
          <i class="bi bi-arrow-clockwise"></i> Retry upload
        </button>`
        : "";

    const card = document.createElement("div");
    card.className = "col-6 col-md-4";
    card.innerHTML = `
      <div class="file-card">
        ${preview}
        <div class="file-name mt-2" title="${safeName}">${safeName}</div>
        <small class="text-muted">${formatBytes(entry.size)}</small>
        ${statusHtml}
        ${errorHtml}
        ${retryHtml}
      </div>
    `;

    fileList.appendChild(card);
  });
};

const scheduleRender = () => {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(renderFiles);
  }
};

const addFiles = (incoming) => {
  const accepted = [];

  for (const file of incoming) {
    if (selectedFiles.length >= MAX_FILES) {
      alert(`You can attach up to ${MAX_FILES} files.`);
      return;
    }

    if (!file.name || file.size > MAX_FILE_SIZE) {
      alert(
        `"${file.name || "The file you selected"}" is larger than ${MAX_FILE_SIZE / (1024 * 1024)} MB and was not added.`,
      );
      continue;
    }

    accepted.push(file);
  }

  for (const file of accepted) {
    selectedFiles.push(buildFileEntry(file));
  }

  scheduleRender();

  for (const entry of accepted) {
    uploadFile(entry);
  }
};

const setFileError = (entry, reason, message) => {
  entry.status = "failed";
  entry.errorReason = reason;
  entry.error = message;
  scheduleRender();
};

const uploadFile = async (entry) => {
  console.log("Uploading file", entry);

  // if (!entry.file) return;
  if (entry.status === "uploaded") return;

  entry.status = "requesting";
  entry.error = null;
  entry.errorReason = null;
  scheduleRender();

  try {
    const response = await fetch(CLOUDFLARE_UPLOAD_URL_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: entry.name,
        mimeType: entry.mimeType,
        fileSize: entry.size,
      }),
    });

    const parsed = await response.json().catch((e) => ({}));
    const result = parsed && parsed.result ? parsed.result : null;

    if (result === null) {
      setFileError(entry, "network", "Unable to contact the upload service.");
      return;
    }

    if (result.reason === "unauthorized") {
      setFileError(
        entry,
        "unauthorized",
        "Only logged-in admins can upload files.",
      );
      return;
    }

    if (
      result.reason === "invalid_request" ||
      result.reason === "file_too_large"
    ) {
      setFileError(
        entry,
        result.reason,
        result.message || "This file was not accepted.",
      );
      return;
    }

    if (result.reason !== "success") {
      setFileError(
        entry,
        result.reason || "upload_unavailable",
        result.message || "Upload URL could not be created.",
      );
      return;
    }

    const data = result.data || {};
    console.log("data from backend ", data.uploadUrl, data.expiresIn, data.key);

    const uploadUrl = data.uploadUrl;

    if (!uploadUrl) {
      setFileError(entry, "upload_unavailable", "No upload URL was returned.");
      return;
    }

    entry.uploadUrl = uploadUrl;
    entry.expiresIn = data.expiresIn || null;

    // TODO: once the backend returns the object key for successful upload-url
    // requests, store it here so the form can submit it with the job.
    entry.key = data.key || null;

    entry.status = "uploading";
    scheduleRender();

    await putFile(entry);
  } catch (error) {
    setFileError(
      entry,
      "network",
      error && error.message ? error.message : "Upload request failed.",
    );
  }
};

const putFile = async (entry) => {
  if (!entry.uploadUrl) {
    setFileError(entry, "put_failed", "Missing upload URL.");
    return;
  }

  try {
    const response = await fetch(entry.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": entry.mimeType || "application/octet-stream",
      },
      body: entry.file,
    });

    if (!response.ok) {
      setFileError(
        entry,
        "put_failed",
        `Remote upload failed: ${response.status} ${response.statusText}.`,
      );
      return;
    }

    entry.status = "uploaded";
    scheduleRender();
  } catch (error) {
    setFileError(
      entry,
      "put_failed",
      error && error.message ? error.message : "Remote upload failed.",
    );
  }
};

const retryUpload = (entry) => {
  if (!retryableError(entry.errorReason, entry.error)) return;

  entry.status = "waiting";
  entry.error = null;
  entry.errorReason = null;
  entry.uploadUrl = null;
  entry.key = null;
  entry.expiresIn = null;
  entry.retries += 1;
  scheduleRender();

  uploadFile(entry);
};

const attachmentSummary = () => {
  return selectedFiles.map((entry) => ({
    name: entry.name,
    mimeType: entry.mimeType,
    size: entry.size,
    status: entry.status,
    key: entry.key || null,
    error: entry.error || null,
  }));
};

const attachSummaryToForm = (form) => {
  if (!form) return;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = ATTACHMENT_SUMMARY_FIELD;
  hidden.value = JSON.stringify(attachmentSummary());
  form.appendChild(hidden);
};

const createForm =
  document.getElementById("createJobForm") ||
  document.querySelector("main form");

if (dropzone && fileInput && fileList) {
  // Click / keyboard opens the file picker
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  // Drag & drop styling
  ["dragenter", "dragover"].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    }),
  );

  ["dragleave", "drop"].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
    }),
  );

  dropzone.addEventListener("drop", (event) => {
    if (event.dataTransfer && event.dataTransfer.files) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  });

  // Picking files via the browse dialog
  fileInput.addEventListener("change", () => {
    addFiles(Array.from(fileInput.files));
    // Keep the file input around only as a trigger; attachments are now
    // submitted through the attachment summary, not through multipart files.
    if (fileInput.files && fileInput.files.length > 0) {
      const transfer = new DataTransfer();
      fileInput.files = transfer.files;
    }
  });

  // Retry buttons (delegated: the list is re-rendered on every change)
  fileList.addEventListener("click", (event) => {
    const button = event.target.closest("button.upload-retry");
    if (!button) return;

    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;

    const entry = selectedFiles[index];
    if (entry) {
      retryUpload(entry);
    }
  });
}

if (createForm) {
  createForm.addEventListener("submit", (event) => {
    attachSummaryToForm(createForm);
  });
}
