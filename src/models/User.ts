export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'viewer';
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date | null;
}
