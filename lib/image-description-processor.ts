import { CreditManager, InsufficientCreditsError, CreditTransactionResult } from './credit-manager';
import { getSetting } from './settings';
import { prisma } from './prisma';
import { CreditTransactionType } from '@prisma/client';

/**
 * Interface for image processing results
 */
export interface ImageProcessResult {
  success: boolean;
  imageId?: string;
  filename: string;
  description?: string;
  confidence?: number;
  source?: string;
  error?: string;
  index: number;
  remainingCredits?: number;
  creditTransaction?: CreditTransactionResult;
}

/**
 * Interface for processing progress updates
 */
export interface ProcessingProgress {
  type: 'started' | 'processing' | 'completed' | 'error' | 'credit_check' | 'stopped';
  index: number;
  total: number;
  result?: ImageProcessResult;
  message?: string;
  remainingCredits?: number;
}

/**
 * Interface for processing summary
 */
export interface ProcessingSummary {
  total: number;
  successful: number;
  failed: number;
  stoppedDueToCredits: boolean;
  creditsUsed: number;
  remainingCredits: number;
  results: ImageProcessResult[];
}

/**
 * Configuration for image processing
 */
export interface ProcessingConfig {
  checkCreditsBeforeEach: boolean;
  stopOnInsufficientCredits: boolean;
  maxFileSize: number;
  allowedMimeTypes: string[];
  apiTimeout: number;
}

/**
 * ImageDescriptionProcessor class following OOP principles
 * Handles bulk image processing with credit validation after each image
 */
export class ImageDescriptionProcessor {
  private creditManager: CreditManager;
  private userId: string;
  private config: ProcessingConfig;
  private isProcessing: boolean = false;
  private shouldStop: boolean = false;

  // Default configuration
  private static readonly DEFAULT_CONFIG: ProcessingConfig = {
    checkCreditsBeforeEach: true,
    stopOnInsufficientCredits: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    apiTimeout: 15000 // 15 seconds
  };

  constructor(userId: string, config?: Partial<ProcessingConfig>) {
    this.userId = userId;
    this.creditManager = new CreditManager(userId);
    this.config = { ...ImageDescriptionProcessor.DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate a single file
   */
  private validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type: ${file.type}. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`
      };
    }

    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        isValid: false,
        error: `File size too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${(this.config.maxFileSize / 1024 / 1024).toFixed(2)}MB`
      };
    }

    return { isValid: true };
  }

  /**
   * Process a single image with credit validation
   */
  private async processSingleImage(
    file: File,
    index: number,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ImageProcessResult> {
    const baseResult: ImageProcessResult = {
      success: false,
      filename: file.name,
      index,
      remainingCredits: await this.creditManager.getCurrentBalance()
    };

    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          ...baseResult,
          error: validation.error
        };
      }

      // Check credits before processing if enabled
      if (this.config.checkCreditsBeforeEach) {
        onProgress?.({
          type: 'credit_check',
          index,
          total: 0,
          message: 'Checking credits...',
          remainingCredits: baseResult.remainingCredits
        });

        const canAfford = await this.creditManager.canAfford(1);
        if (!canAfford) {
          const currentBalance = await this.creditManager.getCurrentBalance();
          return {
            ...baseResult,
            error: `Insufficient credits. Current balance: ${currentBalance}`,
            remainingCredits: currentBalance
          };
        }
      }

      // Process the image
      onProgress?.({
        type: 'processing',
        index,
        total: 0,
        message: `Processing ${file.name}...`
      });

      const description = await this.callImageDescriptionAPI(file);

      // Deduct credits after successful processing
      let creditTransaction: CreditTransactionResult;
      try {
        creditTransaction = await this.creditManager.deductCredits(
          1,
          `Image description for ${file.name}`,
          CreditTransactionType.IMAGE_DESCRIPTION
        );
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return {
            ...baseResult,
            error: `Credits exhausted during processing. ${error.message}`,
            remainingCredits: error.available
          };
        }
        throw error;
      }

      // Save to database
      const imageDescription = await prisma.imageDescription.create({
        data: {
          userId: this.userId,
          filename: file.name,
          description: description.description,
          confidence: description.confidence,
          source: description.source,
          fileSize: file.size,
          mimeType: file.type
        }
      });

      return {
        success: true,
        imageId: imageDescription.id,
        filename: file.name,
        description: description.description,
        confidence: description.confidence,
        source: description.source,
        index,
        remainingCredits: creditTransaction.newBalance,
        creditTransaction
      };

    } catch (error) {
      console.error(`Error processing image ${file.name}:`, error);
      return {
        ...baseResult,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Call the image description API
   */
  private async callImageDescriptionAPI(file: File): Promise<{
    description: string;
    confidence: number;
    source: string;
  }> {
    const IDEOGRAM_API_KEY = await getSetting('IDEOGRAM_API_KEY', 'IDEOGRAM_API_KEY');
    const IDEOGRAM_API_URL = 'https://api.ideogram.ai/describe';

    if (IDEOGRAM_API_KEY) {
      try {
        const formData = new FormData();
        formData.append('image_file', file);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);

        const response = await fetch(IDEOGRAM_API_URL, {
          method: 'POST',
          headers: {
            'Api-Key': IDEOGRAM_API_KEY,
          },
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const responseText = await response.text();
          
          if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            const result = JSON.parse(responseText);
            return {
              description: result.descriptions?.[0]?.text || result.description || 'No description available',
              confidence: 95,
              source: 'ideogram'
            };
          } else {
            throw new Error('Invalid response format from Ideogram API');
          }
        } else {
          throw new Error(`Ideogram API error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Ideogram API error:', error);
        // Throw the error instead of using fallback description
        throw new Error(`Failed to describe image: ${error instanceof Error ? error.message : 'Unknown API error'}`);
      }
    }

