import { query } from '../config/database';
import { CreatePropertyDto, Property } from '../models/Property';

export class PropertyService {

  // VULN-5: Pagination Abuse — no max limit cap; limit=999999 returns entire table
  async getAllProperties(ownerId: string, limit: number, offset: number): Promise<Property[]> {
    const sql = `SELECT * FROM properties WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const result = await query(sql, [ownerId, limit, offset]);
    return result.rows;
  }

  // VULN-8: SQL Injection — user input concatenated directly into SQL string
  async searchProperties(searchTerm: string): Promise<Property[]> {
    const sql = `SELECT * FROM properties WHERE name ILIKE '%${searchTerm}%' OR city ILIKE '%${searchTerm}%'`;
    const result = await query(sql);
    return result.rows;
  }

  async getPropertyById(id: string): Promise<Property | null> {
    const result = await query('SELECT * FROM properties WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createProperty(dto: CreatePropertyDto, ownerId: string): Promise<Property> {
    const sql = `
      INSERT INTO properties (name, address, city, state, zip_code, property_type, square_feet, monthly_rent, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await query(sql, [
      dto.name, dto.address, dto.city, dto.state, dto.zipCode,
      dto.propertyType, dto.squareFeet, dto.monthlyRent, ownerId
    ]);
    return result.rows[0];
  }

  async countProperties(ownerId: string): Promise<number> {
    const result = await query('SELECT COUNT(*) FROM properties WHERE owner_id = $1', [ownerId]);
    return parseInt(result.rows[0].count);
  }
}