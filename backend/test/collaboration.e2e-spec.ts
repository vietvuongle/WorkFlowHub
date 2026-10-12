import { AuthService } from '@/api/auth/auth.service';
import { CollaborationService } from '@/api/collaboration/collaboration.service';
import { NotificationsController } from '@/api/collaboration/notifications.controller';
import { NotificationsService } from '@/api/collaboration/notifications.service';
import { TaskController } from '@/api/task/task.controller';
import { TaskService } from '@/api/task/task.service';
import { WorkspacePermissionGuard } from '@/api/workspace/guards/workspace-permission.guard';
import {
  INestApplication,
  RequestMethod,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../src/guards/auth.guard';

const userId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const taskId = '44444444-4444-4444-8444-444444444444';
const notificationId = '55555555-5555-4555-8555-555555555555';
const taskPath = `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`;

describe('Collaboration API (e2e)', () => {
  let app: INestApplication;

  const authService = {
    verifyAccessToken: jest.fn().mockResolvedValue({ id: userId }),
  };
  const taskService = {};
  const collaborationService = {
    findTaskComments: jest.fn().mockResolvedValue([]),
    createTaskComment: jest.fn().mockResolvedValue({ id: 'comment-id' }),
  };
  const notificationsService = {
    findAll: jest.fn().mockResolvedValue([]),
    unreadCount: jest.fn().mockResolvedValue(0),
    markAllRead: jest.fn().mockResolvedValue(undefined),
    markRead: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaskController, NotificationsController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TaskService, useValue: taskService },
        { provide: CollaborationService, useValue: collaborationService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    })
      .overrideGuard(WorkspacePermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [{ method: RequestMethod.GET, path: 'health' }],
    });
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        errorHttpStatusCode: 422,
        exceptionFactory: (errors: ValidationError[]) =>
          new UnprocessableEntityException(errors),
      }),
    );
    app.useGlobalGuards(
      new AuthGuard(app.get(Reflector), app.get(AuthService)),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.verifyAccessToken.mockResolvedValue({ id: userId });
    collaborationService.findTaskComments.mockResolvedValue([]);
    collaborationService.createTaskComment.mockResolvedValue({
      id: 'comment-id',
    });
    notificationsService.findAll.mockResolvedValue([]);
    notificationsService.unreadCount.mockResolvedValue(0);
    notificationsService.markAllRead.mockResolvedValue(undefined);
    notificationsService.markRead.mockResolvedValue(undefined);
  });

  it('GET task comments dispatches using authenticated project scope', async () => {
    await request(app.getHttpServer())
      .get(`${taskPath}/comments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(collaborationService.findTaskComments).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      taskId,
      userId,
    );
  });

  it('POST task comments validates content and mention IDs before dispatch', async () => {
    const body = {
      content: 'Please review',
      mentionedUserIds: [userId],
    };
    await request(app.getHttpServer())
      .post(`${taskPath}/comments`)
      .set('Authorization', 'Bearer valid-token')
      .send(body)
      .expect(201);

    expect(collaborationService.createTaskComment).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      taskId,
      userId,
      body,
    );

    await request(app.getHttpServer())
      .post(`${taskPath}/comments`)
      .set('Authorization', 'Bearer valid-token')
      .send({ content: '  ', mentionedUserIds: [] })
      .expect(422);
    expect(collaborationService.createTaskComment).toHaveBeenCalledTimes(1);
  });

  it('lists notifications for the authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(notificationsService.findAll).toHaveBeenCalledWith(userId);
  });

  it('gets unread notification count for the authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(notificationsService.unreadCount).toHaveBeenCalledWith(userId);
  });

  it('marks one notification or all notifications as read', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
    expect(notificationsService.markRead).toHaveBeenCalledWith(
      userId,
      notificationId,
    );

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
    expect(notificationsService.markAllRead).toHaveBeenCalledWith(userId);
  });

  it('rejects unauthenticated comment and notification access', async () => {
    await request(app.getHttpServer()).get(`${taskPath}/comments`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
  });
});
