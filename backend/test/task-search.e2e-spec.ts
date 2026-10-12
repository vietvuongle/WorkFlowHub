import { AuthService } from '@/api/auth/auth.service';
import { CollaborationService } from '@/api/collaboration/collaboration.service';
import { TaskStatus } from '@/api/task/entities/task.entity';
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
const sprintId = '44444444-4444-4444-8444-444444444444';
const parentTaskId = '55555555-5555-4555-8555-555555555555';
const searchPath = `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/search`;

describe('Task search API (e2e)', () => {
  let app: INestApplication;

  const authService = {
    verifyAccessToken: jest.fn().mockResolvedValue({ id: userId }),
  };
  const taskService = {
    search: jest.fn().mockResolvedValue({
      data: [],
      pagination: {
        limit: 10,
        currentPage: 1,
        totalRecords: 0,
        totalPages: 0,
      },
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TaskService, useValue: taskService },
        { provide: CollaborationService, useValue: {} },
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
    taskService.search.mockResolvedValue({
      data: [],
      pagination: {
        limit: 10,
        currentPage: 1,
        totalRecords: 0,
        totalPages: 0,
      },
    });
  });

  it('searches project tasks with validated filters and paging options', async () => {
    const result = await request(app.getHttpServer())
      .get(searchPath)
      .set('Authorization', 'Bearer test-token')
      .query({
        q: '  bug  ',
        status: TaskStatus.IN_PROGRESS,
        sprintId,
        parentTaskId,
        page: 2,
        limit: 25,
        sortBy: 'title',
        order: 'DESC',
      })
      .expect(200);

    expect(result.body).toEqual({
      data: [],
      pagination: {
        limit: 10,
        currentPage: 1,
        totalRecords: 0,
        totalPages: 0,
      },
    });
    expect(taskService.search).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      userId,
      expect.objectContaining({
        q: '  bug  ',
        status: TaskStatus.IN_PROGRESS,
        sprintId,
        parentTaskId,
        page: 2,
        limit: 25,
        sortBy: 'title',
        order: 'DESC',
      }),
    );
  });

  it('rejects invalid filters and oversized page limits', async () => {
    await request(app.getHttpServer())
      .get(searchPath)
      .set('Authorization', 'Bearer test-token')
      .query({ status: 'UNKNOWN' })
      .expect(422);

    await request(app.getHttpServer())
      .get(searchPath)
      .set('Authorization', 'Bearer test-token')
      .query({ limit: 101 })
      .expect(422);

    expect(taskService.search).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get(searchPath).expect(401);
    expect(taskService.search).not.toHaveBeenCalled();
  });
});
