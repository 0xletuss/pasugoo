/**
 * Authentication Module with Persistent Login
 * Handles user registration, login, token management, and auto-refresh
 */

// Use API_BASE_URL from main.js or define if not available
const API_BASE_URL_AUTH =
  window.API_BASE_URL ||
  (typeof API_BASE_URL !== "undefined"
    ? API_BASE_URL
    : "https://pasugo.onrender.com");

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

        const response = await fetch(`${API_BASE_URL_AUTH}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const data = await response.json();

        // Update tokens in storage
        const newAccessToken = data.data.access_token;
        const newRefreshToken = data.data.refresh_token;

        AuthTokenService.updateTokens(newAccessToken, newRefreshToken);

        return newAccessToken;
      } catch (error) {
        console.error("Token refresh error:", error);
        // Clear tokens and redirect to login
        AuthTokenService.clearTokens();
        window.location.href = "login.html";
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
// REGISTRATION FORM MANAGEMENT
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
    submitBtn.textContent = "Creating Account...";

    try {
      const formData = this.getFormData();
      const response = await this.submitRegistration(formData);

      this.showSuccess(
        successDiv,
        "Registration successful! Redirecting to login...",
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } catch (error) {
      let errorMsg = error.message || "Registration failed. Please try again.";
      this.showError(errorDiv, errorMsg);

      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
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

    // Add rider-specific fields
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

  async submitRegistration(data) {
    // Prepare form data if there's a file
    let submitData = data;
    let headers = { "Content-Type": "application/json" };
    let endpoint = `${API_BASE_URL_AUTH}/api/auth/register`;

    // If rider with file, use the rider registration endpoint
    if (data.user_type === "rider" || data.id_file) {
      const formData = new FormData();
      formData.append("full_name", data.full_name);
      formData.append("email", data.email);
      formData.append("phone_number", data.phone_number);
      formData.append("password", data.password);
      formData.append("address", data.address);

      // Add rider-specific fields
      if (data.id_number) formData.append("id_number", data.id_number);
      if (data.vehicle_type) formData.append("vehicle_type", data.vehicle_type);
      if (data.vehicle_plate)
        formData.append("vehicle_plate", data.vehicle_plate);
      if (data.license_number)
        formData.append("license_number", data.license_number);
      if (data.service_zones)
        formData.append("service_zones", data.service_zones);
      if (data.id_file) formData.append("id_file", data.id_file);

      submitData = formData;
      delete headers["Content-Type"]; // Let browser set it for FormData
      endpoint = `${API_BASE_URL_AUTH}/api/riders/register`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body:
        submitData instanceof FormData
          ? submitData
          : JSON.stringify(submitData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Registration failed");
    }

    return await response.json();
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

      // Store tokens and user data
      AuthTokenService.saveTokens(
        data.access_token,
        data.refresh_token,
        data.user,
      );

      this.showSuccess(successDiv, "Login successful! Redirecting...");

      setTimeout(() => {
        window.location.href = "dashboard.html";
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
    const response = await fetch(
      `${API_BASE_URL_AUTH}/api/auth/validate-token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

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
      // Token invalid, try to refresh
      console.log("Session validation: Token invalid, attempting refresh...");
      try {
        await TokenRefreshManager.refreshToken();
        return true;
      } catch (error) {
        // Refresh failed, clear tokens
        console.error("Session validation: Refresh failed:", error);
        AuthTokenService.clearTokens();
        return false;
      }
    }
  } catch (error) {
    console.error("Session validation error:", error);
    // If API call fails, try to refresh as a fallback
    try {
      console.log(
        "Session validation: API error, attempting fallback refresh...",
      );
      await TokenRefreshManager.refreshToken();
      return true;
    } catch (refreshError) {
      console.error(
        "Session validation: Fallback refresh also failed:",
        refreshError,
      );
      return false;
    }
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
    }
  }

  // If on login/register page and already logged in, redirect to dashboard
  const authPages = ["login.html", "register.html"];
  if (authPages.some((page) => currentPage.includes(page))) {
    console.log(
      "Auth module: Auth page detected, checking if already logged in...",
    );
    if (isUserLoggedIn()) {
      console.log("Auth module: User already logged in, validating...");
      const isValid = await validateSession();
      if (isValid) {
        console.log("Auth module: Session valid, redirecting to dashboard");
        // Redirect to dashboard, adjust path based on current directory
        const dashboardPath = currentPage.includes("../")
          ? "dashboard.html"
          : "../pages/dashboard.html";
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
