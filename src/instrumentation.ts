export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side
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