export interface PasswordError {
  message: string;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): PasswordError | null {
  if (!password) return { message: 'Password is required.' };
  if (password.length < 8) return { message: 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password)) return { message: 'Password must contain at least one uppercase letter.' };
  if (!/[0-9]/.test(password)) return { message: 'Password must contain at least one number.' };
  return null;
}
