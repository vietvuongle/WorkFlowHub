import { SetMetadata } from '@nestjs/common';
import {
  WORKSPACE_PERMISSION_METADATA,
  WorkspacePermission,
} from '../constants/workspace-permission.constant';

export const WorkspacePermissions = (...permissions: WorkspacePermission[]) =>
  SetMetadata(WORKSPACE_PERMISSION_METADATA, permissions);
