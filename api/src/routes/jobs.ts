import { Router, Request, Response } from 'express';
import multer from 'multer';
import { JobService } from '../services/JobService';
import { BidService } from '../services/BidService';

export const jobRouter = Router();
const jobService = new JobService();
const bidService = new BidService();

// VULN-4: No file size limit — large payload DoS
const upload = multer({ storage: multer.memoryStorage() }); // VULN-4: no limits: { fileSize }

// VULN-1: BOLA — any auth user can read any job
jobRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' }) as any;
    res.json({ data: job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve job' });
  }
});

jobRouter.get('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const jobs = await jobService.getJobsByOwner(ownerId);
    res.json({ data: jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

jobRouter.post('/', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const job = await jobService.createJob(req.body, ownerId);
    res.status(201).json({ data: job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

jobRouter.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).user.userId;
    const job = await jobService.assignContractor(req.params.id, req.body.contractorId, ownerId);
    if (!job) return res.status(404).json({ error: 'Job not found or not assignable' }) as any;
    res.json({ data: job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign contractor' });
  }
});

// VULN-9: Any contractor can complete any job
jobRouter.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const contractorId = (req as any).user.userId;
    const job = await jobService.completeJob(req.params.id, contractorId);
    if (!job) return res.status(404).json({ error: 'Job not found' }) as any;
    res.json({ data: job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// VULN-4: No size limit on multipart upload
jobRouter.post('/:id/attachments', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' }) as any;
    res.json({ message: 'File uploaded', size: req.file.size, filename: req.file.originalname });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// VULN-6: No per-user rate limiting on bid submission
jobRouter.post('/:id/bids', async (req: Request, res: Response) => {
  try {
    const contractorId = (req as any).user.userId;
    const bid = await bidService.submitBid(req.params.id, contractorId, req.body);
    res.status(201).json({ data: bid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit bid' });
  }
});

jobRouter.get('/:id/bids', async (req: Request, res: Response) => {
  try {
    const bids = await bidService.getBidsForJob(req.params.id);
    res.json({ data: bids, count: bids.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve bids' });
  }
});