import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const TOKEN_EXPIRY = '24h';

export class UserService {

  async authenticate(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const sql = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await query(sql, [email]);
    const user = result.rows[0] as User | undefined;

    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return { user, token };
  }

  async createUser(email: string, password: string, firstName: string, 
                   lastName: string, role: 'admin' | 'manager' | 'viewer'): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 12);
    const sql = `
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await query(sql, [email, passwordHash, firstName, lastName, role]);
    return result.rows[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
}
