import { Uuid } from '@/common/types/common.type';
import { ActivityLogEntity } from '@/database/entities/activity-log.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import {
  WorkspaceMemberEntity,
  WorkspaceMemberStatus,
} from '../workspace/entities/workspace-member.entity';
import { ActivityLogResDto } from './dto/activity-log.res.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepository: Repository<WorkspaceMemberEntity>,
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>,
  ) {}

  async findWorkspaceActivity(
    workspaceId: Uuid,
    userId: Uuid,
  ): Promise<ActivityLogResDto[]> {
    const isMember = await this.workspaceMemberRepository.exists({
      where: { workspaceId, userId, status: WorkspaceMemberStatus.ACTIVE },
    });
    if (!isMember) {
      throw new NotFoundException('Workspace not found');
    }

    const events = await this.activityLogRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 100,
    });
    return plainToInstance(ActivityLogResDto, events);
  }
}
