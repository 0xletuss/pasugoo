/**
 * CLOUDINARY INTEGRATION - FRONTEND GUIDE
 * Complete Pasugo Mobile App Media Upload & Management
 *
 * This file shows how to integrate Cloudinary uploads in your Cordova app
 */

// ============================================
// CLOUDINARY UPLOAD SERVICE
// ============================================

class CloudinaryUploadService {
  constructor(
    apiBaseUrl = window.API_BASE_URL || "https://pasugo.onrender.com",
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Upload file to backend which handles Cloudinary upload
   */
  async uploadFile(file, uploadType, additionalParams = {}) {
    try {
      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(
          `File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
        );
      }

      // Create FormData with proper format
      const formData = new FormData();
      formData.append("file", file);

      // Build URL with query parameters
      let url = `${this.apiBaseUrl}/api/uploads/${uploadType}`;
      const queryParams = new URLSearchParams();

      if (additionalParams.request_id) {
        queryParams.append("request_id", additionalParams.request_id);
      }
      if (additionalParams.complaint_id) {
        queryParams.append("complaint_id", additionalParams.complaint_id);
      }

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      // Get authentication token
      const token =
        window.auth?.getAccessToken?.() || localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Not authenticated. Please login first.");
      }

      // Upload to backend
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const result = await response.json();
      console.log(`✅ File uploaded: ${uploadType}`, result);
      return result;
    } catch (error) {
      console.error(`❌ Upload error (${uploadType}):`, error);
      throw error;
    }
  }

  /**
   * Upload rider ID document during registration
   */
  async uploadRiderId(file) {
    return await this.uploadFile(file, "rider-id");
  }

  /**
   * Upload bill photo
   */
  async uploadBillPhoto(file, requestId) {
    return await this.uploadFile(file, "bill-photo", { request_id: requestId });
  }

  /**
   * Upload user profile photo
   */
  async uploadProfilePhoto(file) {
    return await this.uploadFile(file, "profile-photo");
  }

  /**
   * Upload complaint attachment
   */
  async uploadComplaintAttachment(file, complaintId) {
    return await this.uploadFile(file, "complaint-attachment", {
      complaint_id: complaintId,
    });
  }

  /**
   * Check if Cloudinary is healthy (optional - for debugging)
   */
  async checkHealthy() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/uploads/health`);
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

// Initialize service globally
window.cloudinaryUploadService = new CloudinaryUploadService();

// ============================================
// RIDER REGISTRATION - ID DOCUMENT UPLOAD
// ============================================

/**
 * Example: Handle ID file selection and upload during rider registration
 */
async function handleRiderIdUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadBtn = event.target.parentElement.querySelector("button");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    // Upload ID document
    const uploadResult =
      await window.cloudinaryUploadService.uploadRiderId(file);

    // Show success message
    showNotification("ID document uploaded successfully!", "success");

    // Store URL in form (will be sent to backend during registration)
    document.getElementById("idUploadPreview")?.remove();
    const preview = document.createElement("div");
    preview.id = "idUploadPreview";
    preview.innerHTML = `
            <div style="margin: 10px 0; padding: 10px; background: #d4edda; border-radius: 4px;">
                ✅ Document uploaded: <a href="${uploadResult.data.url}" target="_blank">View</a>
                <input type="hidden" id="uploadedIdUrl" value="${uploadResult.data.url}">
            </div>
        `;
    event.target.parentElement.appendChild(preview);

    uploadBtn.textContent = "Choose Another File";
    uploadBtn.disabled = false;
  } catch (error) {
    showNotification(`Upload failed: ${error.message}`, "error");
    uploadBtn.textContent = "Choose File";
    uploadBtn.disabled = false;
  }
}

// ============================================
// BILL REQUEST - PHOTO UPLOAD
// ============================================

/**
 * Example: Upload bill photo after creating bill request
 */
async function uploadBillPhotoForRequest(requestId, file) {
  try {
    console.log(`Uploading bill photo for request ${requestId}...`);

    const uploadResult = await window.cloudinaryUploadService.uploadBillPhoto(
      file,
      requestId,
    );

    console.log("✅ Bill photo uploaded:", uploadResult.data.url);

    // Update UI with photo thumbnail
    displayBillPhotoThumbnail(uploadResult.data.url);

    return uploadResult.data.url;
  } catch (error) {
    console.error("❌ Failed to upload bill photo:", error);
    showNotification(`Failed to upload bill photo: ${error.message}`, "error");
    throw error;
  }
}

function displayBillPhotoThumbnail(imageUrl) {
  const preview =
    document.getElementById("billPhotoPreview") || createPhotoPreview();
  preview.innerHTML = `
        <img src="${imageUrl}" 
             alt="Bill Photo" 
             style="max-width: 300px; border-radius: 8px; margin: 10px 0;">
        <p>✅ Photo uploaded</p>
    `;
}

function createPhotoPreview() {
  const preview = document.createElement("div");
  preview.id = "billPhotoPreview";
  preview.style.cssText =
    "margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 8px;";
  document.getElementById("billForm")?.appendChild(preview);
  return preview;
}

// ============================================
// USER PROFILE - PHOTO UPLOAD
// ============================================

/**
 * Example: Upload profile photo from user settings
 */
async function uploadProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate it's an image
  if (!file.type.startsWith("image/")) {
    showNotification("Please select an image file", "error");
    return;
  }

  const uploadBtn = event.target.parentElement.querySelector("button");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    // Show loading indicator
    const preview = document.getElementById("profilePhotoPreview");
    if (preview) preview.innerHTML = "<p>Uploading...</p>";

    // Upload photo
    const uploadResult =
      await window.cloudinaryUploadService.uploadProfilePhoto(file);

    // Display photo with thumbnail
    displayProfilePhoto(uploadResult.data);

    showNotification("Profile photo updated successfully!", "success");

    uploadBtn.textContent = "Change Photo";
    uploadBtn.disabled = false;
  } catch (error) {
    showNotification(`Failed to upload photo: ${error.message}`, "error");
    uploadBtn.textContent = "Choose Photo";
    uploadBtn.disabled = false;
  }
}

