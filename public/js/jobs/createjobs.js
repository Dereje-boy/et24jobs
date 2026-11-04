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
// Keeps a curated list of File objects selected in the create form.
// Files are submitted with the form as normal multipart attachments.
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

let renderScheduled = false;
const renderFiles = () => {
  renderScheduled = false;
  fileList.innerHTML = "";

  selectedFiles.forEach((file) => {
    const safeName = escapeHtml(file.name);
    const preview = isImage(file)
      ? `<img class="file-thumb" src="${URL.createObjectURL(file)}" alt="${safeName}" />`
      : `<div class="file-thumb-placeholder"><i class="bi bi-file-earmark"></i></div>`;

    const card = document.createElement("div");
    card.className = "col-6 col-md-4";
    card.innerHTML = `
      <div class="file-card">
        ${preview}
        <div class="file-name mt-2" title="${safeName}">${safeName}</div>
        <small class="text-muted">${formatBytes(file.size)}</small>
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
    selectedFiles.push(file);
  }

  scheduleRender();
};

const createForm =
  document.getElementById("createJobForm") ||
  document.querySelector("main form");

if (dropzone && fileInput && fileList) {
  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

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

  fileInput.addEventListener("change", () => {
    addFiles(Array.from(fileInput.files));
  });
}

if (createForm) {
  createForm.addEventListener("submit", () => {
    // Files are submitted through the form's file input. The selected-file
    // list is only a visual aid for the admin.
  });
}
