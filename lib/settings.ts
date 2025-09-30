import { prisma } from '@/lib/prisma';

/**
 * Get a setting value from the database with fallback to environment variable
 * @param key - The setting key (e.g., 'IDEOGRAM_API_KEY')
 * @param fallbackEnvKey - Optional environment variable key to fall back to
 * @returns The setting value or null if not found
 */
export async function getSetting(key: string, fallbackEnvKey?: string): Promise<string | null> {
  try {
    // First try to get from database
    const setting = await prisma.settings.findUnique({
      where: { 
        key,
        isActive: true
      }
    });

    if (setting?.value) {
      return setting.value;
    }

    // Fallback to environment variable if provided
    if (fallbackEnvKey) {
      return process.env[fallbackEnvKey] || null;
    }

    // Fallback to the key itself as env var
    return process.env[key] || null;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    
    // On error, fallback to environment variable
    if (fallbackEnvKey) {
      return process.env[fallbackEnvKey] || null;
    }
    return process.env[key] || null;
  }
}

/**
 * Set a setting value in the database
 * @param key - The setting key
 * @param value - The setting value
 * @param category - The setting category (default: 'API')
 * @returns The created/updated setting
 */
export async function setSetting(key: string, value: string, category: string = 'API') {
  return await prisma.settings.upsert({
    where: { key },
    update: { 
      value, 
      category,
      isActive: true,
      updatedAt: new Date()
    },
    create: { 
      key, 
      value, 
      category,
      isActive: true
    }
  });
}

/**
 * Get multiple settings at once
 * @param keys - Array of setting keys to retrieve
 * @returns Object with key-value pairs
 */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  try {
    const settings = await prisma.settings.findMany({
      where: {
        key: { in: keys },
        isActive: true
      }
    });

    const result: Record<string, string | null> = {};
    
    for (const key of keys) {
      const setting = settings.find(s => s.key === key);
      result[key] = setting?.value || process.env[key] || null;
    }

    return result;
  } catch (error) {
    console.error('Error fetching multiple settings:', error);
    
    // Fallback to environment variables
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = process.env[key] || null;
    }
    return result;
  }
}