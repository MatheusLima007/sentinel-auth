import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('deve validar quando senha atende política de complexidade', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'demo@local.dev',
      password: 'Demo@12345',
      appId: 'demo-web',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('deve falhar quando senha não atende política de complexidade', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'demo@local.dev',
      password: 'demopassword',
      appId: 'demo-web',
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints).toEqual(
      expect.objectContaining({
        matches: 'A senha deve conter letra minúscula, maiúscula, número e caractere especial',
      }),
    );
  });
});