    // Throw error if no API key is available
    throw new Error('Image description service is not available - API key not configured');
  }

  /**
   * Process multiple images with credit checking
   */
  async processImages(
    files: File[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingSummary> {
    if (this.isProcessing) {
      throw new Error('Processing is already in progress');
    }

    this.isProcessing = true;
    this.shouldStop = false;

    const results: ImageProcessResult[] = [];
    let successful = 0;
    let failed = 0;
    let creditsUsed = 0;
    let stoppedDueToCredits = false;

    try {
      // Initial credit check
      const initialBalance = await this.creditManager.getCurrentBalance();
      
      onProgress?.({
        type: 'started',
        index: 0,
        total: files.length,
        message: `Starting processing of ${files.length} images`,
        remainingCredits: initialBalance
      });

      // Process each file
      for (let i = 0; i < files.length; i++) {
        if (this.shouldStop) {
          break;
        }

        const file = files[i];
        
        // Check credits before processing if enabled
        if (this.config.checkCreditsBeforeEach && this.config.stopOnInsufficientCredits) {
          const canAfford = await this.creditManager.canAfford(1);
          if (!canAfford) {
            stoppedDueToCredits = true;
            onProgress?.({
              type: 'stopped',
              index: i,
              total: files.length,
              message: 'Processing stopped due to insufficient credits',
              remainingCredits: await this.creditManager.getCurrentBalance()
            });
            break;
          }
        }

        const result = await this.processSingleImage(file, i, onProgress);
        results.push(result);

        if (result.success) {
          successful++;
          creditsUsed++;
        } else {
          failed++;
          
          // Check if we should stop due to credit issues
          if (this.config.stopOnInsufficientCredits && 
              result.error?.includes('Insufficient credits')) {
            stoppedDueToCredits = true;
            onProgress?.({
              type: 'stopped',
              index: i,
              total: files.length,
              message: 'Processing stopped due to insufficient credits',
              remainingCredits: result.remainingCredits || 0
            });
            break;
          }
        }

        onProgress?.({
          type: 'completed',
          index: i + 1,
          total: files.length,
          result,
          remainingCredits: result.remainingCredits
        });
      }

      const finalBalance = await this.creditManager.getCurrentBalance();

      return {
        total: files.length,
        successful,
        failed,
        stoppedDueToCredits,
        creditsUsed,
        remainingCredits: finalBalance,
        results
      };

    } catch (error) {
      onProgress?.({
        type: 'error',
        index: 0,
        total: files.length,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process images with streaming updates for Server-Sent Events
   */
  async processImagesWithStreaming(
    files: File[],
    onProgress: (update: any) => void,
    abortSignal?: AbortSignal
  ): Promise<ProcessingSummary> {
    if (this.isProcessing) {
      throw new Error('Processing is already in progress');
    }

    this.isProcessing = true;
    this.shouldStop = false;

    const results: ImageProcessResult[] = [];
    let successful = 0;
    let failed = 0;
    let creditsUsed = 0;
    let stoppedDueToCredits = false;

    try {
      // Initial credit check
      const initialBalance = await this.creditManager.getCurrentBalance();
      
      onProgress({
        type: 'progress',
        index: 0,
        total: files.length,
        message: `Starting processing of ${files.length} images`,
        remainingCredits: initialBalance
      });

      // Process each file
      for (let i = 0; i < files.length; i++) {
        // Check for abort signal
        if (abortSignal?.aborted || this.shouldStop) {
          break;
        }

        const file = files[i];
        
        // Send credit check update
        onProgress({
          type: 'credit_check',
          index: i,
          message: `Checking credits for ${file.name}`,
          remainingCredits: await this.creditManager.getCurrentBalance()
        });

        // Check credits before processing if enabled
        if (this.config.checkCreditsBeforeEach && this.config.stopOnInsufficientCredits) {
          const canAfford = await this.creditManager.canAfford(1);
          if (!canAfford) {
            stoppedDueToCredits = true;
            onProgress({
              type: 'stopped',
              message: 'Processing stopped due to insufficient credits',
              remainingCredits: await this.creditManager.getCurrentBalance(),
              summary: {
                total: files.length,
                successful,
                failed,
                creditsUsed,
                remainingCredits: await this.creditManager.getCurrentBalance(),
                stoppedDueToCredits: true
              }
            });
            break;
          }
        }

        // Send processing update
        onProgress({
          type: 'progress',
          index: i + 1,
          total: files.length,
          message: `Processing ${file.name}`,
          remainingCredits: await this.creditManager.getCurrentBalance()
        });

        const result = await this.processSingleImage(file, i);
        results.push(result);

        if (result.success) {
          successful++;
          creditsUsed++;
        } else {
          failed++;
          
          // Check if we should stop due to credit issues
          if (this.config.stopOnInsufficientCredits && 
              result.error?.includes('Insufficient credits')) {
            stoppedDueToCredits = true;
            onProgress({
              type: 'stopped',
              message: 'Processing stopped due to insufficient credits',
              remainingCredits: result.remainingCredits || 0,
              summary: {
                total: files.length,
                successful,
                failed,
                creditsUsed,
                remainingCredits: result.remainingCredits || 0,
                stoppedDueToCredits: true
              }
            });
            break;
          }
        }

        // Send result update
        onProgress({
          type: 'result',
          result
        });
      }

      const finalBalance = await this.creditManager.getCurrentBalance();
      const summary = {
        total: files.length,
        successful,
        failed,
        stoppedDueToCredits,
        creditsUsed,
        remainingCredits: finalBalance,
        results
      };

      // Send completion update
      onProgress({
        type: 'complete',
        summary
      });

      return summary;

    } catch (error) {
      onProgress({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Stop the current processing
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if processing is currently running
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current credit balance
   */
  async getCurrentCredits(): Promise<number> {
    return this.creditManager.getCurrentBalance();
  }

  /**
   * Validate if user can process a specific number of images
   */
  async canProcessImages(count: number): Promise<boolean> {
    return this.creditManager.canAfford(count);
  }

  /**
   * Get processing configuration
   */
  getConfig(): ProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update processing configuration
   */
  updateConfig(newConfig: Partial<ProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Static factory method
   */
  static create(userId: string, config?: Partial<ProcessingConfig>): ImageDescriptionProcessor {
    return new ImageDescriptionProcessor(userId, config);
  }
}