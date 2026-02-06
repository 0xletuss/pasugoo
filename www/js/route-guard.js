/**
 * Route Protection & Authorization Module
 * Handles route guards, role-based access control, and session validation
 */

// ============================================
// ROUTE CONFIGURATION
// ============================================

const RouteConfig = {
  // Public routes - accessible without authentication
  PUBLIC_ROUTES: [
    "index.html",
    "login.html",
    "register.html",
    "about.html",
    "contact.html",
    "terms.html",
    "privacy.html",
    "",
    "/",
  ],

  // Protected routes with role requirements
  PROTECTED_ROUTES: {
    // Customer routes
    "dashboard.html": ["customer", "rider", "admin"],
    "profile.html": ["customer", "rider", "admin"],
    "orders.html": ["customer", "admin"],
    "transactions.html": ["customer", "rider", "admin"],
    "track-order.html": ["customer", "admin"],

    // Rider routes
    "rider-dashboard.html": ["rider", "admin"],
    "deliveries.html": ["rider", "admin"],
    "earnings.html": ["rider", "admin"],
    "rider-profile.html": ["rider", "admin"],

    // Admin routes
    "admin-dashboard.html": ["admin"],
    "manage-users.html": ["admin"],
    "manage-riders.html": ["admin"],
    "manage-orders.html": ["admin"],
    "analytics.html": ["admin"],
    "settings.html": ["admin"],
  },

  // Default redirects by role
  DEFAULT_REDIRECTS: {
    customer: "dashboard.html",
    rider: "rider-dashboard.html",
    admin: "admin-dashboard.html",
  },

  // Login page
  LOGIN_PAGE: "login.html",

  // Unauthorized access page
  UNAUTHORIZED_PAGE: "403.html",
};

// ============================================
// ROUTE GUARD CLASS
// ============================================

