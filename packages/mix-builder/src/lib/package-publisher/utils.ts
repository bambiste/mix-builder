import { ArgParserConfig } from '../arguments/index.js';

/**
 * Configuration for parsing publish command arguments
 * Mirrors the properties defined in publish-config.schema.json
 */
export const PUBLISH_PROPS_CONFIG: ArgParserConfig[] = [
  {
    key: 'packages',
    type: 'array',
  },
  {
    key: 'excluded',
    type: 'array',
  },
  {
    key: 'excluded_packages',
    type: 'array',
  },
  {
    key: 'buildConfigFile',
    type: 'string',
  },
  {
    key: 'global_build',
    type: 'boolean',
  },
  {
    key: 'package_build',
    type: 'boolean',
  },
  {
    key: 'type',
    type: 'string',
  },
  {
    key: 'tag',
    type: 'string',
  },
  {
    key: 'version',
    type: 'string',
  },
  {
    key: 'suffix',
    type: 'string',
  },
  {
    key: 'registry',
    type: 'string',
  },
  {
    key: 'content',
    type: 'string',
    defaultValue: './packages/**/package.json',
  },
  {
    key: 'packages_dir',
    type: 'string',
    defaultValue: 'packages',
  },
  {
    key: 'basePath',
    type: 'string',
  },
  {
    key: 'access',
    type: 'string',
    defaultValue: 'restricted',
  },
  {
    key: 'dryRun',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'skipBuild',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'testMode',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'scoped',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'timeout',
    type: 'number',
    defaultValue: 300000,
  },
];

/**
 * Deep merge utility that properly handles objects, arrays, and symbols
 * @param objects - Objects to merge (later objects override earlier ones)
 * @returns Merged object
 */
export const merge = <T extends Record<string, any>>(
  ...objects: Partial<T>[]
): T => {
  const result: any = {};

  for (const obj of objects) {
    // Skip null, undefined, or non-object values
    if (!obj || typeof obj !== 'object') continue;

    // Handle regular properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const existing = result[key];

        // Skip undefined values
        if (value === undefined) continue;

        // Merge arrays by concatenating (and removing duplicates for unique arrays)
        if (Array.isArray(value) && Array.isArray(existing)) {
          result[key] = [...existing, ...value];
        }
        // Deep merge objects
        else if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          existing &&
          typeof existing === 'object' &&
          !Array.isArray(existing)
        ) {
          result[key] = merge(existing, value);
        }
        // Override with new value (including null, false, empty string, 0)
        else {
          result[key] = value;
        }
      }
    }

    // Handle symbols
    const symbols = Object.getOwnPropertySymbols(obj);
    for (const symbol of symbols) {
      const value = (obj as any)[symbol];
      const existing = result[symbol];

      // Skip undefined values
      if (value === undefined) continue;

      if (Array.isArray(value) && Array.isArray(existing)) {
        result[symbol] = [...existing, ...value];
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        result[symbol] = merge(existing, value);
      } else {
        result[symbol] = value;
      }
    }
  }

  return result as T;
};

/**
 * Removes duplicate values from an array
 * @param arr - Array to deduplicate
 * @returns Array with unique values
 */
export const unique = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};

/**
 * Validates that a value matches expected type
 * @param value - Value to validate
 * @param expectedType - Expected type name
 * @returns True if valid
 */
export const validateType = (value: any, expectedType: string): boolean => {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' && !Array.isArray(value) && value !== null
      );
    default:
      return false;
  }
};
