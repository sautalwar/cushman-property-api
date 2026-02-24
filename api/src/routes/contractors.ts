import { Router, Request, Response } from 'express';
import { ContractorService } from '../services/ContractorService';

export const contractorRouter = Router();
const contractorService = new ContractorService();

contractorRouter.get('/', async (req: Request, res: Response) => {
  try {
    const specialty = req.query.specialty as string | undefined;
    const contractors = await contractorService.getAllContractors(specialty);
    res.json({ data: contractors, count: contractors.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve contractors' });
  }
});

contractorRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const contractor = await contractorService.getContractorById(req.params.id);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' }) as any;
    res.json({ data: contractor });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve contractor' });
  }
});

contractorRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const contractor = await contractorService.createContractor(req.body, userId);
    res.status(201).json({ data: contractor });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create contractor profile' });
  }
});

// VULN-3: Mass assignment — req.body passed directly, isVerified+role writable
contractorRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const contractor = await contractorService.updateContractor(req.params.id, req.body, userId);
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' }) as any;
    res.json({ data: contractor });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contractor' });
  }
});

// VULN-10: SSRF — webhook URL stored then fetched server-side
contractorRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { webhookUrl } = req.body;
    await contractorService.updateContractor('', { webhookUrl }, userId);
    res.json({ message: 'Webhook URL updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

contractorRouter.post('/:id/trigger-webhook', async (req: Request, res: Response) => {
  try {
    await contractorService.triggerWebhook(req.params.id, req.body);
    res.json({ message: 'Webhook triggered' });
  } catch (error) {
    res.status(500).json({ error: 'Webhook trigger failed' });
  }
});