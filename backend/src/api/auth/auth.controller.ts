import { CurrentUser } from '@/decorators/current-user.decorator';
import { ApiAuth, ApiPublic } from '@/decorators/http.decorators';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ForgotPasswordReqDto } from './dto/forgot-password.req.dto';
import { LoginReqDto } from './dto/login.req.dto';
import { LoginResDto } from './dto/login.res.dto';
import { PasswordActionResDto } from './dto/password-action.res.dto';
import { RefreshReqDto } from './dto/refresh.req.dto';
import { RefreshResDto } from './dto/refresh.res.dto';
import { RegisterReqDto } from './dto/register.req.dto';
import { RegisterResDto } from './dto/register.res.dto';
import { ResendEmailVerificationReqDto } from './dto/resend-email-verification.req.dto';
import { ResendEmailVerificationResDto } from './dto/resend-email-verification.res.dto';
import { ResetPasswordReqDto } from './dto/reset-password.req.dto';
import { VerifyEmailReqDto } from './dto/verify-email.req.dto';
import { VerifyForgotPasswordReqDto } from './dto/verify-forgot-password.req.dto';
import { VerifyForgotPasswordResDto } from './dto/verify-forgot-password.res.dto';
import { EMAIL_VERIFICATION_SUCCESS_PAGE } from './templates/email-verification-success.page';
import { JwtPayloadType } from './types/jwt-payload.type';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiPublic({
    type: LoginResDto,
    summary: 'Sign in',
  })
  @Post('email/login')
  async signIn(@Body() userLogin: LoginReqDto): Promise<LoginResDto> {
    return await this.authService.signIn(userLogin);
  }

  @ApiPublic({
    type: PasswordActionResDto,
    summary: 'Request password reset instructions',
  })
  @Post('email/register')
  async register(@Body() dto: RegisterReqDto): Promise<RegisterResDto> {
    return await this.authService.register(dto);
  }

  @ApiAuth({
    summary: 'Logout',
    errorResponses: [400, 401, 403, 500],
  })
  @Post('logout')
  async logout(@CurrentUser() userToken: JwtPayloadType): Promise<void> {
    await this.authService.logout(userToken);
  }

  @ApiPublic({
    type: RefreshResDto,
    summary: 'Refresh token',
  })
  @Post('refresh')
  async refresh(@Body() dto: RefreshReqDto): Promise<RefreshResDto> {
    return await this.authService.refreshToken(dto);
  }

  @ApiPublic()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordReqDto,
  ): Promise<PasswordActionResDto> {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiPublic({
    type: VerifyForgotPasswordResDto,
    summary: 'Verify a password reset token',
  })
  @HttpCode(HttpStatus.OK)
  @Post('verify/forgot-password')
  async verifyForgotPassword(
    @Body() dto: VerifyForgotPasswordReqDto,
  ): Promise<VerifyForgotPasswordResDto> {
    return this.authService.verifyForgotPassword(dto.token);
  }

  @ApiPublic({
    type: PasswordActionResDto,
    summary: 'Set a new password using a reset token',
  })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordReqDto,
  ): Promise<PasswordActionResDto> {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @ApiPublic({ summary: 'Verify email address' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Get('verify/email')
  async verifyEmail(@Query() dto: VerifyEmailReqDto): Promise<string> {
    await this.authService.verifyEmail(dto.token);
    return EMAIL_VERIFICATION_SUCCESS_PAGE;
  }

  @ApiPublic({
    type: ResendEmailVerificationResDto,
    summary: 'Resend email verification',
  })
  @Post('verify/email/resend')
  async resendVerifyEmail(
    @Body() dto: ResendEmailVerificationReqDto,
  ): Promise<ResendEmailVerificationResDto> {
    return this.authService.resendEmailVerification(dto.email);
  }
}
