/**
 * Password hashing module using bcrypt-compatible hashing
 * For production with Deno, use a proper bcrypt library
 */

// For Deno, we recommend using: import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
// This is a simplified version - replace with actual bcrypt in production

import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/**
 * Hash a password using a simplified method
 * NOTE: In production, use proper bcrypt library
 * For Deno: import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
 */
export const hashPassword = async (password: string): Promise<string> => {
  // This is a simplified hashing approach for demo
  // In production, use: return bcrypt.hash(password);
  
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const passwordBytes = encoder.encode(password + saltStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashStr = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return salt + hash
  return `${saltStr}$${hashStr}`;
};

/**
 * Verify a password against a hash
 * NOTE: In production, use proper bcrypt library
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // This is a simplified verification approach
  // In production, use: return bcrypt.compare(password, hash);
  
  const [salt, hashStr] = hash.split('$');
  if (!salt || !hashStr) return false;
  
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === hashStr;
};

/**
 * Generate a secure random password for temporary use
 */
export const generateSecurePassword = (): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const length = 16;
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
};

/**
 * Check password strength
 */
export const checkPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // Feedback
  if (password.length < 8) feedback.push('Password should be at least 8 characters');
  if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Add numbers');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Add special characters for extra strength');
  }

  return {
    score: Math.min(score, 7),
    feedback,
    isStrong: score >= 5,
  };
};
