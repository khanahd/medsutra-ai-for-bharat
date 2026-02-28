import { AppDataSource } from '../config/database';
import { logger } from './logger';

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database connection...');
    await AppDataSource.initialize();
    logger.info('Database connection established successfully');

    // Run migrations
    logger.info('Running database migrations...');
    await AppDataSource.runMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}
