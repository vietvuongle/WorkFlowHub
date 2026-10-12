export const WORKSPACE_PERMISSIONS = {
  READ: 'workspace.read',
  UPDATE: 'workspace.update',
  DELETE: 'workspace.delete',
  MEMBERS_READ: 'members.read',
  MEMBERS_MANAGE: 'members.manage',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  PROJECTS_READ: 'projects.read',
  PROJECTS_MANAGE: 'projects.manage',
  WORKFLOW_MANAGE: 'workflow.manage',
  TASKS_READ: 'tasks.read',
  TASKS_MANAGE: 'tasks.manage',
  ACTIVITY_READ: 'activity.read',
} as const;

export type WorkspacePermission =
  (typeof WORKSPACE_PERMISSIONS)[keyof typeof WORKSPACE_PERMISSIONS];

export const WORKSPACE_PERMISSION_CODES: WorkspacePermission[] = Object.values(
  WORKSPACE_PERMISSIONS,
);

export const WORKSPACE_PERMISSION_METADATA = 'workspace:permissions';
