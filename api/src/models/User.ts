export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'property_owner' | 'contractor';
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  role: 'property_owner' | 'contractor';
}

export interface LoginDto {
  email: string;
  password: string;
}