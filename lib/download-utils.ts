// Utility functions for downloading image descriptions as TXT files

export interface DescriptionData {
  filename: string;
  description: string;
  confidence?: number;
  timestamp?: string;
  source?: string;
}

/**
 * Generate TXT content for a single image description
 */
export function generateSingleDescriptionTXT(data: DescriptionData): string {
  // Simple format: just the description
  return data.description;
}

/**
 * Generate TXT content for multiple image descriptions
 */
export function generateBulkDescriptionsTXT(descriptions: DescriptionData[]): string {
  // Format with blank line between each description for better readability
  return descriptions.map(data => data.description).join('\n\n');
}

/**
 * Download text content as a TXT file
 */
export function downloadTXTFile(content: string, filename: string): void {
  // Create a blob with the text content
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  
  // Create a temporary URL for the blob
  const url = URL.createObjectURL(blob);
  
  // Create a temporary anchor element and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Generate a safe filename from image name
 */
export function generateSafeFilename(originalName: string, suffix?: string): string {
  // Remove file extension and special characters
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  
  if (suffix) {
    return `${baseName}_${suffix}_${timestamp}`;
  }
  
  return `${baseName}_description_${timestamp}`;
}

/**
 * Download single image description as TXT
 */
export function downloadSingleDescription(data: DescriptionData): void {
  const content = generateSingleDescriptionTXT(data);
  const filename = generateSafeFilename(data.filename, 'description');
  downloadTXTFile(content, filename);
}

/**
 * Download multiple image descriptions as a single TXT file
 */
export function downloadBulkDescriptions(descriptions: DescriptionData[], filename?: string): void {
  const content = generateBulkDescriptionsTXT(descriptions);
  const defaultFilename = filename || `bulk_descriptions_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}`;
  downloadTXTFile(content, defaultFilename);
}