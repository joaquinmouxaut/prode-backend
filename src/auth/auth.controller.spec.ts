import { HttpStatus } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const register = jest.fn();
  const login = jest.fn();
  const authService = { register, login } as unknown as AuthService;

  let controller: AuthController;

  beforeEach(() => {
    register.mockReset();
    login.mockReset();
    controller = new AuthController(authService);
  });

  function getMethod(
    methodName: 'register' | 'login',
  ): (...args: unknown[]) => unknown {
    const descriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      methodName,
    );
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error(`Missing method metadata target: ${methodName}`);
    }
    return descriptor.value as (...args: unknown[]) => unknown;
  }

  it('returns the auth contract for register', async () => {
    const response = {
      user: { id: 1, name: 'Ana', email: 'ana@example.com', role: 'USER' },
      accessToken: 'jwt-token',
    };
    register.mockResolvedValue(response);

    await expect(
      controller.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'secret123',
      }),
    ).resolves.toEqual(response);
  });

  it('returns the auth contract for login', async () => {
    const response = {
      user: { id: 2, name: 'Beto', email: 'beto@example.com', role: 'ADMIN' },
      accessToken: 'jwt-admin',
    };
    login.mockResolvedValue(response);

    await expect(
      controller.login({
        email: 'beto@example.com',
        password: 'secret123',
      }),
    ).resolves.toEqual(response);
  });

  it('maps unauthorized backend error with generic message', async () => {
    login.mockRejectedValue({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Invalid credentials',
      error: 'Unauthorized',
    });

    await expect(
      controller.login({
        email: 'unknown@example.com',
        password: 'bad-pass',
      }),
    ).rejects.toMatchObject({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Invalid credentials',
    });
  });

  it('keeps endpoint metadata for register and login status codes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');

    const registerMethod = getMethod('register');
    const loginMethod = getMethod('login');

    expect(Reflect.getMetadata(PATH_METADATA, registerMethod)).toBe('register');
    expect(Reflect.getMetadata(PATH_METADATA, loginMethod)).toBe('login');
    expect(Reflect.getMetadata(METHOD_METADATA, registerMethod)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(METHOD_METADATA, loginMethod)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, loginMethod)).toBe(
      HttpStatus.OK,
    );
  });
});
