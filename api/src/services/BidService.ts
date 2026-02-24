import { query } from '../config/database';
import { Bid, CreateBidDto } from '../models/Bid';

export class BidService {

  async getBidsForJob(jobId: string): Promise<Bid[]> {
    // Returns bids sorted cheapest first — helps property owner pick lowest bidder
    const result = await query(
      'SELECT b.*, c.company_name, c.rating FROM bids b JOIN contractors c ON b.contractor_id = c.id WHERE b.job_id = $1 ORDER BY b.amount ASC',
      [jobId]
    );
    return result.rows;
  }

  // VULN-6: No per-user rate limiting on bid submission
  async submitBid(jobId: string, contractorId: string, dto: CreateBidDto): Promise<Bid> {
    // VULN-6: No check for how many bids this contractor has submitted recently
    const existing = await query('SELECT id FROM bids WHERE job_id = $1 AND contractor_id = $2', [jobId, contractorId]);
    if (existing.rows.length > 0) {
      // Update existing bid
      const result = await query(
        'UPDATE bids SET amount = $1, note = $2 WHERE job_id = $3 AND contractor_id = $4 RETURNING *',
        [dto.amount, dto.note || null, jobId, contractorId]
      );
      return result.rows[0];
    }
    const result = await query(
      'INSERT INTO bids (job_id, contractor_id, amount, note) VALUES ($1, $2, $3, $4) RETURNING *',
      [jobId, contractorId, dto.amount, dto.note || null]
    );
    return result.rows[0];
  }
}