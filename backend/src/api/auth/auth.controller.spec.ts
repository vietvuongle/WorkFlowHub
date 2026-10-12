import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceValue: Partial<Record<keyof AuthService, jest.Mock>>;

  beforeAll(async () => {
    authServiceValue = {
      signIn: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      verifyEmail: jest.fn(),
      resendEmailVerification: jest.fn(),
      forgotPassword: jest.fn(),
      verifyForgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceValue,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns a confirmation page after verifying an email', async () => {
    const response = await controller.verifyEmail({ token: 'valid-token' });

    expect(authServiceValue.verifyEmail).toHaveBeenCalledWith('valid-token');
    expect(response).toContain('<title>Email verified</title>');
    expect(response).toContain(
      'Your email address has been verified. You can now sign in.',
    );
  });

  it('starts the password reset flow', async () => {
    await controller.forgotPassword({ email: 'user@example.com' });

    expect(authServiceValue.forgotPassword).toHaveBeenCalledWith(
      'user@example.com',
    );
  });

  it('verifies a password reset token', async () => {
    await controller.verifyForgotPassword({ token: 'reset-token' });

    expect(authServiceValue.verifyForgotPassword).toHaveBeenCalledWith(
      'reset-token',
    );
  });

  it('resets the password with the verified token', async () => {
    await controller.resetPassword({
      token: 'reset-token',
      password: 'NewPassword123!',
    });

    expect(authServiceValue.resetPassword).toHaveBeenCalledWith(
      'reset-token',
      'NewPassword123!',
    );
  });
});
