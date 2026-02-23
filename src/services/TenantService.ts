import { query } from '../config/database';
import { Tenant, CreateTenantDto } from '../models/Tenant';

export class TenantService {

  async getTenantsByProperty(propertyId: string): Promise<Tenant[]> {
    const sql = 'SELECT * FROM tenants WHERE property_id = $1 ORDER BY lease_start_date DESC';
    const result = await query(sql, [propertyId]);
    return result.rows;
  }

  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    const sql = `
      INSERT INTO tenants (company_name, contact_name, email, phone, property_id,
                           lease_start_date, lease_end_date, monthly_rent, security_deposit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      dto.companyName, dto.contactName, dto.email, dto.phone, dto.propertyId,
      dto.leaseStartDate, dto.leaseEndDate, dto.monthlyRent, dto.securityDeposit
    ];
    const result = await query(sql, values);
    return result.rows[0];
  }

  async getExpiringLeases(daysAhead: number = 90): Promise<Tenant[]> {
    const sql = `
      SELECT t.*, p.name as property_name, p.address as property_address
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      WHERE t.lease_end_date BETWEEN NOW() AND NOW() + INTERVAL '${daysAhead} days'
        AND t.is_active = true
      ORDER BY t.lease_end_date ASC
    `;
    const result = await query(sql);
    return result.rows;
  }

  async deactivateTenant(tenantId: string): Promise<void> {
    const sql = 'UPDATE tenants SET is_active = false, updated_at = NOW() WHERE id = $1';
    await query(sql, [tenantId]);
  }
}
