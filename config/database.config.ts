// src/config/database.config.ts

import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  transactionTimeout: number;
  maxWait: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/project_service',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  transactionTimeout: parseInt(process.env.DB_TRANSACTION_TIMEOUT || '10000', 10),
  maxWait: parseInt(process.env.DB_MAX_WAIT || '5000', 10),
}));