class RouteGuard {
  constructor() {
    this.currentPath = this.getCurrentPath();
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  /**
   * Get current page path
   */
  getCurrentPath() {
    const path = window.location.pathname;
    const filename = path.split("/").pop() || "index.html";
    return filename;
  }

  /**
   * Check if current route is public
   */
  isPublicRoute() {
    return RouteConfig.PUBLIC_ROUTES.includes(this.currentPath);
  }

  /**
   * Get required roles for current route
   */
  getRequiredRoles() {
    return RouteConfig.PROTECTED_ROUTES[this.currentPath] || null;
  }

  /**
   * Check if user has required role
   */
  hasRequiredRole(userRole, requiredRoles) {
    if (!requiredRoles) return true;
    return requiredRoles.includes(userRole);
  }

  /**
   * Get redirect path based on user role
   */
  getDefaultRedirect(userRole) {
    return (
      RouteConfig.DEFAULT_REDIRECTS[userRole] ||
      RouteConfig.DEFAULT_REDIRECTS.customer
    );
  }

  /**
   * Redirect to login page
   */
  redirectToLogin() {
    const currentPath = window.location.pathname + window.location.search;
    const redirectParam = encodeURIComponent(currentPath);
    window.location.href = `${RouteConfig.LOGIN_PAGE}?redirect=${redirectParam}`;
  }

  /**
   * Redirect to unauthorized page
   */
  redirectToUnauthorized() {
    window.location.href = RouteConfig.UNAUTHORIZED_PAGE;
  }

  /**
   * Redirect to default page based on user role
   */
  redirectToDefault(userRole) {
    const defaultPage = this.getDefaultRedirect(userRole);
    window.location.href = defaultPage;
  }

  /**
   * Main route protection logic
   */
  async protect() {
    console.log("🛡️ Route Guard: Checking access for", this.currentPath);

    // If public route, allow access
    if (this.isPublicRoute()) {
      console.log("✅ Route Guard: Public route, access granted");

      // If authenticated user tries to access login/register, redirect to dashboard
      if (
        this.currentPath === "login.html" ||
        this.currentPath === "register.html"
      ) {
        if (window.auth && window.auth.isUserLoggedIn()) {
          console.log(
            "📍 Route Guard: Authenticated user on auth page, validating session...",
          );
          const isValid = await window.auth.validateSession();

          if (isValid) {
            const user = window.auth.getCurrentUser();
            console.log(
              "📍 Route Guard: Valid session, redirecting to default page",
            );
            this.redirectToDefault(user.user_type);
            return false;
          }
        }
      }

      return true;
    }

    // Check authentication
    if (!window.auth || !window.auth.isUserLoggedIn()) {
      console.log("❌ Route Guard: Not authenticated, redirecting to login");
      this.redirectToLogin();
      return false;
    }

    // Validate session
    console.log("🔄 Route Guard: Validating session...");
    const isValid = await window.auth.validateSession();

    if (!isValid) {
      console.log("❌ Route Guard: Session invalid, redirecting to login");
      this.redirectToLogin();
      return false;
    }

    // Get current user
    this.currentUser = window.auth.getCurrentUser();
    this.isAuthenticated = true;

    // Check role-based access
    const requiredRoles = this.getRequiredRoles();

    if (
      requiredRoles &&
      !this.hasRequiredRole(this.currentUser.user_type, requiredRoles)
    ) {
      console.log(
        "❌ Route Guard: Insufficient permissions, user role:",
        this.currentUser.user_type,
      );
      console.log("Required roles:", requiredRoles);
      this.redirectToUnauthorized();
      return false;
    }

    console.log(
      "✅ Route Guard: Access granted for",
      this.currentUser.user_type,
    );
    return true;
  }
}

// ============================================
// ROUTE GUARD WRAPPER COMPONENT
// ============================================

/**
 * Higher-order function to wrap page initialization with route protection
 */
function withRouteGuard(initFunction) {
  return async function () {
    const guard = new RouteGuard();
    const hasAccess = await guard.protect();

    if (hasAccess && initFunction) {
      // Initialize page after successful access check
      await initFunction();
    }
  };
}

/**
 * Require specific roles for a page
 */
function requireRoles(roles, redirectOnFail = true) {
  const user = window.auth?.getCurrentUser();

  if (!user) {
    if (redirectOnFail) {
      window.location.href = RouteConfig.LOGIN_PAGE;
    }
    return false;
  }

  const hasRole = roles.includes(user.user_type);

  if (!hasRole && redirectOnFail) {
    window.location.href = RouteConfig.UNAUTHORIZED_PAGE;
  }

  return hasRole;
}

/**
 * Check if user is customer
 */
function isCustomer() {
  const user = window.auth?.getCurrentUser();
  return user?.user_type === "customer";
}

/**
 * Check if user is rider
 */
function isRider() {
  const user = window.auth?.getCurrentUser();
  return user?.user_type === "rider";
}

/**
 * Check if user is admin
 */
function isAdmin() {
  const user = window.auth?.getCurrentUser();
  return user?.user_type === "admin";
}

// ============================================
// UI HELPERS FOR CONDITIONAL RENDERING
// ============================================

/**
 * Show/hide elements based on user role
 */
function showForRoles(selector, roles) {
  const user = window.auth?.getCurrentUser();
  const elements = document.querySelectorAll(selector);

  elements.forEach((element) => {
    if (user && roles.includes(user.user_type)) {
      element.style.display = "";
      element.classList.remove("hidden");
    } else {
      element.style.display = "none";
      element.classList.add("hidden");
    }
  });
}

/**
 * Hide elements for specific roles
 */
function hideForRoles(selector, roles) {
  const user = window.auth?.getCurrentUser();
  const elements = document.querySelectorAll(selector);

  elements.forEach((element) => {
    if (user && roles.includes(user.user_type)) {
      element.style.display = "none";
      element.classList.add("hidden");
    } else {
      element.style.display = "";
      element.classList.remove("hidden");
    }
  });
}

/**
 * Initialize role-based UI elements
 */
function initRoleBasedUI() {
  // Show elements with data-show-roles attribute
  document.querySelectorAll("[data-show-roles]").forEach((element) => {
    const roles = element
      .getAttribute("data-show-roles")
      .split(",")
      .map((r) => r.trim());
    const user = window.auth?.getCurrentUser();

    if (user && roles.includes(user.user_type)) {
      element.style.display = "";
      element.classList.remove("hidden");
    } else {
      element.style.display = "none";
      element.classList.add("hidden");
    }
  });

  // Hide elements with data-hide-roles attribute
  document.querySelectorAll("[data-hide-roles]").forEach((element) => {
    const roles = element
      .getAttribute("data-hide-roles")
      .split(",")
      .map((r) => r.trim());
    const user = window.auth?.getCurrentUser();

    if (user && roles.includes(user.user_type)) {
      element.style.display = "none";
      element.classList.add("hidden");
    } else {
      element.style.display = "";
      element.classList.remove("hidden");
    }
  });
}

// ============================================
// AUTOMATIC ROUTE PROTECTION
// ============================================

/**
 * Automatically protect routes on page load
 */
async function autoProtectRoutes() {
  const guard = new RouteGuard();
  await guard.protect();

  // Initialize role-based UI after protection check
  if (guard.isAuthenticated) {
    initRoleBasedUI();
  }
}

// ============================================
// NAVIGATION GUARDS
// ============================================

/**
 * Check if navigation to a route is allowed
 */
function canNavigateTo(routePath) {
  const user = window.auth?.getCurrentUser();

  // Check if route is public
  if (RouteConfig.PUBLIC_ROUTES.includes(routePath)) {
    return true;
  }

  // Check if user is authenticated
  if (!window.auth?.isUserLoggedIn()) {
    return false;
  }

  // Check role requirements
  const requiredRoles = RouteConfig.PROTECTED_ROUTES[routePath];
  if (!requiredRoles) {
    return true; // No specific roles required
  }

  return requiredRoles.includes(user.user_type);
}

/**
 * Safe navigation with access check
 */
function navigateTo(routePath) {
  if (canNavigateTo(routePath)) {
    window.location.href = routePath;
  } else {
    const guard = new RouteGuard();
    if (!window.auth?.isUserLoggedIn()) {
      guard.redirectToLogin();
    } else {
      guard.redirectToUnauthorized();
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-protect routes when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoProtectRoutes);
} else {
  // DOM already loaded
  autoProtectRoutes();
}

// ============================================
// EXPORT FOR EXTERNAL USE
// ============================================

window.routeGuard = {
  RouteGuard,
  RouteConfig,
  withRouteGuard,
  requireRoles,
  isCustomer,
  isRider,
  isAdmin,
  showForRoles,
  hideForRoles,
  initRoleBasedUI,
  canNavigateTo,
  navigateTo,
  autoProtectRoutes,
};
