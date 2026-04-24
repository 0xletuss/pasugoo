// ═══════════════════════════════════════════════════════════════════════════════
//  RIDER VERIFICATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = window.API_BASE || "https://pasugo.onrender.com/api";

let currentStep = 1;
let selfieFile = null;
let idFile = null;
let selfieUrl = null;
let idUrl = null;

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  initializeVerificationForm();
  checkApprovalStatus();
});

function initializeVerificationForm() {
  // Selfie upload
  const selfieInput = document.getElementById("selfieInput");
  const selfieUploadArea = document.getElementById("selfieUploadArea");

  selfieUploadArea.addEventListener("click", () => selfieInput.click());
  selfieUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    selfieUploadArea.classList.add("active");
  });
  selfieUploadArea.addEventListener("dragleave", () => {
    selfieUploadArea.classList.remove("active");
  });
  selfieUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    selfieUploadArea.classList.remove("active");
    if (e.dataTransfer.files[0]) {
      selfieInput.files = e.dataTransfer.files;
      handleSelfieSelect();
    }
  });

  selfieInput.addEventListener("change", handleSelfieSelect);

  // ID upload
  const idInput = document.getElementById("idInput");
  const idUploadArea = document.getElementById("idUploadArea");

  idUploadArea.addEventListener("click", () => idInput.click());
  idUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    idUploadArea.classList.add("active");
  });
  idUploadArea.addEventListener("dragleave", () => {
    idUploadArea.classList.remove("active");
  });
  idUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    idUploadArea.classList.remove("active");
    if (e.dataTransfer.files[0]) {
      idInput.files = e.dataTransfer.files;
      handleIDSelect();
    }
  });

  idInput.addEventListener("change", handleIDSelect);
}

function handleSelfieSelect() {
  const selfieInput = document.getElementById("selfieInput");
  const file = selfieInput.files[0];

  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    showAlert("Please select a valid image file", "error");
    return;
  }

  selfieFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("selfieImage").src = e.target.result;
    document.getElementById("selfiePreview").style.display = "block";
  };
  reader.readAsDataURL(file);
}

function handleIDSelect() {
  const idInput = document.getElementById("idInput");
  const file = idInput.files[0];

  if (!file) return;

  idFile = file;
  const isImage = file.type.startsWith("image/");
  const isPDF = file.type === "application/pdf";

  if (!isImage && !isPDF) {
    showAlert("Please select a valid image or PDF file", "error");
    idFile = null;
    return;
  }

  const idPreview = document.getElementById("idPreview");
  const idImage = document.getElementById("idImage");
  const pdfPreview = document.getElementById("pdfPreview");
  const pdfFileName = document.getElementById("pdfFileName");

  idPreview.style.display = "block";

  if (isImage) {
    const reader = new FileReader();
    reader.onload = (e) => {
      idImage.src = e.target.result;
      idImage.style.display = "block";
      pdfPreview.style.display = "none";
    };
    reader.readAsDataURL(file);
  } else {
    idImage.style.display = "none";
    pdfFileName.textContent = file.name;
    pdfPreview.style.display = "block";
  }
}

function removeSelfie() {
  selfieFile = null;
  document.getElementById("selfieInput").value = "";
  document.getElementById("selfiePreview").style.display = "none";
  document.getElementById("selfieStatus").classList.remove("show");
}

function removeID() {
  idFile = null;
  document.getElementById("idInput").value = "";
  document.getElementById("idPreview").style.display = "none";
  document.getElementById("idStatus").classList.remove("show");
}

