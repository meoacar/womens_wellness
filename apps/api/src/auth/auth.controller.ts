import { Body, Controller, Post, UnauthorizedException, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { MailService } from '../mail/mail.service';
import { join } from 'path';

class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string; // ISO date string
}

class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // Can be email or username

  @IsString()
  @IsNotEmpty()
  password!: string;
}

class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly mailService: MailService,
  ) { }

  @Get('check-email')
  @ApiOperation({ summary: 'Check if email is available' })
  async checkEmail(@Query('email') email: string) {
    if (!email) {
      return { available: false };
    }
    const available = await this.authService.isEmailAvailable(email);
    return { available };
  }

  @Get('check-username')
  @ApiOperation({ summary: 'Check if username is available' })
  async checkUsername(@Query('username') username: string) {
    if (!username) {
      return { available: false };
    }
    const available = await this.authService.isUsernameAvailable(username);
    return { available };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register with email, username, and password' })
  async register(@Body() dto: RegisterDto) {
    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;
    return this.authService.register(
      dto.email,
      dto.password,
      dto.username,
      dto.firstName,
      dto.lastName,
      dateOfBirth,
    );
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email/username and password' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('google')
  @ApiOperation({ summary: 'Login with Google ID token' })
  async googleLogin(@Body() dto: GoogleAuthDto) {
    return this.googleAuthService.exchangeIdToken(dto.idToken);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    try {
      const token = await this.authService.requestPasswordReset(dto.email);

      // Only send email if token is not 'success' (which means user exists)
      if (token !== 'success') {
        await this.mailService.sendPasswordResetEmail(dto.email, token);
      }

      // Always return success to prevent email enumeration
      return {
        message: 'Eğer bu e-posta adresine kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderilecektir.',
      };
    } catch (error) {
      // Log the error for debugging but still return success to prevent email enumeration
      console.error('Password reset error:', error);

      // Always return success to prevent email enumeration
      return {
        message: 'Eğer bu e-posta adresine kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderilecektir.',
      };
    }
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      message: 'Şifreniz başarıyla sıfırlandı. Artık yeni şifrenizle giriş yapabilirsiniz.',
    };
  }

  @Get('verify-reset-token')
  @ApiOperation({ summary: 'Verify if reset token is valid' })
  async verifyResetToken(@Query('token') token: string) {
    const isValid = await this.authService.verifyResetToken(token);
    return { isValid };
  }

  @Get('reset-password')
  @ApiOperation({ summary: 'Serve password reset page' })
  async serveResetPasswordPage(@Res() res: FastifyReply) {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'public', 'reset-password.html');

    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, 'utf-8');
      return res.type('text/html').send(html);
    } else {
      return res.status(404).send({ message: 'Reset password page not found' });
    }
  }
}
