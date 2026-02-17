/**
 * Authentication Module with Persistent Login
 * Handles user registration, login, token management, and auto-refresh
 * Updated with OTP-based registration flow and role-based routing
 */

// Use API_BASE_URL from main.js or define if not available
const API_BASE_URL_AUTH =
  window.API_BASE_URL ||
  (typeof API_BASE_URL !== "undefined"
    ? API_BASE_URL
    : "https://pasugo.onrender.com");

// ============================================
// GLOBAL FETCH INTERCEPTOR – auto-refresh on 401
// Wraps the native fetch so every call in the app
// (dashboard-controller, rider-chat, etc.) gets
// automatic token refresh without code changes.
// ============================================
(function installFetchInterceptor() {
  const _originalFetch = window.fetch;
  let _refreshing = null;

  window.fetch = async function (input, init) {
    let response = await _originalFetch.call(window, input, init);

    // Only intercept 401s for our own API calls that carry a Bearer token
    const url = typeof input === "string" ? input : input?.url || "";
    const authHeader =
      init?.headers?.Authorization ||
      init?.headers?.authorization ||
      (init?.headers instanceof Headers
        ? init.headers.get("Authorization")
        : "");

    if (
      response.status === 401 &&
      authHeader &&
      String(authHeader).startsWith("Bearer ") &&
      url.includes("/api/")
    ) {
      // Avoid infinite loop – don't intercept the refresh call itself
      if (url.includes("/api/auth/refresh")) return response;

      try {
        // Deduplicate concurrent refreshes
        if (!_refreshing) {
          _refreshing = (async () => {
            const rt = localStorage.getItem("refresh_token");
            if (!rt) throw new Error("No refresh token");

            const rRes = await _originalFetch.call(
              window,
              `${API_BASE_URL_AUTH}/api/auth/refresh`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: rt }),
              },
            );

            if (!rRes.ok) throw new Error("Refresh rejected");

            const rData = await rRes.json();
            localStorage.setItem("access_token", rData.data.access_token);
            if (rData.data.refresh_token)
              localStorage.setItem("refresh_token", rData.data.refresh_token);
            return rData.data.access_token;
          })();
        }

        const newToken = await _refreshing;
        _refreshing = null;

        // Retry original request with new token
        const newInit = { ...init, headers: { ...init?.headers } };
        if (newInit.headers instanceof Headers) {
          newInit.headers.set("Authorization", `Bearer ${newToken}`);
        } else {
          newInit.headers.Authorization = `Bearer ${newToken}`;
        }
        response = await _originalFetch.call(window, input, newInit);
      } catch (refreshErr) {
        _refreshing = null;
        console.warn("Auto-refresh failed:", refreshErr.message);
        // Only redirect to login if we truly have no valid session
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        if (
          !window.location.href.includes("login.html") &&
          !window.location.href.includes("register.html") &&
          !window.location.href.includes("index.html")
        ) {
          window.location.href = "login.html";
        }
      }
    }

    return response;
  };
})();

// ============================================
// TOKEN STORAGE SERVICE
// ============================================

class AuthTokenService {
  // Keys for localStorage
  static ACCESS_TOKEN_KEY = "access_token";
  static REFRESH_TOKEN_KEY = "refresh_token";
  static USER_DATA_KEY = "user_data";

  /**
   * Save tokens to localStorage after login
   */
  static saveTokens(accessToken, refreshToken, userData) {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
  }

