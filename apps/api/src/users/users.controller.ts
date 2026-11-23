import { Controller, Get, Patch, Body, UseGuards, Post, BadRequestException, Req, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus, SubscriptionTier, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  generateSafeUploadFilename,
  MAX_UPLOAD_IMAGE_BYTES,
  readStreamWithLimit,
  resolveUploadsDir,
  sanitizeAndReencodeProfileImage,
} from '../common/utils/uploads';
import { extractClientTelemetry } from '../common/utils/client-telemetry';
import * as fs from 'fs';
import * as path from 'path';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string | null; // ISO date string

  @IsOptional()
  @IsNumber()
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string | null;

  @IsOptional()
  preferencesJson?: any;
}

class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  username!: string;
}

class ProfileUpdateDto {
  @IsOptional()
  @IsString()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  lastName?: string | null;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsNumber()
  heightCm?: number | null;

  @IsOptional()
  @IsNumber()
  weightKg?: number | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;
}

class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string | null;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsBoolean()
  pinEnabled?: boolean;

  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileUpdateDto)
  profile?: ProfileUpdateDto;
}

class AdminUpdateUserSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(SubscriptionTier)
  tier?: SubscriptionTier | null;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsNumber()
  aiMessagesLimit?: number;

  @IsOptional()
  @IsBoolean()
  resetAiUsage?: boolean;
}

class SetupPinDto {
  @IsString()
  @IsNotEmpty()
  pin!: string;
}

class VerifyPinDto {
  @IsString()
  @IsNotEmpty()
  pin!: string;
}

class DisablePinDto {
  @IsString()
  @IsNotEmpty()
  pin!: string;
}

class ChangePinDto {
  @IsString()
  @IsNotEmpty()
  oldPin!: string;

