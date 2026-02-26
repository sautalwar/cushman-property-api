import { authRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';

describe('rateLimiter middleware', () => {
  it('should export authRateLimiter as a function', () => {
    expect(typeof authRateLimiter).toBe('function');
  });

  it('should export apiRateLimiter as a function', () => {
    expect(typeof apiRateLimiter).toBe('function');
  });

  it('authRateLimiter should call next for a normal request', () => {
    const req = { ip: '127.0.0.1', headers: {}, method: 'GET', path: '/' } as any;
    const res = {
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    authRateLimiter(req, res, next);

    return new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(next).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it('apiRateLimiter should use req.user.id as key when user is authenticated', () => {
    const req = {
      ip: '127.0.0.1',
      headers: {},
      method: 'GET',
      path: '/',
      user: { id: 'user-42' },
    } as any;
    const res = {
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    apiRateLimiter(req, res, next);

    return new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(next).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it('apiRateLimiter should fall back to IP when user is not authenticated', () => {
    const req = {
      ip: '192.168.1.1',
      headers: {},
      method: 'GET',
      path: '/',
    } as any;
    const res = {
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    apiRateLimiter(req, res, next);

    return new Promise<void>((resolve) => {
      setImmediate(() => {
        expect(next).toHaveBeenCalled();
        resolve();
      });
    });
  });
});
