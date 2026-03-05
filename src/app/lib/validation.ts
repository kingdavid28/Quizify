/**
 * Input validation utilities for production-ready app
 */

export interface ValidationError {
  field: string;
  message: string;
}

export const validators = {
  /**
   * Validate email format
   */
  email: (email: string): ValidationError | null => {
    if (!email || email.trim().length === 0) {
      return { field: 'email', message: 'Email is required' };
    }
    if (email.length > 255) {
      return { field: 'email', message: 'Email is too long' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { field: 'email', message: 'Invalid email format' };
    }
    return null;
  },

  /**
   * Validate password strength
   */
  password: (password: string): ValidationError | null => {
    if (!password || password.length === 0) {
      return { field: 'password', message: 'Password is required' };
    }
    if (password.length < 8) {
      return { field: 'password', message: 'Password must be at least 8 characters' };
    }
    if (password.length > 128) {
      return { field: 'password', message: 'Password is too long' };
    }
    return null;
  },

  /**
   * Validate name field
   */
  name: (name: string): ValidationError | null => {
    if (!name || name.trim().length === 0) {
      return { field: 'name', message: 'Name is required' };
    }
    if (name.length > 255) {
      return { field: 'name', message: 'Name is too long' };
    }
    if (name.length < 2) {
      return { field: 'name', message: 'Name must be at least 2 characters' };
    }
    return null;
  },

  /**
   * Validate quiz title
   */
  quizTitle: (title: string): ValidationError | null => {
    if (!title || title.trim().length === 0) {
      return { field: 'title', message: 'Quiz title is required' };
    }
    if (title.length > 255) {
      return { field: 'title', message: 'Title is too long' };
    }
    if (title.length < 3) {
      return { field: 'title', message: 'Title must be at least 3 characters' };
    }
    return null;
  },

  /**
   * Validate question text
   */
  question: (question: string): ValidationError | null => {
    if (!question || question.trim().length === 0) {
      return { field: 'question', message: 'Question is required' };
    }
    if (question.length > 1000) {
      return { field: 'question', message: 'Question is too long' };
    }
    if (question.length < 5) {
      return { field: 'question', message: 'Question must be at least 5 characters' };
    }
    return null;
  },

  /**
   * Validate quiz options
   */
  options: (options: string[]): ValidationError | null => {
    if (!options || options.length < 2) {
      return { field: 'options', message: 'At least 2 options are required' };
    }
    if (options.length > 10) {
      return { field: 'options', message: 'Maximum 10 options allowed' };
    }
    for (const option of options) {
      if (!option || option.trim().length === 0) {
        return { field: 'options', message: 'All options must be non-empty' };
      }
      if (option.length > 500) {
        return { field: 'options', message: 'Option text is too long' };
      }
    }
    return null;
  },
};

/**
 * Validate login form
 */
export const validateLoginForm = (
  email: string,
  password: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validators.email(email);
  if (emailError) errors.push(emailError);

  const passwordError = validators.password(password);
  if (passwordError) errors.push(passwordError);

  return errors;
};

/**
 * Validate signup form
 */
export const validateSignupForm = (
  email: string,
  password: string,
  name: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validators.email(email);
  if (emailError) errors.push(emailError);

  const passwordError = validators.password(password);
  if (passwordError) errors.push(passwordError);

  const nameError = validators.name(name);
  if (nameError) errors.push(nameError);

  return errors;
};
