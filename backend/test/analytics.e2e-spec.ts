import { AnalyticsController } from '@/api/analytics/analytics.controller';
import { AnalyticsService } from '@/api/analytics/analytics.service';
import { AuthService } from '@/api/auth/auth.service';
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
const analyticsPath = `/api/v1/workspaces/${workspaceId}/projects/${projectId}/analytics`;

describe('Analytics API (e2e)', () => {
  let app: INestApplication;

  const authService = {
    verifyAccessToken: jest.fn().mockResolvedValue({ id: userId }),
  };
  const analyticsService = {
    getProjectSummary: jest.fn().mockResolvedValue({ totalTasks: 0 }),
    getSprintVelocity: jest.fn().mockResolvedValue({ sampleSize: 0 }),
    getCycleTime: jest.fn().mockResolvedValue({ completedTasks: 0 }),
    getSprintBurndown: jest.fn().mockResolvedValue({ points: [] }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AnalyticsService, useValue: analyticsService },
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
    analyticsService.getProjectSummary.mockResolvedValue({ totalTasks: 0 });
    analyticsService.getSprintVelocity.mockResolvedValue({ sampleSize: 0 });
    analyticsService.getCycleTime.mockResolvedValue({ completedTasks: 0 });
    analyticsService.getSprintBurndown.mockResolvedValue({ points: [] });
  });

  it('serves analytics routes within authenticated workspace and project scope', async () => {
    await request(app.getHttpServer())
      .get(`${analyticsPath}/summary`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(analyticsService.getProjectSummary).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      userId,
    );

    await request(app.getHttpServer())
      .get(`${analyticsPath}/velocity?limit=12`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(analyticsService.getSprintVelocity).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      userId,
      expect.objectContaining({ limit: 12 }),
    );

    await request(app.getHttpServer())
      .get(`${analyticsPath}/cycle-time`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(analyticsService.getCycleTime).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      userId,
    );

    await request(app.getHttpServer())
      .get(`${analyticsPath}/sprints/${sprintId}/burndown`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(analyticsService.getSprintBurndown).toHaveBeenCalledWith(
      workspaceId,
      projectId,
      sprintId,
      userId,
    );
  });

  it('validates velocity limits and requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`${analyticsPath}/velocity?limit=25`)
      .set('Authorization', 'Bearer test-token')
      .expect(422);
    expect(analyticsService.getSprintVelocity).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get(`${analyticsPath}/summary`)
      .expect(401);
    expect(analyticsService.getProjectSummary).not.toHaveBeenCalled();
  });
});
