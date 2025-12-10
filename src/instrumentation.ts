export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side
    
    // Validate environment variables at startup
    // Only validate critical variables that would cause immediate failures
    try {
      const { validateCriticalEnvironmentVariables } = await import('@/server/utils/validate-env');
      validateCriticalEnvironmentVariables();
    } catch (error) {
      // In production, throw to prevent app from starting with invalid critical config
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Critical environment variables missing. App cannot start.');
        throw error;
      }
      // In development, just log the error
      console.warn('⚠️  Environment validation warning (continuing in development):', error);
    }

    // Log full environment validation (warnings only, don't throw)
    try {
      const { validateAndLogEnvironment } = await import('@/server/utils/validate-env');
      validateAndLogEnvironment();
    } catch (error) {
      // Don't throw - just log warnings
      console.warn('⚠️  Environment validation warnings (non-critical):', error);
    }

    // Initialize database
    const { initializeDatabase } = await import('@/server/db/init');

    try {
      await initializeDatabase();
    } catch (error) {
      console.error('Failed to initialize database on startup:', error);
      // Don't throw here to allow the server to start even if DB init fails
      // The error will be caught when first trying to use the DB
    }
  }
}