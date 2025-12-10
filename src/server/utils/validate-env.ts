/**
 * Runtime environment variable validation
 * Checks for required environment variables at startup and provides clear error messages
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  description: string;
  checkCondition?: () => boolean; // Only required if this condition is true
}

/**
 * Environment variables that are required in production
 */
const REQUIRED_ENV_VARS: EnvVarConfig[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "Database connection string (e.g., file:/var/data/db.sqlite)",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    description: "Public URL of the application (e.g., https://portal.getlost.ink)",
  },
  {
    name: "BETTER_AUTH_URL",
    required: true,
    description: "Auth service URL (usually same as NEXT_PUBLIC_APP_URL)",
  },
];

/**
 * Environment variables that are conditionally required
 */
const CONDITIONAL_ENV_VARS: EnvVarConfig[] = [
  {
    name: "BOOK_REPORTS_PATH",
    required: true,
    description: "Path to book reports directory (e.g., /var/data/book-reports)",
    checkCondition: () => process.env.NODE_ENV === "production",
  },
  {
    name: "RESEND_API_KEY",
    required: true,
    description: "Resend API key for sending emails",
    checkCondition: () => {
      // Required in production unless email is disabled
      return (
        process.env.NODE_ENV === "production" &&
        process.env.DISABLE_EMAIL_IN_TESTS !== "true"
      );
    },
  },
  {
    name: "RESEND_FROM_EMAIL",
    required: true,
    description: "Email address to send from (e.g., noreply@yourdomain.com)",
    checkCondition: () => {
      // Required in production unless email is disabled
      return (
        process.env.NODE_ENV === "production" &&
        process.env.DISABLE_EMAIL_IN_TESTS !== "true"
      );
    },
  },
  {
    name: "STRIPE_SECRET_KEY",
    required: true,
    description: "Stripe secret key for payment processing",
    checkCondition: () => {
      // Required if Stripe is being used (not using simulated purchases)
      return (
        process.env.NODE_ENV === "production" &&
        process.env.USE_SIMULATED_PURCHASES !== "true"
      );
    },
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: true,
    description: "Stripe webhook secret for verifying webhook events",
    checkCondition: () => {
      // Required if Stripe is being used (not using simulated purchases)
      return (
        process.env.NODE_ENV === "production" &&
        process.env.USE_SIMULATED_PURCHASES !== "true"
      );
    },
  },
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    required: true,
    description: "Stripe publishable key for client-side payment",
    checkCondition: () => {
      // Required if Stripe is being used (not using simulated purchases)
      return (
        process.env.NODE_ENV === "production" &&
        process.env.USE_SIMULATED_PURCHASES !== "true"
      );
    },
  },
];

/**
 * Validate environment variables at runtime
 * @param options - Validation options
 * @returns Object with isValid boolean and errors array
 */
export function validateEnvironmentVariables(options?: {
  skipInDevelopment?: boolean;
}): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isDevelopment = process.env.NODE_ENV === "development";
  const isTest = process.env.NODE_ENV === "test";

  // Skip validation in development/test if requested
  if (options?.skipInDevelopment && (isDevelopment || isTest)) {
    return { isValid: true, errors: [], warnings: [] };
  }

  // Check required environment variables
  for (const config of REQUIRED_ENV_VARS) {
    const value = process.env[config.name];
    if (!value || value.trim() === "") {
      errors.push(
        `❌ Missing required environment variable: ${config.name}\n   ${config.description}`
      );
    }
  }

  // Check conditionally required environment variables
  for (const config of CONDITIONAL_ENV_VARS) {
    const value = process.env[config.name];
    const isRequired = config.checkCondition ? config.checkCondition() : config.required;

    if (isRequired && (!value || value.trim() === "")) {
      errors.push(
        `❌ Missing required environment variable: ${config.name}\n   ${config.description}`
      );
    } else if (!isRequired && !value) {
      // Optional but recommended
      warnings.push(
        `⚠️  Optional environment variable not set: ${config.name}\n   ${config.description}`
      );
    }
  }

  // Additional validation: Check for hardcoded local paths in production
  if (process.env.NODE_ENV === "production") {
    const bookReportsPath = process.env.BOOK_REPORTS_PATH;
    if (bookReportsPath && bookReportsPath.includes("/Users/")) {
      errors.push(
        `❌ BOOK_REPORTS_PATH contains hardcoded local path: ${bookReportsPath}\n   Use an absolute path like /var/data/book-reports`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate only critical environment variables that would cause immediate failures
 * Returns true if critical vars are present, throws if missing in production
 */
export function validateCriticalEnvironmentVariables(): void {
  const criticalVars = [
    { name: "DATABASE_URL", description: "Database connection string" },
    { name: "NEXT_PUBLIC_APP_URL", description: "Public URL of the application" },
  ];

  const missing: string[] = [];
  for (const config of criticalVars) {
    const value = process.env[config.name];
    if (!value || value.trim() === "") {
      missing.push(`${config.name} - ${config.description}`);
    }
  }

  if (missing.length > 0) {
    console.error("\n🚨 Missing Critical Environment Variables:\n");
    missing.forEach((varName) => console.error(`❌ ${varName}`));
    console.error(
      "\n💡 Tip: Set these variables in your Render dashboard or .env file\n"
    );

    // In production, throw error to prevent app from starting
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing critical environment variables: ${missing.map(m => m.split(' - ')[0]).join(', ')}`
      );
    }
  }
}

/**
 * Validate and log environment variables at startup
 * Call this in your app initialization
 * This logs warnings but doesn't throw (except for critical vars)
 */
export function validateAndLogEnvironment(): void {
  const result = validateEnvironmentVariables({
    skipInDevelopment: false, // Always validate, but be lenient in dev
  });

  if (result.errors.length > 0) {
    console.warn("\n⚠️  Environment Variable Issues (non-critical):\n");
    result.errors.forEach((error) => console.warn(error));
    console.warn(
      "\n💡 Tip: Set these variables in your Render dashboard or .env file\n"
    );
    // Don't throw - these are warnings, not critical failures
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Environment Variable Warnings:\n");
    result.warnings.forEach((warning) => console.warn(warning));
    console.warn("");
  }

  if (result.isValid && result.warnings.length === 0 && result.errors.length === 0) {
    console.log("✅ Environment variables validated successfully\n");
  }
}

/**
 * Validate a specific environment variable is set
 * Useful for runtime checks in API routes
 * @param varName - Name of the environment variable
 * @param description - Description of what the variable is for
 * @returns The value of the environment variable, or throws if missing
 */
export function requireEnv(varName: string, description?: string): string {
  const value = process.env[varName];
  if (!value || value.trim() === "") {
    const errorMessage = description
      ? `Missing required environment variable: ${varName}. ${description}`
      : `Missing required environment variable: ${varName}`;
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * Get an environment variable with a fallback, but warn if using fallback in production
 * @param varName - Name of the environment variable
 * @param fallback - Fallback value to use if not set
 * @param description - Description of what the variable is for
 * @returns The environment variable value or fallback
 */
export function getEnvWithFallback(
  varName: string,
  fallback: string,
  description?: string
): string {
  const value = process.env[varName];
  if (!value || value.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `⚠️  Using fallback for ${varName} in production. Consider setting this environment variable.`
      );
      if (description) {
        console.warn(`   ${description}`);
      }
    }
    return fallback;
  }
  return value;
}

