import { describe, it, expect } from 'vitest';
import { suffixFromEnvFile, pkgToken, secretNameFor } from './core.js';

describe('suffixFromEnvFile', () => {
  it('derives the suffix from an env file name', () => {
    expect(suffixFromEnvFile('.env')).toBe('DEFAULT');
    expect(suffixFromEnvFile('.env.prod')).toBe('PROD');
    expect(suffixFromEnvFile('.env.dev')).toBe('DEV');
    expect(suffixFromEnvFile('.env.staging')).toBe('STAGING');
  });

  it('uses only the base name', () => {
    expect(suffixFromEnvFile('packages/app/.env.prod')).toBe('PROD');
  });
});

describe('pkgToken', () => {
  it('uppercases and sanitizes the directory name', () => {
    expect(pkgToken('packages/backend')).toBe('BACKEND');
    expect(pkgToken('packages/store-admin')).toBe('STORE_ADMIN');
    expect(pkgToken('packages/medusa-qr')).toBe('MEDUSA_QR');
  });
});

describe('secretNameFor', () => {
  it('combines package token and env suffix (push/pull contract)', () => {
    expect(secretNameFor('packages/backend', '.env.prod')).toBe('BACKEND_ENV_PROD');
    expect(secretNameFor('packages/store-admin', '.env.prod')).toBe('STORE_ADMIN_ENV_PROD');
    expect(secretNameFor('packages/storefront', '.env.dev')).toBe('STOREFRONT_ENV_DEV');
    expect(secretNameFor('packages/pos', '.env')).toBe('POS_ENV_DEFAULT');
  });
});
