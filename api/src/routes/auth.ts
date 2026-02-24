import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';

export const authRouter = Router();
const userService = new UserService();

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const result = await userService.register(req.body);
    res.status(201).json({ data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const result = await userService.login(req.body);
    res.json({ data: result });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});