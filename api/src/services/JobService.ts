import { query } from '../config/database';
import { CreateJobDto, Job } from '../models/Job';

export class JobService {

  // VULN-1: BOLA — no ownership check; any authenticated user can read any job by ID
  async getJobById(id: string): Promise<Job | null> {
    // VULN-1: Should check WHERE id = $1 AND owner_id = $2 but we don't
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getJobsByOwner(ownerId: string): Promise<Job[]> {
    const result = await query('SELECT * FROM jobs WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
    return result.rows;
  }

  async createJob(dto: CreateJobDto, ownerId: string): Promise<Job> {
    const sql = `
      INSERT INTO jobs (title, description, property_id, owner_id, required_specialty, status)
      VALUES ($1, $2, $3, $4, $5, 'open')
      RETURNING *
    `;
    const result = await query(sql, [dto.title, dto.description, dto.propertyId, ownerId, dto.requiredSpecialty]);
    return result.rows[0];
  }

  async assignContractor(jobId: string, contractorId: string, ownerId: string): Promise<Job | null> {
    const result = await query(
      `UPDATE jobs SET assigned_contractor_id = $1, status = 'assigned', updated_at = NOW()
       WHERE id = $2 AND owner_id = $3 AND status = 'open'
       RETURNING *`,
      [contractorId, jobId, ownerId]
    );
    return result.rows[0] || null;
  }

  // VULN-9: Unrestricted Sensitive Business Flow — any contractor can mark any job complete
  async completeJob(jobId: string, _contractorId: string): Promise<Job | null> {
    // VULN-9: Should check WHERE assigned_contractor_id = $2 but we don't enforce it
    const result = await query(
      `UPDATE jobs SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [jobId]
    );
    return result.rows[0] || null;
  }
}