/**
 * Splash Screen Initialization
 * Handles navigation based on authentication status
 */

class SplashScreen {
  static SPLASH_DURATION = 2000; // 2 seconds minimum splash screen display
  static TOKEN_VERIFY_TIMEOUT = 5000; // 5 seconds timeout for token verification

  /**
   * Initialize splash screen and determine navigation
   */
  static async init() {
    try {
      console.log("SplashScreen: Initializing...");

      // Wait for minimum splash duration
      await this.delay(this.SPLASH_DURATION);

      // Check if user is authenticated
      if (AuthTokenService.isAuthenticated()) {
        console.log("SplashScreen: Tokens found, verifying...");
        // User has tokens, verify they're valid with timeout
        await this.verifyTokenAndNavigate();
      } else {
        console.log("SplashScreen: No tokens found, redirecting to login");
        // No tokens, redirect to login
        this.navigateToLogin();
      }
    } catch (error) {
      console.error("SplashScreen: Error during initialization:", error);
      // On error, redirect to login for safety
      this.navigateToLogin();
    }
  }

  /**
   * Verify token validity and navigate accordingly with timeout
   */
  static async verifyTokenAndNavigate() {
    try {
      const token = AuthTokenService.getAccessToken();

      // Create a promise for verification
      const verificationPromise = fetch(`${API_BASE_URL}/api/users/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Race between verification and timeout
      const response = await Promise.race([
        verificationPromise,
        this.timeoutPromise(this.TOKEN_VERIFY_TIMEOUT),
      ]);

      if (response.ok) {
        // Token is valid, user is authenticated
        console.log("SplashScreen: Token verified, navigating to dashboard");
        this.navigateToDashboard();
      } else if (response.status === 401) {
        // Token might be expired, try to refresh
        console.log("SplashScreen: Token expired, attempting refresh...");
        await this.attemptTokenRefresh();
      } else {
        // Other error, redirect to login
        console.error(
          "SplashScreen: Token verification failed with status:",
          response.status,
        );
        this.navigateToLogin();
      }
    } catch (error) {
      console.error("SplashScreen: Token verification error:", error);

      // If it's a timeout or network error, try to refresh anyway
      if (
        error.message === "Verification timeout" ||
        error instanceof TypeError
      ) {
        console.log(
          "SplashScreen: Timeout/network error, attempting token refresh as fallback...",
        );
        try {
          await this.attemptTokenRefresh();
        } catch (refreshError) {
          console.error("SplashScreen: Refresh also failed:", refreshError);
          this.navigateToLogin();
        }
      } else {
        // Other error, redirect to login
        this.navigateToLogin();
      }
    }
  }

  /**
   * Attempt to refresh token
   */
  static async attemptTokenRefresh() {
    try {
      const newToken = await TokenRefreshManager.refreshToken();
      if (newToken) {
        console.log("SplashScreen: Token refreshed successfully");
        this.navigateToDashboard();
      } else {
        console.log("SplashScreen: Token refresh returned no token");
        this.navigateToLogin();
      }
    } catch (error) {
      console.error("SplashScreen: Token refresh failed:", error);
      // TokenRefreshManager will handle clearing tokens
      // Just redirect to login
      this.navigateToLogin();
    }
  }

  /**
   * Create a timeout promise
   */
  static timeoutPromise(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Verification timeout")), ms);
    });
  }

  /**
   * Navigate to dashboard
   */
  static navigateToDashboard() {
    this.fadeOutAndNavigate("pages/dashboard.html");
  }

  /**
   * Navigate to login
   */
  static navigateToLogin() {
    this.fadeOutAndNavigate("pages/login.html");
  }

  /**
   * Fade out splash screen and navigate
   */
  static fadeOutAndNavigate(path) {
    const splashScreen = document.getElementById("splash-screen");

    if (splashScreen) {
      splashScreen.classList.add("fade-out");

      // Wait for fade-out animation to complete
      setTimeout(() => {
        window.location.href = path;
      }, 500);
    } else {
      // Fallback if element doesn't exist
      window.location.href = path;
    }
  }

  /**
   * Utility function to delay execution
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize splash screen when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  SplashScreen.init();
});

// Also initialize if DOM is already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    SplashScreen.init();
  });
} else {
  SplashScreen.init();
}
