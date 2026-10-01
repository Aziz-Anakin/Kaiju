import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('extrait userId, email et role du token', async () => {
    const config = { get: () => 'test-secret' } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);

    const result = await strategy.validate({
      sub: 1,
      email: 'user@example.com',
      role: 'QC',
    });

    expect(result).toEqual({
      userId: 1,
      email: 'user@example.com',
      role: 'QC',
    });
  });
});
