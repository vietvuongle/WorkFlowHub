import { Uuid } from '@/common/types/common.type';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { In, Repository } from 'typeorm';
import { ProjectMemberEntity } from '../project/entities/project-member.entity';
import { TaskEntity } from '../task/entities/task.entity';
import { CreateTaskCommentReqDto } from './dto/create-task-comment.req.dto';
import { NotificationResDto } from './dto/notification.res.dto';
import { TaskCommentResDto } from './dto/task-comment.res.dto';
import {
  NotificationEntity,
  NotificationType,
} from './entities/notification.entity';
import { TaskCommentEntity } from './entities/task-comment.entity';
import { CollaborationGateway } from './realtime/collaboration.gateway';

@Injectable()
export class CollaborationService {
  constructor(
    @InjectRepository(ProjectMemberEntity)
    private readonly projectMemberRepository: Repository<ProjectMemberEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(TaskCommentEntity)
    private readonly commentRepository: Repository<TaskCommentEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly gateway: CollaborationGateway,
  ) {}

  async findTaskComments(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<TaskCommentResDto[]> {
    await this.assertTaskAccess(workspaceId, projectId, taskId, actorId);
    const comments = await this.commentRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return plainToInstance(TaskCommentResDto, comments);
  }

  async createTaskComment(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
    dto: CreateTaskCommentReqDto,
  ): Promise<TaskCommentResDto> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const task = await this.taskRepository.findOneBy({ id: taskId, projectId });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const mentionedUserIds = Array.from(
      new Set(dto.mentionedUserIds ?? []),
    ).filter((userId) => userId !== actorId) as Uuid[];
    if (mentionedUserIds.length > 0) {
      const projectMembers = await this.projectMemberRepository.find({
        where: { projectId, userId: In(mentionedUserIds) },
        select: { userId: true },
      });
      if (projectMembers.length !== mentionedUserIds.length) {
        throw new BadRequestException(
          'Mentioned users must be members of this project.',
        );
      }
    }

    const { comment, notifications: savedNotifications } =
      await this.commentRepository.manager.transaction(async (manager) => {
        const comments = manager.getRepository(TaskCommentEntity);
        const notifications = manager.getRepository(NotificationEntity);
        const savedComment = await comments.save(
          comments.create({
            taskId,
            authorUserId: actorId,
            content: dto.content.trim(),
            mentionedUserIds,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );

        const savedNotifications =
          mentionedUserIds.length === 0
            ? []
            : await notifications.save(
                mentionedUserIds.map((recipientUserId) =>
                  notifications.create({
                    recipientUserId,
                    actorUserId: actorId,
                    taskId,
                    commentId: savedComment.id,
                    type: NotificationType.TASK_COMMENT_MENTION,
                    taskKey: task.key,
                    contentPreview: this.createPreview(savedComment.content),
                    readAt: null,
                    createdBy: actorId,
                    updatedBy: actorId,
                  }),
                ),
              );

        return { comment: savedComment, notifications: savedNotifications };
      });

    for (const notification of savedNotifications) {
      this.gateway.publishNotification(
        notification.recipientUserId,
        plainToInstance(NotificationResDto, notification),
      );
    }

    return plainToInstance(TaskCommentResDto, comment);
  }

  private async assertTaskAccess(
    workspaceId: Uuid,
    projectId: Uuid,
    taskId: Uuid,
    actorId: Uuid,
  ): Promise<void> {
    await this.assertProjectMember(workspaceId, projectId, actorId);
    const taskExists = await this.taskRepository.exists({
      where: { id: taskId, projectId },
    });
    if (!taskExists) {
      throw new NotFoundException('Task not found');
    }
  }

  private async assertProjectMember(
    workspaceId: Uuid,
    projectId: Uuid,
    userId: Uuid,
  ): Promise<void> {
    const isMember = await this.projectMemberRepository.exists({
      where: { projectId, userId, project: { workspaceId } },
    });
    if (!isMember) {
      throw new NotFoundException('Project not found');
    }
  }

  private createPreview(content: string): string {
    return content.length > 255 ? `${content.slice(0, 252)}...` : content;
  }
}
