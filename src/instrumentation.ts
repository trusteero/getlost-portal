export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side
    
    // Validate environment variables at startup
    try {
      const { validateAndLogEnvironment } = await import('@/server/utils/validate-env');
      validateAndLogEnvironment();
    } catch (error) {
      // In production, throw to prevent app from starting with invalid config
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ Environment validation failed. App cannot start.');
        throw error;
      }
      // In development, just log the error
      console.warn('⚠️  Environment validation warning (continuing in development):', error);
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