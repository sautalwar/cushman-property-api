import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { CreateUserDto, LoginDto, User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export class UserService {
  async register(dto: CreateUserDto): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const existing = await query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (existing.rows.length > 0) {
      throw new Error('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
      [dto.email, passwordHash, dto.role]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user };
  }

  async login(dto: LoginDto): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const result = await query('SELECT * FROM users WHERE email = $1', [dto.email]);
    if (result.rows.length === 0) throw new Error('Invalid credentials');
    const user = result.rows[0];
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials');
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user: { id: user.id, email: user.email, role: user.role, createdAt: user.created_at } };
  }
}