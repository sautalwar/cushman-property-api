import axios from 'axios';
import { query } from '../config/database';
import { Contractor, CreateContractorDto, UpdateContractorDto } from '../models/Contractor';

export class ContractorService {

  async getAllContractors(specialty?: string): Promise<Contractor[]> {
    if (specialty) {
      const result = await query('SELECT * FROM contractors WHERE specialty = $1 ORDER BY rating DESC', [specialty]);
      return result.rows;
    }
    const result = await query('SELECT * FROM contractors ORDER BY rating DESC');
    return result.rows;
  }

  async getContractorById(id: string): Promise<Contractor | null> {
    const result = await query('SELECT * FROM contractors WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createContractor(dto: CreateContractorDto, userId: string): Promise<Contractor> {
    const result = await query(
      'INSERT INTO contractors (user_id, company_name, specialty, hourly_rate) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, dto.companyName, dto.specialty, dto.hourlyRate]
    );
    return result.rows[0];
  }

  // VULN-3: Mass Assignment — spreads entire req.body including isVerified and role
  async updateContractor(id: string, dto: UpdateContractorDto, userId: string): Promise<Contractor | null> {
    // Build SET clause from all keys in dto — including isVerified and role (intentional vuln)
    const allowedFields = Object.keys(dto);
    if (allowedFields.length === 0) return this.getContractorById(id);

    const fieldMap: Record<string, string> = {
      companyName: 'company_name',
      hourlyRate: 'hourly_rate',
      webhookUrl: 'webhook_url',
      isVerified: 'is_verified',
      role: 'role',  // VULN-3: role column in contractors table is writable by contractor
    };

    const setClauses = allowedFields
      .filter(f => fieldMap[f])
      .map((f, i) => `${fieldMap[f]} = $${i + 1}`);
    const values = allowedFields.filter(f => fieldMap[f]).map(f => (dto as any)[f]);
    values.push(id);
    values.push(userId);

    const sql = `UPDATE contractors SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`;
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  // VULN-10: SSRF — fetches user-supplied webhook URL with no validation
  async triggerWebhook(contractorId: string, payload: object): Promise<void> {
    const result = await query('SELECT webhook_url FROM contractors WHERE id = $1', [contractorId]);
    const webhookUrl = result.rows[0]?.webhook_url;
    if (webhookUrl) {
      // VULN-10: No URL validation — attacker can point this at http://169.254.169.254/metadata/instance
      await axios.get(webhookUrl, { params: payload, timeout: 5000 });
    }
  }
}