  /**
   * Get access token from localStorage
   */
  static getAccessToken() {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Get refresh token from localStorage
   */
  static getRefreshToken() {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Get user data from localStorage
   */
  static getUserData() {
    const userData = localStorage.getItem(this.USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Update access token only (after refresh)
   */
  static updateAccessToken(accessToken) {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
  }

  /**
   * Update both tokens (after refresh with rotation)
   */
  static updateTokens(accessToken, refreshToken) {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * Clear all tokens (on logout)
   */
  static clearTokens() {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_DATA_KEY);
  }

  /**
   * Check if user has tokens stored
   */
  static isAuthenticated() {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }
}

// ============================================
// AUTO TOKEN REFRESH MANAGER
// ============================================

class TokenRefreshManager {
  static isRefreshing = false;
  static refreshPromise = null;

  /**
   * Refresh the access token using refresh token
   */
  static async refreshToken() {
    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = AuthTokenService.getRefreshToken();

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${API_BASE_URL_AUTH}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Only clear tokens on explicit auth rejection
        if (response.status === 401 || response.status === 403) {
          console.warn("Token refresh rejected by server – session expired");
          AuthTokenService.clearTokens();
          window.location.href = "login.html";
          throw new Error("Session expired");
        }

        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.status}`);
        }

        const data = await response.json();

        // Update tokens in storage
        const newAccessToken = data.data.access_token;
        const newRefreshToken = data.data.refresh_token;

        AuthTokenService.updateTokens(newAccessToken, newRefreshToken);

        return newAccessToken;
      } catch (error) {
        // Don't clear tokens on network / timeout errors – keep session alive
        if (
          error.message === "Session expired" ||
          error.message === "No refresh token available"
        ) {
          throw error;
        }
        console.warn(
          "Token refresh network error (keeping session):",
          error.message,
        );
        throw error;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

// ============================================
// AUTHENTICATED FETCH WRAPPER
// ============================================

/**
 * Make authenticated API requests with automatic token refresh
 */
async function authenticatedFetch(url, options = {}) {
  const token = AuthTokenService.getAccessToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  // Add authorization header
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  // Make the request
  let response = await fetch(url, { ...options, headers });

  // If 401 (Unauthorized), try to refresh token
  if (response.status === 401) {
    try {
      // Refresh the token
      const newToken = await TokenRefreshManager.refreshToken();

      // Retry the original request with new token
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } catch (error) {
      // Refresh failed, user needs to login again
      throw new Error("Session expired. Please login again.");
    }
  }

  return response;
}

// ============================================
// REGISTRATION FORM MANAGEMENT (OTP-BASED)
// ============================================

class RegistrationForm {
  constructor(formSelector, userType = "customer") {
    this.form = document.querySelector(formSelector);
    this.userType = userType;
    this.setupFormListeners();
    this.setupDynamicFields();
  }

  setupFormListeners() {
    if (this.form) {
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));

      // Real-time validation
      this.form.querySelectorAll("input, textarea, select").forEach((field) => {
        field.addEventListener("blur", () => this.validateField(field));
        field.addEventListener("change", () => {
          if (field.id === "userType") {
            this.updateUserType(field.value);
          }
        });
      });
    }
  }

  setupDynamicFields() {
    const userTypeSelect = document.getElementById("userType");
    if (userTypeSelect) {
      userTypeSelect.addEventListener("change", (e) => {
        this.userType = e.target.value;
        this.toggleRiderFields(e.target.value === "rider");
      });
    }
  }

  toggleRiderFields(isRider) {
    const riderFieldsContainer = document.getElementById("riderFields");
    if (riderFieldsContainer) {
      riderFieldsContainer.style.display = isRider ? "block" : "none";

      // Update required attribute for rider fields
      riderFieldsContainer
        .querySelectorAll("input, select")
        .forEach((field) => {
          field.required = isRider;
        });
    }
  }

  validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = "";

    switch (field.id) {
      case "fullName":
        if (!value) {
          isValid = false;
          errorMessage = "Full name is required";
        } else if (value.length < 2) {
          isValid = false;
          errorMessage = "Full name must be at least 2 characters";
        } else if (!/^[a-zA-Z\s'-]+$/.test(value)) {
          isValid = false;
          errorMessage =
            "Full name can only contain letters, spaces, hyphens, and apostrophes";
        }
        break;

      case "email":
        if (!value) {
          isValid = false;
          errorMessage = "Email is required";
        } else if (!this.isValidEmail(value)) {
          isValid = false;
          errorMessage = "Please enter a valid email address";
        }
        break;

      case "phone":
        if (!value) {
          isValid = false;
          errorMessage = "Phone number is required";
        } else if (!this.isValidPhone(value)) {
          isValid = false;
          errorMessage =
            "Please enter a valid phone number (e.g., +63 or 09xxxxxxxxx)";
        }
        break;

      case "password":
        if (!value) {
          isValid = false;
          errorMessage = "Password is required";
        } else if (value.length < 8) {
          isValid = false;
          errorMessage = "Password must be at least 8 characters";
        } else if (!this.isStrongPassword(value)) {
          isValid = false;
          errorMessage =
            "Password must contain uppercase, lowercase, numbers, and special characters";
        }
        break;

      case "confirmPassword":
        const passwordField = document.getElementById("password");
        if (!value) {
          isValid = false;
          errorMessage = "Please confirm your password";
        } else if (value !== passwordField.value) {
          isValid = false;
          errorMessage = "Passwords do not match";
        }
        break;

      case "idNumber":
        if (this.userType === "rider" && !value) {
          isValid = false;
          errorMessage = "ID number is required";
        } else if (value && value.length < 5) {
          isValid = false;
          errorMessage = "ID number must be at least 5 characters";
        }
        break;

      case "licenseNumber":
        if (this.userType === "rider" && !value) {
          isValid = false;
          errorMessage = "License number is required";
        } else if (value && value.length < 5) {
          isValid = false;
          errorMessage = "License number must be at least 5 characters";
        }
        break;

      case "vehiclePlateNumber":
        if (this.userType === "rider" && !value) {
          isValid = false;
          errorMessage = "Vehicle plate number is required";
        } else if (value && value.length < 3) {
          isValid = false;
          errorMessage = "Vehicle plate number must be at least 3 characters";
        }
        break;

      case "termsCheckbox":
        if (!field.checked) {
          isValid = false;
          errorMessage = "You must agree to the Terms & Conditions";
        }
        break;
    }

    this.displayFieldError(field, isValid, errorMessage);
    return isValid;
  }

  displayFieldError(field, isValid, errorMessage) {
    let errorElement = field.parentElement.querySelector(".field-error");

    if (!isValid) {
      if (!errorElement) {
        errorElement = document.createElement("small");
        errorElement.className = "field-error";
        errorElement.style.color = "#dc3545";
        errorElement.style.display = "block";
        errorElement.style.marginTop = "4px";
        field.parentElement.appendChild(errorElement);
      }
      errorElement.textContent = errorMessage;
      field.classList.add("input-error");
    } else {
      if (errorElement) {
        errorElement.remove();
      }
      field.classList.remove("input-error");
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^(\+63|0)\d{9,10}$/;
    return phoneRegex.test(phone.replace(/\s|-/g, ""));
  }

  isStrongPassword(password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password,
    );

    return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
  }

  async handleSubmit(e) {
    e.preventDefault();

    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");
    const submitBtn = this.form.querySelector('button[type="submit"]');

    // Clear previous messages
    if (errorDiv) errorDiv.style.display = "none";
    if (successDiv) successDiv.style.display = "none";

    // Validate all fields
    const fields = this.form.querySelectorAll("input, textarea, select");
    let allValid = true;

    fields.forEach((field) => {
      if (field.type !== "hidden" && field.offsetParent !== null) {
        if (!this.validateField(field)) {
          allValid = false;
        }
      }
    });

    if (!allValid) {
      this.showError(errorDiv, "Please fix the errors above");
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending OTP...";

    try {
      const formData = this.getFormData();

      // Step 1: Request OTP
      const otpResult = await this.requestRegistrationOTP(formData.email);

      // Store form data temporarily for OTP verification
      sessionStorage.setItem("pendingRegistration", JSON.stringify(formData));

      // Show OTP in the success message for development/debugging
      const otpCode = otpResult?.data?.otp_code;
      const debugMsg = otpCode
        ? `OTP sent to your email! Your code is: ${otpCode}`
        : "OTP sent to your email! Please check your inbox.";

      this.showSuccess(successDiv, debugMsg);

      // Show OTP input UI
      setTimeout(() => {
        this.showOTPVerificationUI();
      }, 1500);

      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    } catch (error) {
      let errorMsg = error.message || "Registration failed. Please try again.";
      this.showError(errorDiv, errorMsg);

      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  }

  async requestRegistrationOTP(email) {
    const response = await fetch(
      `${API_BASE_URL_AUTH}/api/auth/register/request-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to send OTP");
    }

    return await response.json();
  }

  showOTPVerificationUI() {
    // Hide the registration form
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.style.display = "none";
    }

    // Create OTP verification UI
    const container = document.querySelector(".main-container");
    const otpUI = document.createElement("div");
    otpUI.id = "otpVerificationUI";
    otpUI.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h2>Verify Your Email</h2>
        <p style="color: #666; margin-bottom: 20px;">
          Enter the 6-digit code sent to your email
        </p>
        
        <div class="form-group">
          <input 
            type="text" 
            id="otpInput" 
            maxlength="6" 
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="one-time-code"
            placeholder="Enter OTP"
            style="text-align: center; font-size: 24px; letter-spacing: 8px;"
            required
          />
        </div>
        
        <button id="verifyOTPBtn" class="btn btn-primary">
          Verify & Register
        </button>
        
        <div style="margin-top: 20px;">
          <button id="resendOTPBtn" class="btn" style="background: transparent; color: var(--primary-black);">
            Resend OTP
          </button>
        </div>
        
        <div style="margin-top: 15px;">
          <button id="backToFormBtn" class="btn" style="background: transparent; color: #666;">
            ← Back to form
          </button>
        </div>
      </div>
    `;

    container.appendChild(otpUI);

    // Add event listeners
    document
      .getElementById("verifyOTPBtn")
      .addEventListener("click", () => this.verifyOTPAndRegister());
    document
      .getElementById("resendOTPBtn")
      .addEventListener("click", () => this.resendOTP());
    document
      .getElementById("backToFormBtn")
      .addEventListener("click", () => this.backToForm());

    // Auto-submit on 6 digits
    document.getElementById("otpInput").addEventListener("input", (e) => {
      if (e.target.value.length === 6) {
        this.verifyOTPAndRegister();
      }
    });
  }

  async verifyOTPAndRegister() {
    // Guard against double submission (auto-submit + button click race)
    if (this._isVerifyingOTP) return;
    this._isVerifyingOTP = true;

    const otpInput = document.getElementById("otpInput");
    const verifyBtn = document.getElementById("verifyOTPBtn");
    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");

    const otp = otpInput.value.trim();

    if (otp.length !== 6) {
      this.showError(errorDiv, "Please enter a valid 6-digit OTP");
      this._isVerifyingOTP = false;
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    try {
      const formData = JSON.parse(
        sessionStorage.getItem("pendingRegistration"),
      );

      if (!formData || !formData.email) {
        throw new Error(
          "Registration data not found. Please go back and fill the form again.",
        );
      }

      console.log(`📤 Verifying OTP: '${otp}' for email: ${formData.email}`);

      const response = await fetch(
        `${API_BASE_URL_AUTH}/api/auth/register/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            otp: otp,
            full_name: formData.full_name,
            phone_number: formData.phone_number,
            password: formData.password,
            user_type: formData.user_type,
            address: formData.address || "",
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        // Handle Pydantic 422 validation errors (detail is an array)
        let errorMsg = "OTP verification failed";
        if (Array.isArray(errorData.detail)) {
          errorMsg = errorData.detail
            .map((e) => e.msg || e.message || JSON.stringify(e))
            .join(", ");
        } else if (typeof errorData.detail === "string") {
          errorMsg = errorData.detail;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      // Clear stored form data
      sessionStorage.removeItem("pendingRegistration");

      this.showSuccess(
        successDiv,
        "Registration successful! Redirecting to login...",
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } catch (error) {
      this.showError(errorDiv, error.message);
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify & Register";
    } finally {
      this._isVerifyingOTP = false;
    }
  }

  async resendOTP() {
    const resendBtn = document.getElementById("resendOTPBtn");
    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");

    resendBtn.disabled = true;
    resendBtn.textContent = "Sending...";

    try {
      const formData = JSON.parse(
        sessionStorage.getItem("pendingRegistration"),
      );

      const response = await fetch(`${API_BASE_URL_AUTH}/api/auth/otp/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          otp_type: "registration",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to resend OTP");
      }

      this.showSuccess(successDiv, "New OTP sent to your email!");

      setTimeout(() => {
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend OTP";
      }, 30000); // Disable for 30 seconds
    } catch (error) {
      this.showError(errorDiv, error.message);
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend OTP";
    }
  }

  backToForm() {
    const otpUI = document.getElementById("otpVerificationUI");
    const registerForm = document.getElementById("registerForm");

    if (otpUI) otpUI.remove();
    if (registerForm) registerForm.style.display = "block";

    // Clear error/success messages
    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");
    if (errorDiv) errorDiv.style.display = "none";
    if (successDiv) successDiv.style.display = "none";
  }

  getFormData() {
    const data = {
      full_name: document.getElementById("fullName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone_number: document.getElementById("phone").value.trim(),
      password: document.getElementById("password").value,
      user_type: this.userType,
      address: document.getElementById("address")?.value.trim() || "",
    };

    // Add rider-specific fields if needed in the future
    if (this.userType === "rider") {
      data.id_number =
        document.getElementById("idNumber")?.value.trim() || null;
      data.vehicle_type = document.getElementById("vehicleType")?.value || null;
      data.vehicle_plate =
        document.getElementById("vehiclePlateNumber")?.value.trim() || null;
      data.license_number =
        document.getElementById("licenseNumber")?.value.trim() || null;
      data.service_zones =
        document.getElementById("serviceZones")?.value.trim() || null;
      data.id_file = document.getElementById("idUpload")?.files?.[0] || null;
    }

    return data;
  }

  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.style.display = "block";
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      alert(message);
    }
  }

  showSuccess(element, message) {
    if (element) {
      element.textContent = message;
      element.style.display = "block";
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  updateUserType(userType) {
    this.userType = userType;
  }
}

// ============================================
// LOGIN FORM MANAGEMENT
// ============================================

class LoginForm {
  constructor(formSelector) {
    this.form = document.querySelector(formSelector);
    this.setupFormListeners();
  }

  setupFormListeners() {
    if (this.form) {
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      this.form.querySelectorAll("input").forEach((field) => {
        field.addEventListener("blur", () => this.validateField(field));
      });
    }
  }

  validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = "";

    if (field.id === "email") {
      isValid = value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      errorMessage = "Please enter a valid email address";
    } else if (field.id === "password") {
      isValid = value && value.length >= 6;
      errorMessage = "Password is required";
    }

    this.displayFieldError(field, isValid, errorMessage);
    return isValid;
  }

  displayFieldError(field, isValid, errorMessage) {
    let errorElement = field.parentElement.querySelector(".field-error");

    if (!isValid && field.value.trim()) {
      if (!errorElement) {
        errorElement = document.createElement("small");
        errorElement.className = "field-error";
        errorElement.style.color = "#dc3545";
        errorElement.style.display = "block";
        errorElement.style.marginTop = "4px";
        field.parentElement.appendChild(errorElement);
      }
      errorElement.textContent = errorMessage;
      field.classList.add("input-error");
    } else {
      if (errorElement) errorElement.remove();
      field.classList.remove("input-error");
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const errorDiv = document.getElementById("errorMessage");
    const successDiv = document.getElementById("successMessage");
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("rememberMe")?.checked ?? true; // Default to true

    // Clear messages
    if (errorDiv) errorDiv.style.display = "none";
    if (successDiv) successDiv.style.display = "none";

    // Validate
    if (!email || !password) {
      this.showError(errorDiv, "Please enter email and password");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const response = await fetch(`${API_BASE_URL_AUTH}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          remember_me: rememberMe,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const result = await response.json();
      const data = result.data;

      // DEBUG: Log the entire response to see what we're getting
      console.log("=== LOGIN DEBUG ===");
      console.log("Full result:", result);
      console.log("Data object:", data);
      console.log("User object:", data.user);
      console.log("User type from user_type:", data.user?.user_type);
      console.log("User type from role:", data.user?.role);
      console.log("==================");

      // Store tokens and user data
      AuthTokenService.saveTokens(
        data.access_token,
        data.refresh_token,
        data.user,
      );

      this.showSuccess(successDiv, "Login successful! Redirecting...");

      setTimeout(() => {
        // Redirect based on user type
        // Handle Python enum format: "UserType.rider" -> "rider"
        let userType = data.user.user_type || data.user.role;

        // Strip "UserType." prefix if present
        if (userType && userType.includes(".")) {
          userType = userType.split(".")[1];
        }

        console.log("Determined user type for redirect:", userType);
        console.log(
          "Checking condition userType === 'rider':",
          userType === "rider",
        );

        if (userType === "rider") {
          console.log("REDIRECTING TO: rider-dashboard.html");
          window.location.href = "rider-dashboard.html";
        } else if (userType === "admin") {
          console.log("REDIRECTING TO: admin-dashboard.html");
          window.location.href = "admin-dashboard.html";
        } else {
          console.log("REDIRECTING TO: dashboard.html (customer)");
          window.location.href = "dashboard.html"; // customer dashboard
        }
      }, 1500);
    } catch (error) {
      this.showError(errorDiv, error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  }

  showError(element, message) {
    if (element) {
      element.textContent = message;
      element.style.display = "block";
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      alert(message);
    }
  }

  showSuccess(element, message) {
    if (element) {
      element.textContent = message;
      element.style.display = "block";
    }
  }
}

// ============================================
// AUTH UTILITY FUNCTIONS
// ============================================

/**
 * Logout user and clear all tokens
 */
function logout() {
  AuthTokenService.clearTokens();
  window.location.href = "login.html";
}

/**
 * Get current user data from storage
 */
function getCurrentUser() {
  return AuthTokenService.getUserData();
}

/**
 * Get access token from storage
 */
function getAccessToken() {
  return AuthTokenService.getAccessToken();
}

/**
 * Check if user is logged in
 */
function isUserLoggedIn() {
  return AuthTokenService.isAuthenticated();
}

/**
 * Require login - redirect to login page if not authenticated
 */
function requireLogin() {
  if (!isUserLoggedIn()) {
    window.location.href = "login.html";
  }
}

/**
 * Validate current session on app load
 */
async function validateSession() {
  if (!isUserLoggedIn()) {
    console.log("Session validation: User not logged in");
    return false;
  }

  const token = AuthTokenService.getAccessToken();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `${API_BASE_URL_AUTH}/api/auth/validate-token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    // Server explicitly rejected the token
    if (response.status === 401 || response.status === 403) {
      console.log("Session validation: Token rejected, attempting refresh...");
      try {
        await TokenRefreshManager.refreshToken();
        return true;
      } catch (error) {
        console.error("Session validation: Refresh failed:", error);
        return false;
      }
    }

    const data = await response.json();

    if (data.valid) {
      console.log("Session validation: Token is valid");
      // Update user data if needed
      if (data.data && data.data.user) {
        const currentUser = AuthTokenService.getUserData();
        const updatedUser = { ...currentUser, ...data.data.user };
        localStorage.setItem(
          AuthTokenService.USER_DATA_KEY,
          JSON.stringify(updatedUser),
        );
      }
      return true;
    } else {
      // Token invalid per server, try to refresh
      console.log("Session validation: Token invalid, attempting refresh...");
      try {
        await TokenRefreshManager.refreshToken();
        return true;
      } catch (error) {
        console.error("Session validation: Refresh failed:", error);
        // Only return false if it was an explicit auth rejection
        if (
          error.message === "Session expired" ||
          error.message === "No refresh token available"
        ) {
          return false;
        }
        // Network error – trust existing tokens
        console.log("Session validation: Network error, trusting local tokens");
        return true;
      }
    }
  } catch (error) {
    // Network error / timeout – DON'T log the user out
    // Trust local tokens, they'll get validated on the next API call
    console.warn(
      "Session validation: Network error, trusting local tokens:",
      error.message,
    );
    return true;
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Auth module: DOMContentLoaded event");

  // Initialize registration form
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    new RegistrationForm("#registerForm");
  }

  // Initialize login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    new LoginForm("#loginForm");
  }

  // Get current page
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  console.log("Auth module: Current page:", currentPage);

  // Check authentication on protected pages
  const protectedPages = [
    "dashboard.html",
    "rider-dashboard.html",
    "admin-dashboard.html",
    "profile.html",
    "transactions.html",
    "orders.html",
  ];

  if (protectedPages.some((page) => currentPage.includes(page))) {
    console.log("Auth module: Protected page detected, validating session...");
    // Validate session
    const isValid = await validateSession();

    if (!isValid) {
      console.log("Auth module: Session invalid, redirecting to login");
      window.location.href = "../pages/login.html";
    } else {
      console.log("Auth module: Session valid");

      // Check if user is on the correct dashboard
      const user = getCurrentUser();
      let userType = user?.user_type || user?.role;

      // Strip "UserType." prefix if present
      if (userType && userType.includes(".")) {
        userType = userType.split(".")[1];
      }

      if (
        userType === "rider" &&
        currentPage.includes("dashboard.html") &&
        !currentPage.includes("rider-dashboard")
      ) {
        console.log("Auth module: Rider on customer dashboard, redirecting...");
        window.location.href = "rider-dashboard.html";
      } else if (
        userType === "customer" &&
        currentPage.includes("rider-dashboard")
      ) {
        console.log("Auth module: Customer on rider dashboard, redirecting...");
        window.location.href = "dashboard.html";
      } else if (
        userType === "admin" &&
        !currentPage.includes("admin-dashboard")
      ) {
        console.log("Auth module: Admin on wrong dashboard, redirecting...");
        window.location.href = "admin-dashboard.html";
      }
    }
  }

  // If on login/register page and already logged in, redirect to appropriate dashboard
  const authPages = ["login.html", "register.html", "rider-register.html"];
  if (authPages.some((page) => currentPage.includes(page))) {
    console.log(
      "Auth module: Auth page detected, checking if already logged in...",
    );
    if (isUserLoggedIn()) {
      console.log("Auth module: User already logged in, validating...");
      const isValid = await validateSession();
      if (isValid) {
        console.log("Auth module: Session valid, redirecting to dashboard");

        const user = getCurrentUser();
        let userType = user?.user_type || user?.role;

        // Strip "UserType." prefix if present
        if (userType && userType.includes(".")) {
          userType = userType.split(".")[1];
        }

        let dashboardPath;
        if (userType === "rider") {
          dashboardPath = currentPage.includes("../")
            ? "rider-dashboard.html"
            : "../pages/rider-dashboard.html";
        } else if (userType === "admin") {
          dashboardPath = currentPage.includes("../")
            ? "admin-dashboard.html"
            : "../pages/admin-dashboard.html";
        } else {
          dashboardPath = currentPage.includes("../")
            ? "dashboard.html"
            : "../pages/dashboard.html";
        }

        window.location.href = dashboardPath;
      }
    }
  }
});

// ============================================
// EXPORT FUNCTIONS FOR EXTERNAL USE
// ============================================

window.auth = {
  logout,
  getCurrentUser,
  getAccessToken,
  isUserLoggedIn,
  requireLogin,
  authenticatedFetch,
  validateSession,
  RegistrationForm,
  LoginForm,
  AuthTokenService,
  TokenRefreshManager,
};
