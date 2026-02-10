import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';

export const authRouter = Router();
const userService = new UserService();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await userService.authenticate(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await userService.createUser(email, password, firstName, lastName, role || 'viewer');
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});
