import { IsString, IsNotEmpty, MinLength, MaxLength, IsArray, ArrayMaxSize, IsOptional } from 'class-validator';

export class CreateAnswerDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Cevap içeriği en az 3 karakter olmalıdır' })
    @MaxLength(5000, { message: 'Cevap içeriği en fazla 5000 karakter olabilir' })
    content: string;

    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(5, { message: 'En fazla 5 resim ekleyebilirsiniz' })
    @IsOptional()
    imageUrls?: string[];
}
