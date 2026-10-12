import { AuthService } from '@/api/auth/auth.service';
import { JwtPayloadType } from '@/api/auth/types/jwt-payload.type';
import { Uuid } from '@/common/types/common.type';
import { UnauthorizedException } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationResDto } from '../dto/notification.res.dto';

export const notificationRoom = (userId: Uuid): string =>
  `user:${userId}:notifications`;

@WebSocketGateway({ namespace: '/realtime' })
export class CollaborationGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect(true);
      return;
    }

    let user: JwtPayloadType;
    try {
      user = await this.authService.verifyAccessToken(token);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }
      client.disconnect(true);
      return;
    }

    await client.join(notificationRoom(user.id as Uuid));
    client.data.userId = user.id;
  }

  publishNotification(
    recipientUserId: Uuid,
    notification: NotificationResDto,
  ): void {
    this.server
      .to(notificationRoom(recipientUserId))
      .emit('notification.created', notification);
  }
}
