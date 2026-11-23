import { IsString, IsNotEmpty, IsEnum, IsArray, IsBoolean, IsOptional, MaxLength, MinLength, ArrayMaxSize } from 'class-validator';
import { QuestionCategory, QuestionStatus } from '@prisma/client';

export class CreateQuestionDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Soru başlığı en az 3 karakter olmalıdır' })
    @MaxLength(300, { message: 'Soru başlığı en fazla 300 karakter olabilir' })
    title: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: 'Soru içeriği en az 5 karakter olmalıdır' })
    @MaxLength(10000, { message: 'Soru içeriği en fazla 10000 karakter olabilir' })
    content: string;

    @IsEnum(QuestionCategory, { message: 'Geçersiz kategori' })
    category: QuestionCategory;

    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10, { message: 'En fazla 10 etiket ekleyebilirsiniz' })
    @IsOptional()
    tags?: string[];

    @IsBoolean()
    @IsOptional()
    isAnonymous?: boolean;

    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(5, { message: 'En fazla 5 resim ekleyebilirsiniz' })
    @IsOptional()
    imageUrls?: string[];
}

export class AdminCreateQuestionDto extends CreateQuestionDto {
    @IsEnum(QuestionStatus, { message: 'Geçersiz durum' })
    @IsOptional()
    status?: QuestionStatus;

    @IsBoolean()
    @IsOptional()
    isPremium?: boolean;
}
