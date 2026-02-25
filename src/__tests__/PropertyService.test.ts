import { PropertyService } from '../services/PropertyService';

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PropertyService', () => {
  let service: PropertyService;

  beforeEach(() => {
    service = new PropertyService();
    jest.clearAllMocks();
  });

  describe('getAllProperties', () => {
    it('should return all properties for an owner', async () => {
      const mockProperties = [
        { id: '1', name: 'Tower One', city: 'Chicago' },
        { id: '2', name: 'Plaza Center', city: 'New York' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockProperties } as any);

      const result = await service.getAllProperties('owner-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM properties'),
        ['owner-123']
      );
      expect(result).toEqual(mockProperties);
    });
  });

  describe('createProperty', () => {
    it('should create a new property', async () => {
      const dto = {
        name: 'New Building',
        address: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        propertyType: 'office' as const,
        squareFeet: 50000,
        yearBuilt: 2020,
        monthlyRent: 75000,
      };
      const mockResult = { id: '3', ...dto };
      mockQuery.mockResolvedValueOnce({ rows: [mockResult] } as any);

      const result = await service.createProperty(dto, 'owner-123');

      expect(result).toEqual(mockResult);
    });
  });

  describe('findNearby', () => {
    it('should return properties within the given radius with distanceMiles', async () => {
      const mockRows = [
        { id: '1', name: 'Tower One', latitude: 41.878, longitude: -87.629, distance_miles: '0.5' },
        { id: '2', name: 'Plaza Center', latitude: 41.881, longitude: -87.632, distance_miles: '1.2' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await service.findNearby(41.878, -87.629, 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        [-87.629, 41.878, 5]
      );
      expect(result[0].distanceMiles).toBe(0.5);
      expect(result[1].distanceMiles).toBe(1.2);
    });

    it('should return an empty array when no properties are nearby', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.findNearby(0, 0, 1);

      expect(result).toEqual([]);
    });
  });

  describe('deleteProperty', () => {
    it('should return true when property is deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await service.deleteProperty('prop-1', 'owner-123');

      expect(result).toBe(true);
    });

    it('should return false when property not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 } as any);

      const result = await service.deleteProperty('nonexistent', 'owner-123');

      expect(result).toBe(false);
    });
  });
});
