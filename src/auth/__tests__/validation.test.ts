import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, type PasswordError } from '../validation';

describe('validateEmail', () => {
  it('accepts a well-formed email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(validateEmail('')).toBe('Email is required.');
  });

  it('rejects missing @', () => {
    expect(validateEmail('notanemail')).toBe('Enter a valid email address.');
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe('Enter a valid email address.');
  });

  it('rejects missing local part', () => {
    expect(validateEmail('@example.com')).toBe('Enter a valid email address.');
  });
});

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    const result = validatePassword('Str0ng!pass');
    expect(result).toBeNull();
  });

  it('rejects empty password', () => {
    const result = validatePassword('') as PasswordError;
    expect(result).not.toBeNull();
    expect(result.message).toBe('Password is required.');
  });

  it('rejects password shorter than 8 characters', () => {
    const result = validatePassword('Ab1!') as PasswordError;
    expect(result).not.toBeNull();
    expect(result.message).toMatch(/at least 8 characters/i);
  });

  it('rejects password with no uppercase letter', () => {
    const result = validatePassword('alllower1!') as PasswordError;
    expect(result).not.toBeNull();
    expect(result.message).toMatch(/uppercase/i);
  });

  it('rejects password with no digit', () => {
    const result = validatePassword('NoDigits!') as PasswordError;
    expect(result).not.toBeNull();
    expect(result.message).toMatch(/number/i);
  });
});
