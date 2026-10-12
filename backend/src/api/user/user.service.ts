import { CursorPaginationDto } from '@/common/dto/cursor-pagination/cursor-pagination.dto';
import { CursorPaginatedDto } from '@/common/dto/cursor-pagination/paginated.dto';
import { OffsetPaginatedDto } from '@/common/dto/offset-pagination/paginated.dto';
import { Uuid } from '@/common/types/common.type';
import { AllConfigType } from '@/config/config.type';
import { SYSTEM_USER_ID } from '@/constants/app.constant';
import { CacheKey } from '@/constants/cache.constant';
import { ErrorCode } from '@/constants/error-code.constant';
import { ValidationException } from '@/exceptions/validation.exception';
import { createCacheKey } from '@/utils/cache.util';
import { buildPaginator } from '@/utils/cursor-pagination';
import { paginate } from '@/utils/offset-pagination';
import { verifyPassword } from '@/utils/password.util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import assert from 'assert';
import { Cache } from 'cache-manager';
import { plainToInstance } from 'class-transformer';
import ms from 'ms';
import { Repository } from 'typeorm';
import { CreateUserReqDto } from './dto/create-user.req.dto';
import { ListUserReqDto } from './dto/list-user.req.dto';
import { LoadMoreUsersReqDto } from './dto/load-more-users.req.dto';
import { UpdateUserReqDto } from './dto/update-user.req.dto';
import { UserResDto } from './dto/user.res.dto';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateUserReqDto): Promise<UserResDto> {
    const { username, email, password, bio, image } = dto;

    // check uniqueness of username/email
    const user = await this.userRepository.findOne({
      where: [
        {
          username,
        },
        {
          email,
        },
      ],
    });

    if (user) {
      throw new ValidationException(ErrorCode.E001);
    }

    const newUser = new UserEntity({
      username,
      email,
      password,
      bio,
      image,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });

    const savedUser = await this.userRepository.save(newUser);
    this.logger.debug(savedUser);

    return plainToInstance(UserResDto, savedUser);
  }

  async findAll(
    reqDto: ListUserReqDto,
  ): Promise<OffsetPaginatedDto<UserResDto>> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');
    const [users, metaDto] = await paginate<UserEntity>(query, reqDto, {
      skipCount: false,
      takeAll: false,
    });
    return new OffsetPaginatedDto(plainToInstance(UserResDto, users), metaDto);
  }

  async loadMoreUsers(
    reqDto: LoadMoreUsersReqDto,
  ): Promise<CursorPaginatedDto<UserResDto>> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    const paginator = buildPaginator({
      entity: UserEntity,
      alias: 'user',
      paginationKeys: ['createdAt'],
      query: {
        limit: reqDto.limit,
        order: 'DESC',
        afterCursor: reqDto.afterCursor,
        beforeCursor: reqDto.beforeCursor,
      },
    });

    const { data, cursor } = await paginator.paginate(queryBuilder);

    const metaDto = new CursorPaginationDto(
      data.length,
      cursor.afterCursor,
      cursor.beforeCursor,
      reqDto,
    );

    return new CursorPaginatedDto(plainToInstance(UserResDto, data), metaDto);
  }

  async findOne(id: Uuid): Promise<UserResDto> {
    assert(id, 'id is required');
    const user = await this.userRepository.findOneByOrFail({ id });

    return user.toDto(UserResDto);
  }

  async update(id: Uuid, updateUserDto: UpdateUserReqDto) {
    const user = await this.userRepository.findOneByOrFail({ id });

    user.bio = updateUserDto.bio;
    user.image = updateUserDto.image;
    user.updatedBy = SYSTEM_USER_ID;

    await this.userRepository.save(user);
  }

  async remove(id: Uuid) {
    await this.userRepository.findOneByOrFail({ id });
    await this.userRepository.softDelete(id);
  }

  async changePassword(
    userId: Uuid,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.updatePasswordAndRevokeSessions(user, newPassword);
    await this.cacheManager.del(
      createCacheKey(CacheKey.PASSWORD_RESET, user.id),
    );
  }

  async resetPassword(userId: Uuid, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    await this.updatePasswordAndRevokeSessions(user, newPassword);
  }

  private async updatePasswordAndRevokeSessions(
    user: UserEntity,
    password: string,
  ): Promise<void> {
    user.password = password;
    user.updatedBy = user.id;
    await this.userRepository.save(user);

    const sessions = await this.sessionRepository.find({
      where: { userId: user.id },
      select: ['id', 'createdAt'],
    });
    const accessTokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });
    const now = Date.now();

    await Promise.all(
      sessions.map(async (session) => {
        const expiresAt =
          new Date(session.createdAt).getTime() + ms(accessTokenExpiresIn);
        const ttl = expiresAt - now;
        if (ttl > 0) {
          await this.cacheManager.store.set<boolean>(
            createCacheKey(CacheKey.SESSION_BLACKLIST, session.id),
            true,
            ttl,
          );
        }
      }),
    );

    await this.sessionRepository.delete({ userId: user.id });
  }
}
