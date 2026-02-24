import { Router, Request, Response } from 'express';
import { PropertyService } from '../services/PropertyService';

export const propertyRouter = Router();
const propertyService = new PropertyService();

// VULN-5: limit param used directly with no cap
propertyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 20; // VULN-5: no max enforced
    const offset = parseInt(req.query.offset as string) || 0;
    const properties = await propertyService.getAllProperties(ownerId, limit, offset);
    const total = await propertyService.countProperties(ownerId);
    res.json({ data: properties, count: properties.length, total, limit, offset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve properties' });
  }
});

// VULN-8: search term passed to SQL string concatenation
propertyRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'Search term required' }) as any;
    const properties = await propertyService.searchProperties(q);
    res.json({ data: properties, count: properties.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

propertyRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const property = await propertyService.getPropertyById(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' }) as any;
    res.json({ data: property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve property' });
  }
});

propertyRouter.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const property = await propertyService.createProperty(req.body, ownerId);
    res.status(201).json({ data: property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create property' });
  }
});