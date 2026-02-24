import { JobService } from '../services/JobService';

jest.mock('../config/database', () => ({ query: jest.fn() }));
import { query } from '../config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('JobService', () => {
  let service: JobService;
  beforeEach(() => { service = new JobService(); jest.clearAllMocks(); });

  describe('getJobById - VULN-1 BOLA', () => {
    it('should return any job regardless of requesting user', async () => {
      const mock = { id: 'job-1', owner_id: 'user-A', title: 'Fix leak' };
      mockQuery.mockResolvedValueOnce({ rows: [mock] } as any);
      // User B accessing User A job — should return due to BOLA vuln
      const result = await service.getJobById('job-1');
      expect(result).toEqual(mock);
      // Verify no ownership check in SQL
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM jobs WHERE id = $1', ['job-1']);
    });
  });

  describe('completeJob - VULN-9 Unrestricted Business Flow', () => {
    it('should complete job for any contractor, not just assigned one', async () => {
      const mock = { id: 'job-1', status: 'completed' };
      mockQuery.mockResolvedValueOnce({ rows: [mock] } as any);
      const result = await service.completeJob('job-1', 'unassigned-contractor-id');
      expect(result?.status).toBe('completed');
    });
  });
});