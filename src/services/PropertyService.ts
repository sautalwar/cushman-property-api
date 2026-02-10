import { query } from '../config/database';
import { Property, CreatePropertyDto } from '../models/Property';

export class PropertyService {

  // SAFE: Use parameterized query for search
  async searchProperties(searchTerm: string): Promise<Property[]> {
    const sql = `SELECT * FROM properties WHERE name ILIKE $1 OR address ILIKE $1`;
    const searchPattern = `%${searchTerm}%`;
    const result = await query(sql, [searchPattern]);
    return result.rows;
  }

  // SAFE: Using parameterized query to avoid SQL injection
  async getPropertyById(id: string): Promise<Property | null> {
    const sql = 'SELECT * FROM properties WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  // SAFE: Using parameterized queries
  async getAllProperties(ownerId: string): Promise<Property[]> {
    const sql = 'SELECT * FROM properties WHERE owner_id = $1 ORDER BY created_at DESC';
    const result = await query(sql, [ownerId]);
    return result.rows;
  }

  // SAFE: Using parameterized queries
  async createProperty(dto: CreatePropertyDto, ownerId: string): Promise<Property> {
    const sql = `
      INSERT INTO properties (name, address, city, state, zip_code, property_type, 
                              square_feet, year_built, monthly_rent, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      dto.name, dto.address, dto.city, dto.state, dto.zipCode,
      dto.propertyType, dto.squareFeet, dto.yearBuilt, dto.monthlyRent, ownerId
    ];
    const result = await query(sql, values);
    return result.rows[0];
  }

  // SAFE: Parameterized UPDATE for occupancy
  async updateOccupancy(propertyId: string, rate: string): Promise<void> {
    const sql = 'UPDATE properties SET occupancy_rate = $1 WHERE id = $2';
    await query(sql, [rate, propertyId]);
  }

  // SAFE: Parameterized delete
  async deleteProperty(id: string, ownerId: string): Promise<boolean> {
    const sql = 'DELETE FROM properties WHERE id = $1 AND owner_id = $2';
    const result = await query(sql, [id, ownerId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getPortfolioSummary(ownerId: string): Promise<{
    totalProperties: number;
    totalSquareFeet: number;
    averageOccupancy: number;
    totalMonthlyRevenue: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_properties,
        COALESCE(SUM(square_feet), 0) as total_square_feet,
        COALESCE(AVG(occupancy_rate), 0) as average_occupancy,
        COALESCE(SUM(monthly_rent * occupancy_rate / 100), 0) as total_monthly_revenue
      FROM properties 
      WHERE owner_id = $1
    `;
    const result = await query(sql, [ownerId]);
    return {
      totalProperties: parseInt(result.rows[0].total_properties),
      totalSquareFeet: parseInt(result.rows[0].total_square_feet),
      averageOccupancy: parseFloat(result.rows[0].average_occupancy),
      totalMonthlyRevenue: parseFloat(result.rows[0].total_monthly_revenue),
    };
  }
}