async function uploadSelfie() {
  if (!selfieFile) {
    showAlert("No selfie selected", "error");
    return;
  }

  const selfieStatus = document.getElementById("selfieStatus");
  showStatus(selfieStatus, "Uploading selfie...", "loading");

  const formData = new FormData();
  formData.append("selfie_file", selfieFile);

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE}/riders/upload/selfie`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      selfieUrl = data.data.selfie_url;
      showStatus(selfieStatus, "Selfie uploaded successfully", "success");
      setTimeout(() => {
        selfieStatus.classList.remove("show");
      }, 2000);
    } else {
      showStatus(
        selfieStatus,
        data.detail || "Failed to upload selfie",
        "error"
      );
    }
  } catch (error) {
    showStatus(selfieStatus, "Upload failed: " + error.message, "error");
  }
}

async function uploadID() {
  if (!idFile) {
    showAlert("No ID selected", "error");
    return;
  }

  const idStatus = document.getElementById("idStatus");
  showStatus(idStatus, "Uploading ID document...", "loading");

  const formData = new FormData();
  formData.append("id_file", idFile);

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE}/riders/upload/id-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      idUrl = data.data.id_document_url;
      showStatus(idStatus, "ID document uploaded successfully", "success");
      setTimeout(() => {
        idStatus.classList.remove("show");
      }, 2000);
    } else {
      showStatus(idStatus, data.detail || "Failed to upload ID", "error");
    }
  } catch (error) {
    showStatus(idStatus, "Upload failed: " + error.message, "error");
  }
}

function nextStep() {
  // Validate current step
  if (currentStep === 1) {
    if (!selfieUrl) {
      showAlert("Please upload your selfie first", "error");
      return;
    }
  } else if (currentStep === 2) {
    if (!idUrl) {
      showAlert("Please upload your ID document first", "error");
      return;
    }
  }

  goToStep(currentStep + 1);
}

function previousStep() {
  goToStep(currentStep - 1);
}

function goToStep(step) {
  if (step < 1 || step > 3) return;

  // Hide all steps
  document.querySelectorAll(".verification-step").forEach((s) => {
    s.classList.remove("active");
  });

  // Show selected step
  document.getElementById(`step${step}`).classList.add("active");

  // Update step indicator
  for (let i = 1; i <= 3; i++) {
    const indicator = document.getElementById(`step${i}Indicator`);
    const circle = indicator.querySelector(".circle");

    indicator.classList.remove("active", "completed");

    if (i < step) {
      indicator.classList.add("completed");
      if (circle.textContent !== "✓") {
        const checkmark = document.createElement("span");
        checkmark.innerHTML = "✓";
        circle.textContent = "";
        circle.appendChild(checkmark);
      }
    } else if (i === step) {
      indicator.classList.add("active");
    }
  }

  // Update progress bar
  const progressFill = document.getElementById("progressFill");
  progressFill.style.width = `${(step / 3) * 100}%`;

  // Update review section
  if (step === 3) {
    updateReview();
  }

  currentStep = step;
  window.scrollTo(0, 0);
}

function updateReview() {
  if (selfieUrl) {
    document.getElementById("reviewSelfieImg").src = selfieUrl;
  }

  if (idUrl) {
    const isImage = !idUrl.includes(".pdf");
    if (isImage) {
      document.getElementById("reviewIDImg").src = idUrl;
      document.getElementById("reviewIDImg").style.display = "block";
      document.getElementById("reviewIDPDF").style.display = "none";
    } else {
      document.getElementById("reviewIDImg").style.display = "none";
      document.getElementById("reviewPDFName").textContent =
        idFile.name || "ID Document";
      document.getElementById("reviewIDPDF").style.display = "block";
    }
  }
}

async function submitVerification() {
  if (!selfieUrl || !idUrl) {
    showAlert(
      "Both documents must be uploaded before submitting",
      "error"
    );
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  const reviewStatus = document.getElementById("reviewStatus");

  submitBtn.disabled = true;
  showStatus(reviewStatus, "Submitting for review...", "loading");

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE}/riders/approval-status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.data.approval_status === "pending") {
      showStatus(
        reviewStatus,
        "✓ Documents submitted successfully! An admin will review within 24 hours.",
        "success"
      );
      setTimeout(() => {
        window.location.href = "rider-dashboard.html";
      }, 2000);
    } else {
      throw new Error("Failed to submit verification");
    }
  } catch (error) {
    submitBtn.disabled = false;
    showStatus(reviewStatus, "Submission failed: " + error.message, "error");
  }
}

async function checkApprovalStatus() {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE}/riders/approval-status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const status = data.data.approval_status;

      if (status === "approved") {
        // Already approved, redirect
        window.location.href = "rider-dashboard.html";
      } else if (status === "rejected") {
        // Show rejection reason
        const reason = data.data.rejection_reason || "No reason provided";
        showAlert(
          `Your application was rejected: ${reason}. Please contact support.`,
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Error checking approval status:", error);
  }
}

function showStatus(element, message, type) {
  element.className = `upload-status show ${type}`;
  element.textContent = message;
}

function showAlert(message, type = "error") {
  const alertDiv = document.getElementById("alertMessage");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.display = "block";

  setTimeout(() => {
    alertDiv.style.display = "none";
  }, 5000);
}
