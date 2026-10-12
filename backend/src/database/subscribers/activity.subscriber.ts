import { TaskCommentEntity } from '@/api/collaboration/entities/task-comment.entity';
import { ProjectEntity } from '@/api/project/entities/project.entity';
import { SprintEntity } from '@/api/sprint/entities/sprint.entity';
import { TaskAttachmentEntity } from '@/api/task/entities/task-attachment.entity';
import { TaskDependencyEntity } from '@/api/task/entities/task-dependency.entity';
import { TaskEntity } from '@/api/task/entities/task.entity';
import { WorkLogEntity } from '@/api/task/entities/work-log.entity';
import { WorkspaceEntity } from '@/api/workspace/entities/workspace.entity';
import { Uuid } from '@/common/types/common.type';
import { ActivityLogEntity } from '@/database/entities/activity-log.entity';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';

type AuditedEntity =
  | WorkspaceEntity
  | ProjectEntity
  | TaskEntity
  | SprintEntity
  | TaskCommentEntity
  | TaskDependencyEntity
  | TaskAttachmentEntity
  | WorkLogEntity;

type ActivityScope = {
  workspaceId: Uuid;
  projectId: Uuid | null;
  taskId: Uuid | null;
};

const AUDIT_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  ['WorkspaceEntity', ['name', 'slug', 'description']],
  ['ProjectEntity', ['name', 'key', 'description', 'statusId']],
  [
    'TaskEntity',
    [
      'key',
      'title',
      'description',
      'status',
      'estimateMinutes',
      'loggedMinutes',
      'remainingMinutes',
      'parentTaskId',
      'sprintId',
    ],
  ],
  ['SprintEntity', ['name', 'status', 'startDate', 'endDate']],
  ['TaskCommentEntity', ['taskId', 'mentionedUserIds']],
  ['TaskDependencyEntity', ['taskId', 'dependsOnTaskId']],
  [
    'TaskAttachmentEntity',
    ['taskId', 'originalFilename', 'contentType', 'sizeBytes', 'status'],
  ],
  ['WorkLogEntity', ['taskId', 'workDate', 'durationMinutes']],
]);

@EventSubscriber()
export class ActivitySubscriber implements EntitySubscriberInterface {
  afterInsert(event: InsertEvent<unknown>): Promise<void> {
    return this.record(event, 'created');
  }

  afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    return this.record(event, 'updated');
  }

  afterRemove(event: RemoveEvent<unknown>): Promise<void> {
    return this.record(event, 'deleted');
  }

  private async record(
    event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>,
    action: string,
  ): Promise<void> {
    const entityType = event.metadata.name;
    const fields = AUDIT_FIELDS.get(entityType);
    const eventEntity =
      event.entity ??
      ('databaseEntity' in event ? event.databaseEntity : undefined);
    const entity = eventEntity as
      | (Partial<AuditedEntity> & {
          id?: Uuid;
          createdBy?: string;
          updatedBy?: string;
        })
      | undefined;
    const entityId =
      entity?.id ??
      ('entityId' in event ? (event.entityId as Uuid) : undefined);
    if (!fields || !entity || !entityId) {
      return;
    }

    const scope = await this.resolveScope(event, entityType, entity);
    if (!scope) {
      return;
    }

    const metadata = Object.fromEntries(
      fields
        .filter((field) => field in entity)
        .map((field) => [
          field,
          this.toJsonValue(entity[field as keyof typeof entity]),
        ]),
    );
    const actorId = entity.updatedBy ?? entity.createdBy ?? 'system';

    await event.manager.insert(ActivityLogEntity, {
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      taskId: scope.taskId,
      entityType: entityType.replace('Entity', '').toUpperCase(),
      entityId,
      action,
      actorId,
      metadata,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  private async resolveScope(
    event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>,
    entityType: string,
    entity: Partial<AuditedEntity>,
  ): Promise<ActivityScope | null> {
    if (entityType === 'WorkspaceEntity') {
      return {
        workspaceId: (entity as WorkspaceEntity).id,
        projectId: null,
        taskId: null,
      };
    }

    let projectId: Uuid | null =
      'projectId' in entity ? (entity.projectId ?? null) : null;
    let taskId: Uuid | null =
      entityType === 'TaskEntity' ? (entity as TaskEntity).id : null;

    if (
      entityType === 'TaskCommentEntity' ||
      entityType === 'TaskAttachmentEntity' ||
      entityType === 'WorkLogEntity'
    ) {
      taskId = (
        entity as TaskCommentEntity | TaskAttachmentEntity | WorkLogEntity
      ).taskId;
      const task = await event.manager.findOne(TaskEntity, {
        where: { id: taskId },
        select: { projectId: true },
      });
      projectId = task?.projectId ?? null;
    }

    if (!projectId) {
      return null;
    }

    const project =
      entityType === 'ProjectEntity'
        ? (entity as ProjectEntity)
        : await event.manager.findOne(ProjectEntity, {
            where: { id: projectId },
            select: { id: true, workspaceId: true },
          });
    if (!project?.workspaceId) {
      return null;
    }

    return {
      workspaceId: project.workspaceId,
      projectId,
      taskId,
    };
  }

  private toJsonValue(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value) || value === null) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return undefined;
  }
}
