import { Router, Request, Response } from 'express';
import { TenantService } from '../services/TenantService';

export const tenantRouter = Router();
const tenantService = new TenantService();

// GET /api/tenants/property/:propertyId — list tenants for a property
tenantRouter.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const tenants = await tenantService.getTenantsByProperty(req.params.propertyId);
    res.json({ data: tenants, count: tenants.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tenants' });
  }
});

// POST /api/tenants — create a new tenant
tenantRouter.post('/', async (req: Request, res: Response) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json({ data: tenant });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// GET /api/tenants/expiring — get leases expiring soon
tenantRouter.get('/expiring', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const tenants = await tenantService.getExpiringLeases(days);
    res.json({ data: tenants, count: tenants.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve expiring leases' });
  }
});

// PATCH /api/tenants/:id/deactivate — deactivate a tenant
tenantRouter.patch('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    await tenantService.deactivateTenant(req.params.id);
    res.json({ message: 'Tenant deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate tenant' });
  }
});