function displayProfilePhoto(photoData) {
  const preview =
    document.getElementById("profilePhotoPreview") ||
    createProfilePhotoPreview();

  preview.innerHTML = `
        <div style="text-align: center;">
            <img src="${photoData.url}" 
                 alt="Profile Photo" 
                 style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin: 10px 0;">
            <p style="font-size: 12px; color: #666;">
                Thumbnail: <img src="${photoData.thumbnail_url}" 
                               style="height: 50px; border-radius: 50%;">
            </p>
        </div>
    `;
}

function createProfilePhotoPreview() {
  const preview = document.createElement("div");
  preview.id = "profilePhotoPreview";
  preview.style.cssText =
    "margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; text-align: center;";
  document.getElementById("profileForm")?.appendChild(preview);
  return preview;
}

// ============================================
// COMPLAINT - ATTACHMENT UPLOAD
// ============================================

/**
 * Example: Upload attachment for complaint
 */
async function uploadComplaintAttachment(event, complaintId) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadBtn = event.target.parentElement.querySelector("button");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    // Upload attachment
    const uploadResult =
      await window.cloudinaryUploadService.uploadComplaintAttachment(
        file,
        complaintId,
      );

    // Show attachment info
    const attachmentList =
      document.getElementById("attachmentsList") || createAttachmentList();
    const item = document.createElement("div");
    item.style.cssText =
      "padding: 10px; margin: 5px 0; background: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;";
    item.innerHTML = `
            📎 <a href="${uploadResult.data.url}" target="_blank">${file.name}</a>
            <span style="font-size: 12px; color: #666;"> (${(uploadResult.data.size / 1024).toFixed(2)}KB)</span>
        `;
    attachmentList.appendChild(item);

    showNotification("Attachment uploaded successfully!", "success");

    uploadBtn.textContent = "Add Another File";
    uploadBtn.disabled = false;

    // Reset file input
    event.target.value = "";
  } catch (error) {
    showNotification(`Upload failed: ${error.message}`, "error");
    uploadBtn.textContent = "Choose File";
    uploadBtn.disabled = false;
  }
}

function createAttachmentList() {
  const list = document.createElement("div");
  list.id = "attachmentsList";
  list.style.cssText = "margin: 15px 0;";
  document.getElementById("complaintForm")?.appendChild(list);
  return list;
}

// ============================================
// FILE INPUT HANDLER
// ============================================

/**
 * Safe file input handler with validation
 */
