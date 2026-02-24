import { PropertyService } from '../services/PropertyService';

jest.mock('../config/database', () => ({ query: jest.fn() }));
import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('PropertyService', () => {
  let service: PropertyService;
  beforeEach(() => { service = new PropertyService(); jest.clearAllMocks(); });

  describe('getAllProperties', () => {
    it('should return properties for owner', async () => {
      const mock = [{ id: '1', name: 'Tower One', city: 'Chicago' }];
      mockQuery.mockResolvedValueOnce({ rows: mock } as any);
      const result = await service.getAllProperties('owner-1', 20, 0);
      expect(result).toEqual(mock);
    });
  });

  describe('searchProperties', () => {
    it('should return matching properties', async () => {
      const mock = [{ id: '1', name: 'Westfield Tower' }];
      mockQuery.mockResolvedValueOnce({ rows: mock } as any);
      const result = await service.searchProperties('Westfield');
      expect(result).toEqual(mock);
    });
  });

  describe('createProperty', () => {
    it('should create a new property', async () => {
      const dto = { name: 'New Building', address: '1 Main St', city: 'Chicago', state: 'IL', zipCode: '60601', propertyType: 'commercial_office' as const, squareFeet: 10000, monthlyRent: 50000 };
      const mock = { id: 'new-id', ...dto };
      mockQuery.mockResolvedValueOnce({ rows: [mock] } as any);
      const result = await service.createProperty(dto, 'owner-1');
      expect(result).toEqual(mock);
    });
  });
});