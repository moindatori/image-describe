import { prisma } from './prisma';
import { CreditTransactionType } from '@prisma/client';

/**
 * Custom error classes for better error handling
 */
export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public available: number,
    message?: string
  ) {
    super(message || `Insufficient credits. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export class CreditTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditTransactionError';
  }
}

/**
 * Interface for credit transaction results
 */
export interface CreditTransactionResult {
  success: boolean;
  newBalance: number;
  transactionId: string;
  error?: string;
}

/**
 * Interface for credit validation results
 */
export interface CreditValidationResult {
  isValid: boolean;
  available: number;
  required: number;
  deficit?: number;
}

/**
 * CreditManager class following OOP principles
 * Handles all credit-related operations with proper validation and error handling
 */
export class CreditManager {
  private userId: string;
  private currentBalance: number | null = null;
  private lastUpdated: Date | null = null;
  private readonly CACHE_DURATION_MS = 5000; // 5 seconds cache

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get current user credit balance with caching
   */
  async getCurrentBalance(forceRefresh: boolean = false): Promise<number> {
    const now = new Date();
    
    // Use cached balance if available and not expired
    if (
      !forceRefresh &&
      this.currentBalance !== null &&
      this.lastUpdated &&
      (now.getTime() - this.lastUpdated.getTime()) < this.CACHE_DURATION_MS
    ) {
      return this.currentBalance;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { credits: true }
      });

      if (!user) {
        throw new UserNotFoundError(this.userId);
      }

      this.currentBalance = user.credits;
      this.lastUpdated = now;
      
      return this.currentBalance;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      throw new CreditTransactionError(`Failed to fetch user balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if user has sufficient credits
   */
  async validateCredits(requiredCredits: number): Promise<CreditValidationResult> {
    const available = await this.getCurrentBalance();
    const isValid = available >= requiredCredits;
    
    return {
      isValid,
      available,
      required: requiredCredits,
      deficit: isValid ? undefined : requiredCredits - available
    };
  }

  /**
   * Check if user can afford a specific number of credits
   */
  async canAfford(credits: number): Promise<boolean> {
    const validation = await this.validateCredits(credits);
    return validation.isValid;
  }

  /**
   * Deduct credits with atomic transaction
   */
  async deductCredits(
    amount: number,
    description?: string,
    transactionType: CreditTransactionType = CreditTransactionType.IMAGE_DESCRIPTION
  ): Promise<CreditTransactionResult> {
    if (amount <= 0) {
      throw new CreditTransactionError('Credit amount must be positive');
    }

    try {
      // Validate credits before deduction
      const validation = await this.validateCredits(amount);
      if (!validation.isValid) {
        throw new InsufficientCreditsError(amount, validation.available);
      }

      // Perform atomic transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get current user with lock
        const user = await tx.user.findUnique({
          where: { id: this.userId },
          select: { credits: true }
        });

        if (!user) {
          throw new UserNotFoundError(this.userId);
        }

        // Double-check credits in transaction
        if (user.credits < amount) {
          throw new InsufficientCreditsError(amount, user.credits);
        }

        // Update user credits
        const updatedUser = await tx.user.update({
          where: { id: this.userId },
          data: { credits: user.credits - amount }
        });

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId: this.userId,
            amount: -amount,
            type: transactionType,
            description: description || `Deducted ${amount} credit(s)`
          }
        });

        return {
          newBalance: updatedUser.credits,
          transactionId: transaction.id
        };
      });

      // Update cache
      this.currentBalance = result.newBalance;
      this.lastUpdated = new Date();

      return {
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId
      };

    } catch (error) {
      if (error instanceof InsufficientCreditsError || error instanceof UserNotFoundError) {
        throw error;
      }
      
      return {
        success: false,
        newBalance: this.currentBalance || 0,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Add credits with atomic transaction
   */
  async addCredits(
    amount: number,
    description?: string,
    transactionType: CreditTransactionType = CreditTransactionType.ADMIN_ADJUSTMENT
  ): Promise<CreditTransactionResult> {
    if (amount <= 0) {
      throw new CreditTransactionError('Credit amount must be positive');
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current user
        const user = await tx.user.findUnique({
          where: { id: this.userId },
          select: { credits: true }
        });

        if (!user) {
          throw new UserNotFoundError(this.userId);
        }

        // Update user credits
        const updatedUser = await tx.user.update({
          where: { id: this.userId },
          data: { credits: user.credits + amount }
        });

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId: this.userId,
            amount: amount,
            type: transactionType,
            description: description || `Added ${amount} credit(s)`
          }
        });

        return {
          newBalance: updatedUser.credits,
          transactionId: transaction.id
        };
      });

      // Update cache
      this.currentBalance = result.newBalance;
      this.lastUpdated = new Date();

      return {
        success: true,
        newBalance: result.newBalance,
        transactionId: result.transactionId
      };

    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw error;
      }
      
      return {
        success: false,
        newBalance: this.currentBalance || 0,
        transactionId: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get credit transaction history
   */
  async getTransactionHistory(limit: number = 50): Promise<any[]> {
    try {
      const transactions = await prisma.creditTransaction.findMany({
        where: { userId: this.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true
        }
      });

      return transactions;
    } catch (error) {
      throw new CreditTransactionError(`Failed to fetch transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cache (useful for testing or when external changes occur)
   */
  clearCache(): void {
    this.currentBalance = null;
    this.lastUpdated = null;
  }

  /**
   * Static method to create a CreditManager instance
   */
  static create(userId: string): CreditManager {
    return new CreditManager(userId);
  }

  /**
   * Static method to validate credits for multiple users
   */
  static async validateMultipleUsers(userCredits: Array<{ userId: string; requiredCredits: number }>): Promise<Array<{ userId: string; validation: CreditValidationResult }>> {
    const results = await Promise.all(
      userCredits.map(async ({ userId, requiredCredits }) => {
        const manager = new CreditManager(userId);
        const validation = await manager.validateCredits(requiredCredits);
        return { userId, validation };
      })
    );

    return results;
  }
}

/**
 * Utility functions for backward compatibility
 */
export async function getCurrentUserCredits(userId: string): Promise<number> {
  const manager = new CreditManager(userId);
  return manager.getCurrentBalance();
}

export async function deductUserCredits(
  userId: string,
  amount: number,
  description?: string
): Promise<CreditTransactionResult> {
  const manager = new CreditManager(userId);
  return manager.deductCredits(amount, description);
}

export async function validateUserCredits(
  userId: string,
  requiredCredits: number
): Promise<CreditValidationResult> {
  const manager = new CreditManager(userId);
  return manager.validateCredits(requiredCredits);
}