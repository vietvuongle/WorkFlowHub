import { AuthController } from '@/api/auth/auth.controller';
import { AuthService } from '@/api/auth/auth.service';
import { CollaborationService } from '@/api/collaboration/collaboration.service';
import { HealthController } from '@/api/health/health.controller';
import { HomeController } from '@/api/home/home.controller';
import { PostController } from '@/api/post/post.controller';
import { PostService } from '@/api/post/post.service';
import { ProjectController } from '@/api/project/project.controller';
import { ProjectService } from '@/api/project/project.service';
import { SprintController } from '@/api/sprint/sprint.controller';
import { SprintService } from '@/api/sprint/sprint.service';
import { TaskController } from '@/api/task/task.controller';
import { TaskService } from '@/api/task/task.service';
import { UserController } from '@/api/user/user.controller';
import { UserService } from '@/api/user/user.service';
import { WORKSPACE_PERMISSION_CODES } from '@/api/workspace/constants/workspace-permission.constant';
import { WorkspacePermissionGuard } from '@/api/workspace/guards/workspace-permission.guard';
import { WorkspaceAccessController } from '@/api/workspace/workspace-access.controller';
import { WorkspaceAccessService } from '@/api/workspace/workspace-access.service';
import { WorkspaceController } from '@/api/workspace/workspace.controller';
import { WorkspaceService } from '@/api/workspace/workspace.service';
import { AuthGuard } from '@/guards/auth.guard';
import {
  INestApplication,
  RequestMethod,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

const ids = {
  workspace: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  task: '33333333-3333-4333-8333-333333333333',
  relatedTask: '44444444-4444-4444-8444-444444444444',
  sprint: '55555555-5555-4555-8555-555555555555',
  workLog: '66666666-6666-4666-8666-666666666666',
  dependency: '77777777-7777-4777-8777-777777777777',
  user: '88888888-8888-4888-8888-888888888888',
  member: '99999999-9999-4999-8999-999999999999',
  role: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

const validJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.dGVzdA';
const actor = { id: ids.user, sub: ids.user, email: 'user@example.com' };
const workspacePath = `/api/v1/workspaces/${ids.workspace}`;
const projectPath = `${workspacePath}/projects/${ids.project}`;
const tasksPath = `${projectPath}/tasks`;
const sprintsPath = `${projectPath}/sprints`;

type ServiceMock = Record<string, jest.Mock>;

function createServiceMock(methodNames: string[]): ServiceMock {
  return Object.fromEntries(
    methodNames.map((methodName) => [
      methodName,
      jest.fn().mockResolvedValue({}),
    ]),
  );
}

const authMock = createServiceMock([
  'signIn',
  'register',
  'logout',
  'refreshToken',
  'verifyEmail',
  'resendEmailVerification',
  'forgotPassword',
  'verifyForgotPassword',
  'resetPassword',
  'verifyAccessToken',
]);
authMock.verifyAccessToken.mockResolvedValue(actor);

const userMock = createServiceMock([
  'findOne',
  'create',
  'findAll',
  'loadMoreUsers',
  'update',
  'remove',
  'changePassword',
]);
const postMock = createServiceMock([
  'findMany',
  'findOne',
  'create',
  'update',
  'delete',
]);
const workspaceMock = createServiceMock([
  'create',
  'findAll',
  'findOne',
  'update',
  'delete',
]);
const workspaceAccessMock = createServiceMock([
  'findPermissions',
  'findRoles',
  'createRole',
  'updateRole',
  'findMembers',
  'addMember',
  'updateMemberRole',
  'updateMemberStatus',
]);
const projectMock = createServiceMock([
  'create',
  'findAll',
  'findOne',
  'update',
  'delete',
  'findMembers',
  'addMember',
  'removeMember',
  'transition',
]);
const taskMock = createServiceMock([
  'create',
  'findAll',
  'findOne',
  'findSubtasks',
  'findDependencies',
  'addDependency',
  'removeDependency',
  'update',
  'delete',
  'updateRemaining',
  'updateStatus',
  'addWorkLog',
  'findWorkLogs',
  'updateWorkLog',
  'deleteWorkLog',
]);
const collaborationMock = createServiceMock([
  'findTaskComments',
  'createTaskComment',
]);
const sprintMock = createServiceMock([
  'create',
  'findAll',
  'findOne',
  'start',
  'complete',
  'cancel',
  'findTasks',
  'assignTask',
  'removeTask',
]);
const healthMock = createServiceMock(['check']);
healthMock.check.mockResolvedValue({
  status: 'ok',
  info: { database: { status: 'up' } },
  error: {},
  details: { database: { status: 'up' } },
});

type ApiCase = {
  title: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: Record<string, unknown>;
  query?: string;
  status?: number;
  service?: ServiceMock;
  serviceMethod?: string;
};

const apiCases: ApiCase[] = [
  {
    title: 'GET /',
    method: 'get',
    path: '/',
  },
  {
    title: 'GET /health',
    method: 'get',
    path: '/health',
    service: healthMock,
    serviceMethod: 'check',
  },

  {
    title: 'POST /auth/email/login',
    method: 'post',
    path: '/api/v1/auth/email/login',
    body: { email: 'user@example.com', password: 'Secret123!' },
    service: authMock,
    serviceMethod: 'signIn',
  },
  {
    title: 'POST /auth/email/register',
    method: 'post',
    path: '/api/v1/auth/email/register',
    body: { email: 'new@example.com', password: 'Secret123!' },
    service: authMock,
    serviceMethod: 'register',
  },
  {
    title: 'POST /auth/logout',
    method: 'post',
    path: '/api/v1/auth/logout',
    service: authMock,
    serviceMethod: 'logout',
  },
  {
    title: 'POST /auth/refresh',
    method: 'post',
    path: '/api/v1/auth/refresh',
    body: { refreshToken: validJwt },
    service: authMock,
    serviceMethod: 'refreshToken',
  },
  {
    title: 'POST /auth/forgot-password',
    method: 'post',
    path: '/api/v1/auth/forgot-password',
    body: { email: 'user@example.com' },
    service: authMock,
    serviceMethod: 'forgotPassword',
  },
  {
    title: 'POST /auth/verify/forgot-password',
    method: 'post',
    path: '/api/v1/auth/verify/forgot-password',
    body: { token: validJwt },
    service: authMock,
    serviceMethod: 'verifyForgotPassword',
  },
  {
    title: 'POST /auth/reset-password',
    method: 'post',
    path: '/api/v1/auth/reset-password',
    body: {
      token: validJwt,
      password: 'NewPassword123!',
    },
    service: authMock,
    serviceMethod: 'resetPassword',
  },
  {
    title: 'GET /auth/verify/email',
    method: 'get',
    path: `/api/v1/auth/verify/email?token=${validJwt}`,
    service: authMock,
    serviceMethod: 'verifyEmail',
  },
  {
    title: 'POST /auth/verify/email/resend',
    method: 'post',
    path: '/api/v1/auth/verify/email/resend',
    body: { email: 'user@example.com' },
    service: authMock,
    serviceMethod: 'resendEmailVerification',
  },

  {
    title: 'GET /users/me',
    method: 'get',
    path: '/api/v1/users/me',
    service: userMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'POST /users',
    method: 'post',
    path: '/api/v1/users',
    body: {
      username: 'TestUser',
      email: 'new-user@example.com',
      password: 'Secret123!',
    },
    status: 201,
    service: userMock,
    serviceMethod: 'create',
  },
  {
    title: 'GET /users',
    method: 'get',
    path: '/api/v1/users',
    service: userMock,
    serviceMethod: 'findAll',
  },
  {
    title: 'GET /users/load-more',
    method: 'get',
    path: '/api/v1/users/load-more',
    service: userMock,
    serviceMethod: 'loadMoreUsers',
  },
  {
    title: 'GET /users/:id',
    method: 'get',
    path: `/api/v1/users/${ids.user}`,
    service: userMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'PATCH /users/:id',
    method: 'patch',
    path: `/api/v1/users/${ids.user}`,
    body: { bio: 'Updated profile' },
    service: userMock,
    serviceMethod: 'update',
  },
  {
    title: 'DELETE /users/:id',
    method: 'delete',
    path: `/api/v1/users/${ids.user}`,
    service: userMock,
    serviceMethod: 'remove',
  },
  {
    title: 'POST /users/me/change-password',
    method: 'post',
    path: '/api/v1/users/me/change-password',
    body: {
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword123!',
    },
    service: userMock,
    serviceMethod: 'changePassword',
  },

  {
    title: 'GET /posts',
    method: 'get',
    path: '/api/v1/posts',
    service: postMock,
    serviceMethod: 'findMany',
  },
  {
    title: 'GET /posts/:id',
    method: 'get',
    path: `/api/v1/posts/${ids.task}`,
    service: postMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'POST /posts',
    method: 'post',
    path: '/api/v1/posts',
    body: { title: 'Test post', slug: 'test-post' },
    service: postMock,
    serviceMethod: 'create',
  },
  {
    title: 'PATCH /posts/:id',
    method: 'patch',
    path: `/api/v1/posts/${ids.task}`,
    body: { title: 'Updated post', slug: 'updated-post' },
    service: postMock,
    serviceMethod: 'update',
  },
  {
    title: 'DELETE /posts/:id',
    method: 'delete',
    path: `/api/v1/posts/${ids.task}`,
    service: postMock,
    serviceMethod: 'delete',
  },

  {
    title: 'POST /workspaces',
    method: 'post',
    path: '/api/v1/workspaces',
    body: { name: 'Test workspace' },
    status: 201,
    service: workspaceMock,
    serviceMethod: 'create',
  },
  {
    title: 'GET /workspaces',
    method: 'get',
    path: '/api/v1/workspaces',
    service: workspaceMock,
    serviceMethod: 'findAll',
  },
  {
    title: 'GET /workspaces/:id',
    method: 'get',
    path: workspacePath,
    service: workspaceMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'PATCH /workspaces/:id',
    method: 'patch',
    path: workspacePath,
    body: { name: 'Renamed workspace' },
    service: workspaceMock,
    serviceMethod: 'update',
  },
  {
    title: 'DELETE /workspaces/:id',
    method: 'delete',
    path: workspacePath,
    service: workspaceMock,
    serviceMethod: 'delete',
  },
  {
    title: 'GET /workspaces/:workspaceId/permissions',
    method: 'get',
    path: `${workspacePath}/permissions`,
    service: workspaceAccessMock,
    serviceMethod: 'findPermissions',
  },
  {
    title: 'GET /workspaces/:workspaceId/roles',
    method: 'get',
    path: `${workspacePath}/roles`,
    service: workspaceAccessMock,
    serviceMethod: 'findRoles',
  },
  {
    title: 'POST /workspaces/:workspaceId/roles',
    method: 'post',
    path: `${workspacePath}/roles`,
    body: {
      name: 'Reviewer',
      permissionCodes: [WORKSPACE_PERMISSION_CODES[0]],
    },
    status: 201,
    service: workspaceAccessMock,
    serviceMethod: 'createRole',
  },
  {
    title: 'PATCH /workspaces/:workspaceId/roles/:roleId',
    method: 'patch',
    path: `${workspacePath}/roles/${ids.role}`,
    body: { name: 'Updated reviewer' },
    service: workspaceAccessMock,
    serviceMethod: 'updateRole',
  },
  {
    title: 'GET /workspaces/:workspaceId/members',
    method: 'get',
    path: `${workspacePath}/members`,
    service: workspaceAccessMock,
    serviceMethod: 'findMembers',
  },
  {
    title: 'POST /workspaces/:workspaceId/members',
    method: 'post',
    path: `${workspacePath}/members`,
    body: { email: 'member@example.com', roleId: ids.role },
    status: 201,
    service: workspaceAccessMock,
    serviceMethod: 'addMember',
  },
  {
    title: 'PATCH /workspaces/:workspaceId/members/:memberId/role',
    method: 'patch',
    path: `${workspacePath}/members/${ids.member}/role`,
    body: { roleId: ids.role },
    service: workspaceAccessMock,
    serviceMethod: 'updateMemberRole',
  },
  {
    title: 'PATCH /workspaces/:workspaceId/members/:memberId/status',
    method: 'patch',
    path: `${workspacePath}/members/${ids.member}/status`,
    body: { status: 'ACTIVE' },
    service: workspaceAccessMock,
    serviceMethod: 'updateMemberStatus',
  },

  {
    title: 'POST /projects',
    method: 'post',
    path: `${workspacePath}/projects`,
    body: { name: 'Test project', key: 'TST' },
    status: 201,
    service: projectMock,
    serviceMethod: 'create',
  },
  {
    title: 'GET /projects',
    method: 'get',
    path: `${workspacePath}/projects`,
    service: projectMock,
    serviceMethod: 'findAll',
  },
  {
    title: 'GET /projects/:projectId',
    method: 'get',
    path: projectPath,
    service: projectMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'PATCH /projects/:projectId',
    method: 'patch',
    path: projectPath,
    body: { name: 'Updated project' },
    service: projectMock,
    serviceMethod: 'update',
  },
  {
    title: 'DELETE /projects/:projectId',
    method: 'delete',
    path: projectPath,
    service: projectMock,
    serviceMethod: 'delete',
  },
  {
    title: 'GET /projects/:projectId/members',
    method: 'get',
    path: `${projectPath}/members`,
    service: projectMock,
    serviceMethod: 'findMembers',
  },
  {
    title: 'POST /projects/:projectId/members',
    method: 'post',
    path: `${projectPath}/members`,
    body: { userId: ids.user },
    status: 201,
    service: projectMock,
    serviceMethod: 'addMember',
  },
  {
    title: 'DELETE /projects/:projectId/members/:userId',
    method: 'delete',
    path: `${projectPath}/members/${ids.user}`,
    service: projectMock,
    serviceMethod: 'removeMember',
  },
  {
    title: 'PATCH /projects/:projectId/status',
    method: 'patch',
    path: `${projectPath}/status`,
    body: { statusId: ids.status },
    service: projectMock,
    serviceMethod: 'transition',
  },

  {
    title: 'POST /tasks',
    method: 'post',
    path: tasksPath,
    body: { title: 'Implement feature', estimateHours: 2 },
    status: 201,
    service: taskMock,
    serviceMethod: 'create',
  },
  {
    title: 'GET /tasks',
    method: 'get',
    path: tasksPath,
    service: taskMock,
    serviceMethod: 'findAll',
  },
  {
    title: 'GET /tasks/:taskId',
    method: 'get',
    path: `${tasksPath}/${ids.task}`,
    service: taskMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'GET /tasks/:taskId/subtasks',
    method: 'get',
    path: `${tasksPath}/${ids.task}/subtasks`,
    service: taskMock,
    serviceMethod: 'findSubtasks',
  },
  {
    title: 'GET /tasks/:taskId/dependencies',
    method: 'get',
    path: `${tasksPath}/${ids.task}/dependencies`,
    service: taskMock,
    serviceMethod: 'findDependencies',
  },
  {
    title: 'POST /tasks/:taskId/dependencies',
    method: 'post',
    path: `${tasksPath}/${ids.task}/dependencies`,
    body: { dependsOnTaskId: ids.relatedTask },
    status: 201,
    service: taskMock,
    serviceMethod: 'addDependency',
  },
  {
    title: 'DELETE /tasks/:taskId/dependencies/:dependencyId',
    method: 'delete',
    path: `${tasksPath}/${ids.task}/dependencies/${ids.dependency}`,
    service: taskMock,
    serviceMethod: 'removeDependency',
  },
  {
    title: 'PATCH /tasks/:taskId',
    method: 'patch',
    path: `${tasksPath}/${ids.task}`,
    body: { title: 'Updated task' },
    service: taskMock,
    serviceMethod: 'update',
  },
  {
    title: 'DELETE /tasks/:taskId',
    method: 'delete',
    path: `${tasksPath}/${ids.task}`,
    service: taskMock,
    serviceMethod: 'delete',
  },
  {
    title: 'PATCH /tasks/:taskId/remaining',
    method: 'patch',
    path: `${tasksPath}/${ids.task}/remaining`,
    body: { remainingHours: 1 },
    service: taskMock,
    serviceMethod: 'updateRemaining',
  },
  {
    title: 'PATCH /tasks/:taskId/status',
    method: 'patch',
    path: `${tasksPath}/${ids.task}/status`,
    body: { status: 'IN_PROGRESS' },
    service: taskMock,
    serviceMethod: 'updateStatus',
  },
  {
    title: 'POST /tasks/:taskId/work-logs',
    method: 'post',
    path: `${tasksPath}/${ids.task}/work-logs`,
    body: { workDate: '2026-10-10', hours: 1 },
    status: 201,
    service: taskMock,
    serviceMethod: 'addWorkLog',
  },
  {
    title: 'GET /tasks/:taskId/work-logs',
    method: 'get',
    path: `${tasksPath}/${ids.task}/work-logs`,
    service: taskMock,
    serviceMethod: 'findWorkLogs',
  },
  {
    title: 'PATCH /tasks/:taskId/work-logs/:workLogId',
    method: 'patch',
    path: `${tasksPath}/${ids.task}/work-logs/${ids.workLog}`,
    body: { hours: 2, workDate: '2026-10-09' },
    service: taskMock,
    serviceMethod: 'updateWorkLog',
  },
  {
    title: 'DELETE /tasks/:taskId/work-logs/:workLogId',
    method: 'delete',
    path: `${tasksPath}/${ids.task}/work-logs/${ids.workLog}`,
    service: taskMock,
    serviceMethod: 'deleteWorkLog',
  },

  {
    title: 'POST /sprints',
    method: 'post',
    path: sprintsPath,
    body: {
      name: 'Sprint 1',
      startDate: '2026-10-10',
      endDate: '2026-10-24',
    },
    status: 201,
    service: sprintMock,
    serviceMethod: 'create',
  },
  {
    title: 'GET /sprints',
    method: 'get',
    path: sprintsPath,
    service: sprintMock,
    serviceMethod: 'findAll',
  },
  {
    title: 'GET /sprints/:sprintId',
    method: 'get',
    path: `${sprintsPath}/${ids.sprint}`,
    service: sprintMock,
    serviceMethod: 'findOne',
  },
  {
    title: 'POST /sprints/:sprintId/start',
    method: 'post',
    path: `${sprintsPath}/${ids.sprint}/start`,
    service: sprintMock,
    serviceMethod: 'start',
  },
  {
    title: 'POST /sprints/:sprintId/complete',
    method: 'post',
    path: `${sprintsPath}/${ids.sprint}/complete`,
    service: sprintMock,
    serviceMethod: 'complete',
  },
  {
    title: 'POST /sprints/:sprintId/cancel',
    method: 'post',
    path: `${sprintsPath}/${ids.sprint}/cancel`,
    service: sprintMock,
    serviceMethod: 'cancel',
  },
  {
    title: 'GET /sprints/:sprintId/tasks',
    method: 'get',
    path: `${sprintsPath}/${ids.sprint}/tasks`,
    service: sprintMock,
    serviceMethod: 'findTasks',
  },
  {
    title: 'POST /sprints/:sprintId/tasks',
    method: 'post',
    path: `${sprintsPath}/${ids.sprint}/tasks`,
    body: { taskId: ids.task },
    service: sprintMock,
    serviceMethod: 'assignTask',
  },
  {
    title: 'DELETE /sprints/:sprintId/tasks/:taskId',
    method: 'delete',
    path: `${sprintsPath}/${ids.sprint}/tasks/${ids.task}`,
    service: sprintMock,
    serviceMethod: 'removeTask',
  },
];

describe('API routes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AuthController,
        HealthController,
        HomeController,
        PostController,
        ProjectController,
        SprintController,
        TaskController,
        UserController,
        WorkspaceAccessController,
        WorkspaceController,
      ],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
        { provide: HealthCheckService, useValue: healthMock },
        {
          provide: HttpHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: { pingCheck: jest.fn() },
        },
        { provide: PostService, useValue: postMock },
        { provide: ProjectService, useValue: projectMock },
        { provide: SprintService, useValue: sprintMock },
        { provide: TaskService, useValue: taskMock },
        { provide: CollaborationService, useValue: collaborationMock },
        { provide: UserService, useValue: userMock },
        { provide: WorkspaceAccessService, useValue: workspaceAccessMock },
        { provide: WorkspaceService, useValue: workspaceMock },
      ],
    })
      .overrideGuard(WorkspacePermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        { method: RequestMethod.GET, path: '/' },
        { method: RequestMethod.GET, path: 'health' },
      ],
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
    const authGuard = new AuthGuard(app.get(Reflector), app.get(AuthService));
    app.useGlobalGuards(authGuard);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(apiCases)('$title routes successfully', async (apiCase) => {
    let testRequest: ReturnType<ReturnType<typeof request>['get']>;
    const server = request(app.getHttpServer());
    switch (apiCase.method) {
      case 'get':
        testRequest = server.get(apiCase.path);
        break;
      case 'post':
        testRequest = server.post(apiCase.path);
        break;
      case 'patch':
        testRequest = server.patch(apiCase.path);
        break;
      case 'delete':
        testRequest = server.delete(apiCase.path);
        break;
    }

    let result = testRequest.set('Authorization', 'Bearer test-access-token');
    if (apiCase.body) {
      result = result.send(apiCase.body);
    }
    if (apiCase.query) {
      result = result.query(apiCase.query);
    }

    const response = await result;
    expect(response.status).toBe(apiCase.status ?? 200);
    if (apiCase.service && apiCase.serviceMethod) {
      expect(apiCase.service[apiCase.serviceMethod]).toHaveBeenCalled();
    }
  });

  it('rejects unauthenticated access to a protected endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('rejects invalid DTOs and UUID path parameters before service dispatch', async () => {
    authMock.signIn.mockClear();
    authMock.forgotPassword.mockClear();
    authMock.verifyForgotPassword.mockClear();
    authMock.resetPassword.mockClear();
    userMock.findOne.mockClear();
    userMock.changePassword.mockClear();

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/login')
      .send({ email: 'not-an-email', password: '123' })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify/forgot-password')
      .send({ token: 'not-a-jwt' })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: validJwt,
        password: '123',
      })
      .expect(422);

    await request(app.getHttpServer())
      .post('/api/v1/users/me/change-password')
      .set('Authorization', 'Bearer test-access-token')
      .send({
        currentPassword: 'CurrentPassword123!',
        newPassword: '123',
      })
      .expect(422);

    await request(app.getHttpServer())
      .get('/api/v1/users/not-a-uuid')
      .set('Authorization', 'Bearer test-access-token')
      .expect(400);

    expect(authMock.signIn).not.toHaveBeenCalled();
    expect(authMock.forgotPassword).not.toHaveBeenCalled();
    expect(authMock.verifyForgotPassword).not.toHaveBeenCalled();
    expect(authMock.resetPassword).not.toHaveBeenCalled();
    expect(userMock.changePassword).not.toHaveBeenCalled();
    expect(userMock.findOne).not.toHaveBeenCalled();
  });

  it('requires authentication to change the current user password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/me/change-password')
      .send({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
      })
      .expect(401);
  });
});