function setupFileInput(inputElement, maxSizeMB = 10) {
  if (!inputElement) return;

  inputElement.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      showNotification(`File size exceeds ${maxSizeMB}MB limit`, "error");
      event.target.value = "";
      return;
    }

    // Show file info
    const fileInfo = document.createElement("p");
    fileInfo.style.cssText = "font-size: 12px; color: #666; margin-top: 5px;";
    fileInfo.textContent = `${file.name} • ${(file.size / 1024).toFixed(2)}KB`;

    // Remove old file info if exists
    const oldInfo =
      inputElement.parentElement.querySelector("[data-file-info]");
    if (oldInfo) oldInfo.remove();
    fileInfo.setAttribute("data-file-info", "true");

    inputElement.parentElement.appendChild(fileInfo);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Show notification message
 */
function showNotification(message, type = "info") {
  console.log(`[${type.toUpperCase()}] ${message}`);

  // If you have a toast/notification library, use it here
  // Example: toast(message, type);

  // Simple alert fallback
  const backgroundColor =
    {
      success: "#4CAF50",
      error: "#f44336",
      info: "#2196F3",
    }[type] || "#2196F3";

  const notification = document.createElement("div");
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Get file from camera (Cordova/mobile)
 */
function capturePhotoFromCamera(uploadCallback) {
  if (!navigator.camera) {
    showNotification("Camera not available on this device", "error");
    return;
  }

  navigator.camera.getPicture(
    (imageUri) => {
      // Convert to Blob and upload
      fetch(imageUri)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          uploadCallback(file);
        })
        .catch((err) => showNotification("Failed to process photo", "error"));
    },
    (error) => {
      console.error("Camera error:", error);
      showNotification("Failed to capture photo", "error");
    },
    {
      quality: 80,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.CAMERA,
    },
  );
}

/**
 * Get file from gallery (Cordova/mobile)
 */
function selectPhotoFromGallery(uploadCallback) {
  if (!navigator.camera) {
    showNotification("File picker not available", "error");
    return;
  }

  navigator.camera.getPicture(
    (imageUri) => {
      fetch(imageUri)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `photo_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          uploadCallback(file);
        })
        .catch((err) => showNotification("Failed to process image", "error"));
    },
    (error) => {
      console.error("Gallery error:", error);
      showNotification("Failed to select image", "error");
    },
    {
      quality: 80,
      destinationType: Camera.DestinationType.FILE_URI,
      sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
    },
  );
}

// ============================================
// INITIALIZATION ON PAGE LOAD
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // Setup file inputs
  setupFileInput(document.getElementById("riderIdInput"));
  setupFileInput(document.getElementById("billPhotoInput"));
  setupFileInput(document.getElementById("profilePhotoInput"));
  setupFileInput(document.getElementById("complaintAttachmentInput"));

  // Setup event listeners
  const riderIdInput = document.getElementById("riderIdInput");
  if (riderIdInput) {
    riderIdInput.addEventListener("change", handleRiderIdUpload);
  }

  const profilePhotoInput = document.getElementById("profilePhotoInput");
  if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", uploadProfilePhoto);
  }

  // Setup camera buttons (if using Cordova camera plugin)
  const cameraBtn = document.getElementById("cameraCaptureBtn");
  if (cameraBtn) {
    cameraBtn.addEventListener("click", () => {
      capturePhotoFromCamera(uploadProfilePhoto);
    });
  }

  console.log("✅ Cloudinary upload service ready");
});

// ============================================
// CSS ANIMATIONS
// ============================================

const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    .uploading {
        opacity: 0.6;
        pointer-events: none;
    }

    .file-preview {
        margin: 10px 0;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
        border-left: 4px solid #2196F3;
    }
`;
document.head.appendChild(style);

// ============================================
// EXPORT FOR USE IN OTHER FILES
// ============================================

window.CloudinaryUpload = {
  uploadRiderId: (file) => window.cloudinaryUploadService.uploadRiderId(file),
  uploadBillPhoto: (file, requestId) =>
    window.cloudinaryUploadService.uploadBillPhoto(file, requestId),
  uploadProfilePhoto: (file) =>
    window.cloudinaryUploadService.uploadProfilePhoto(file),
  uploadComplaintAttachment: (file, complaintId) =>
    window.cloudinaryUploadService.uploadComplaintAttachment(file, complaintId),
  checkHealth: () => window.cloudinaryUploadService.checkHealthy(),
  showNotification: showNotification,
  capturePhoto: capturePhotoFromCamera,
  selectPhoto: selectPhotoFromGallery,
};
