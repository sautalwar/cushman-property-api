import { Router, Request, Response } from 'express';
import { PropertyService } from '../services/PropertyService';

export const propertyRouter = Router();
const propertyService = new PropertyService();

// GET /api/properties — list all properties for the authenticated user
propertyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const properties = await propertyService.getAllProperties(ownerId);
    res.json({ data: properties, count: properties.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve properties' });
  }
});

// GET /api/properties/search?q=term — search properties (VULNERABLE to SQL injection)
propertyRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }
    const properties = await propertyService.searchProperties(searchTerm);
    res.json({ data: properties, count: properties.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/properties/:id — get a single property
propertyRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const property = await propertyService.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ data: property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve property' });
  }
});

// POST /api/properties — create a new property
propertyRouter.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const property = await propertyService.createProperty(req.body, ownerId);
    res.status(201).json({ data: property });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// GET /api/properties/portfolio/summary — get portfolio summary
propertyRouter.get('/portfolio/summary', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const summary = await propertyService.getPortfolioSummary(ownerId);
    res.json({ data: summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve portfolio summary' });
  }
});

// PATCH /api/properties/:id/occupancy — update occupancy rate (VULNERABLE)
propertyRouter.patch('/:id/occupancy', async (req: Request, res: Response) => {
  try {
    await propertyService.updateOccupancy(req.params.id, req.body.rate);
    res.json({ message: 'Occupancy updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update occupancy' });
  }
});

// DELETE /api/properties/:id — delete a property
propertyRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const deleted = await propertyService.deleteProperty(req.params.id, ownerId);
    if (!deleted) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ message: 'Property deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete property' });
  }
});