  @IsString()
  @IsNotEmpty()
  newPin!: string;
}

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('users/check-username')
  @ApiOperation({ summary: 'Check username availability' })
  async checkUsernameAvailability(@Query('username') username: string) {
    if (!username) {
      throw new BadRequestException('Username is required');
    }
    const available = await this.usersService.isUsernameAvailable(username);
    return { available };
  }

  @Patch('me/username')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user username' })
  async updateMyUsername(@CurrentUser() user: any, @Body() dto: UpdateUsernameDto) {
    return this.usersService.updateUsername(user.id, dto.username);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.getUserWithProfile(user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@CurrentUser() user: any, @Body() dto: UpdateProfileDto, @Req() req: any) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    if (dto.preferencesJson?.kvkkConsents) {
      await this.usersService
        .recordKvkkConsentHistory(
          user.id,
          dto.preferencesJson.kvkkConsents,
          extractClientTelemetry(req),
        )
        .catch(() => {});
    }
    return updated;
  }

  @Post('me/client-error')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report mobile runtime error for diagnostics' })
  async reportClientError(
    @CurrentUser() user: any,
    @Body()
    body: {
      message: string;
      stack?: string;
      path?: string;
      level?: string;
      metadataJson?: any;
    },
    @Req() req: any,
  ) {
    return this.usersService.recordClientError(
      user.id,
      body,
      extractClientTelemetry(req),
    );
  }

  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteMe(@CurrentUser() user: any) {
    return this.usersService.deleteUser(user.id);
  }

  @Get('me/export')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export all user data' })
  async exportMyData(@CurrentUser() user: any) {
    return this.usersService.exportUserData(user.id);
  }

  @Post('me/backup-email')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send portable JSON backup to user email' })
  async sendBackupToEmail(@CurrentUser() user: any) {
    return this.usersService.sendBackupToEmail(user.id);
  }

  @Post('me/restore-backup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore user data from portable JSON backup' })
  async restoreBackup(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.restoreUserBackup(user.id, body);
  }

  @Get('me/retention-offer')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active in-app retention offer & heartbeat' })
  async getMyRetentionOffer(@CurrentUser() user: any) {
    return this.usersService.getMyRetentionOffer(user.id);
  }

  @Post('me/retention-offer/ack')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss or claim retention offer' })
  async ackMyRetentionOffer(
    @CurrentUser() user: any,
    @Body() body: { action?: 'dismiss' | 'claim' },
  ) {
    return this.usersService.ackMyRetentionOffer(
      user.id,
      body?.action === 'claim' ? 'claim' : 'dismiss',
    );
  }

  // Admin endpoints
  @Post('users')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create user (Admin)' })
  async createUser(@Body() dto: any) {
    return this.usersService.createUser(dto);
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin)' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getAllUsers(pageNum, limitNum);
  }

  @Get('users/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (Admin)' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch('users/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (Admin)' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Patch('users/:id/subscription')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert or update user subscription (Admin)' })
  async updateUserSubscription(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserSubscriptionDto,
  ) {
    return this.usersService.adminUpdateUserSubscription(id, dto);
  }

  @Get('users/:id/export')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export user KVKK data (Admin)' })
  async exportUserDataAdmin(@Param('id') id: string) {
    return this.usersService.exportUserData(id);
  }

  @Delete('users/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (Admin)' })
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Post('me/profile-picture')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  async uploadProfilePicture(@CurrentUser() user: any, @Req() req: any) {
    let writtenFilePath: string | null = null;
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('File is required');
      }

      // Read stream within byte limit, then decode & re-encode actual image pixels
      // (never trust client MIME type or original filename/extension)
      let rawBuffer: Buffer;
      try {
        rawBuffer = await readStreamWithLimit(data.file, MAX_UPLOAD_IMAGE_BYTES);
      } catch (readError: any) {
        throw new BadRequestException(
          readError?.message || 'Image file exceeds maximum allowed size',
        );
      }

      let processedImage;
      try {
        processedImage = await sanitizeAndReencodeProfileImage(rawBuffer);
      } catch {
        throw new BadRequestException(
          'Invalid or unsupported image content (allowed: valid jpg, png, gif, webp)',
        );
      }

      const filename = generateSafeUploadFilename(processedImage.extension);
      const uploadDir = path.join(resolveUploadsDir(), 'profiles');
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, filename);
      await fs.promises.writeFile(filePath, processedImage.buffer, { mode: 0o644 });
      writtenFilePath = filePath;

      const relativePath = path.posix.join('profiles', filename);
      const defaultApiBase =
        process.env.NODE_ENV === 'production'
          ? 'https://api.kadinatlasi.com'
          : 'http://localhost:4000';
      const baseUrl = (process.env.API_BASE_URL || defaultApiBase).replace(/\/+$/, '');
      const profilePictureUrl = `${baseUrl}/uploads/${relativePath}`;

      // Persist server-side file ownership record and update profile URL atomically
      try {
        await this.usersService.saveUploadedProfilePicture(user.id, {
          relativePath,
          mimeType: processedImage.mimeType,
          sizeBytes: processedImage.buffer.length,
          profilePictureUrl,
        });
      } catch (updateError) {
        await fs.promises.unlink(filePath).catch(() => undefined);
        writtenFilePath = null;
        console.error('Failed to update profile:', updateError);
        throw new BadRequestException('Failed to update profile with picture URL');
      }

      return { profilePictureUrl };
    } catch (error) {
      if (writtenFilePath) {
        await fs.promises.unlink(writtenFilePath).catch(() => undefined);
      }
      console.error('Upload error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload profile picture');
    }
  }

  // PIN Management Endpoints
  @Get('me/pin-status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get PIN status for current user' })
  async getPinStatus(@CurrentUser() user: any) {
    return this.usersService.getPinStatus(user.id);
  }

  @Post('me/pin/setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup PIN for app lock' })
  async setupPin(@CurrentUser() user: any, @Body() dto: SetupPinDto) {
    return this.usersService.setupPin(user.id, dto.pin);
  }

  @Post('me/pin/verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify PIN' })
  async verifyPin(@CurrentUser() user: any, @Body() dto: VerifyPinDto) {
    return this.usersService.verifyPin(user.id, dto.pin);
  }

  @Post('me/pin/disable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable PIN lock' })
  async disablePin(@CurrentUser() user: any, @Body() dto: DisablePinDto) {
    return this.usersService.disablePin(user.id, dto.pin);
  }

  @Patch('me/pin/change')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change PIN' })
  async changePin(@CurrentUser() user: any, @Body() dto: ChangePinDto) {
    return this.usersService.changePin(user.id, dto.oldPin, dto.newPin);
  }

  @Patch('me/password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
