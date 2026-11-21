import { IsArray, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export interface GoogleRestoreReceiptItem {
    productId?: string;
    purchaseToken?: string;
    transactionId?: string;
    packageName?: string;
    receipt?: string;
}

export type RestoreReceiptInput = string | GoogleRestoreReceiptItem;

export class RestoreDto {
    @IsArray()
    @IsNotEmpty()
    receipts: RestoreReceiptInput[];

    @IsOptional()
    @IsArray()
    purchases?: GoogleRestoreReceiptItem[];

    @IsEnum(PaymentProvider)
    @IsNotEmpty()
    provider: PaymentProvider;
}
