// Edit job page: dropzone for new attachment files and the per-file
// Published / Draft / Delete control for EXISTING attachments.
//
// Mirrors public/js/jobs/createjobs.js (same field name and limits as
// Middlewares/uploadJobFiles.js). The tri-state control needs no JS to work
// (each file's radios post as attachmentStates[<id>] which the controller
// handles); the JS below only keeps each card's "will be deleted" overlay in
// sync with the radio the user clicks.

console.log("ET24Jobs - Edit Job Page Loaded");

// ---------------------------------------------------------------------------
// Attachments dropzone
// ---------------------------------------------------------------------------

// Limits come from the server-injected shared constants (one source of
// truth with Middlewares/uploadJobFiles.js). Fallbacks match those values.
const JOB_FILES =
  (window.JOB_VALIDATION && window.JOB_VALIDATION.files) || {};
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

// Refills the hidden input so the form submits exactly what the user sees.
const syncInput = () => {
  const transfer = new DataTransfer();
  for (const file of selectedFiles) {
    transfer.items.add(file);
  }
  fileInput.files = transfer.files;
};

const renderFiles = () => {
  fileList.innerHTML = "";

  selectedFiles.forEach((file, index) => {
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
        <button type="button" class="file-remove" data-index="${index}" aria-label="Remove ${safeName}">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    `;

    fileList.appendChild(card);
  });

  syncInput();
};

const addFiles = (incoming) => {
  let rejected = false;

  for (const file of incoming) {
    if (selectedFiles.length >= MAX_FILES) {
      rejected = true;
      break;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `"${file.name}" is larger than ${MAX_FILE_SIZE / (1024 * 1024)} MB and was not added.`,
      );
      rejected = true;
      continue;
    }
    selectedFiles.push(file);
  }

  if (rejected && selectedFiles.length >= MAX_FILES) {
    alert(`You can attach up to ${MAX_FILES} new files per save.`);
  }

  renderFiles();
};

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
  });

  // Remove buttons (delegated: the list is re-rendered on every change)
  fileList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;

    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;

    selectedFiles.splice(index, 1);
    renderFiles();
  });
}

// ---------------------------------------------------------------------------
// Existing attachment cards: keep the "will be deleted" overlay in sync with
// the Delete radio. The server pre-marks cards (class + checked radio) after
// a failed validation re-render; this handles the user's own clicks.
// ---------------------------------------------------------------------------

document.querySelectorAll(".existing-file").forEach((card) => {
  const syncCard = () => {
    const checked = card.querySelector('input[type="radio"].btn-check:checked');
    card.classList.toggle(
      "marked-remove",
      Boolean(checked && checked.value === "delete"),
    );
  };

  // Apply the server-rendered initial state (re-marked after a failed
  // validation), then keep the overlay in sync with the user's clicks.
  syncCard();

  card.addEventListener("change", (event) => {
    if (
      event.target &&
      event.target.name &&
      event.target.name.startsWith("attachmentStates[")
    ) {
      syncCard();
    }
  });
});
