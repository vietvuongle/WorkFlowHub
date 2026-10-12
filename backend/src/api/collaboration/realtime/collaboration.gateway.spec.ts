import { AuthService } from '@/api/auth/auth.service';
import { JwtPayloadType } from '@/api/auth/types/jwt-payload.type';
import { Uuid } from '@/common/types/common.type';
import { UnauthorizedException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { NotificationResDto } from '../dto/notification.res.dto';
import {
  CollaborationGateway,
  notificationRoom,
} from './collaboration.gateway';

describe('CollaborationGateway', () => {
  const authService = {
    verifyAccessToken: jest.fn(),
  } as unknown as AuthService;
  let gateway: CollaborationGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new CollaborationGateway(authService);
  });

  it('authenticates socket connections and joins only the users private room', async () => {
    const user: JwtPayloadType = {
      id: 'user-id',
      sessionId: 'session-id',
      iat: 0,
      exp: 0,
    };
    jest.spyOn(authService, 'verifyAccessToken').mockResolvedValue(user);
    const client = {
      handshake: { auth: { token: 'valid-access-token' } },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(authService.verifyAccessToken).toHaveBeenCalledWith(
      'valid-access-token',
    );
    expect(client.join).toHaveBeenCalledWith(
      notificationRoom('user-id' as Uuid),
    );
    expect(client.data.userId).toBe('user-id');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects clients with missing or invalid access tokens', async () => {
    const missingTokenClient = {
      handshake: { auth: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;
    await gateway.handleConnection(missingTokenClient);
    expect(missingTokenClient.disconnect).toHaveBeenCalledWith(true);

    jest
      .spyOn(authService, 'verifyAccessToken')
      .mockRejectedValue(new UnauthorizedException());
    const invalidTokenClient = {
      handshake: { auth: { token: 'invalid' } },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;
    await gateway.handleConnection(invalidTokenClient);
    expect(invalidTokenClient.disconnect).toHaveBeenCalledWith(true);
    expect(invalidTokenClient.join).not.toHaveBeenCalled();
  });

  it('publishes notifications only to the addressed user room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    Object.assign(gateway, { server: { to } });
    const notification = { id: 'notification-id' } as NotificationResDto;

    gateway.publishNotification('recipient-id' as Uuid, notification);

    expect(to).toHaveBeenCalledWith(notificationRoom('recipient-id' as Uuid));
    expect(emit).toHaveBeenCalledWith('notification.created', notification);
  });
});
