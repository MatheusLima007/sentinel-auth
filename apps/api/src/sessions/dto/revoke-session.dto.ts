import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RevokeSessionDto {
  @ApiProperty({ example: 'f6a40769-4f50-432c-bfce-b1bb6d17ae4d' })
  @IsString()
  sessionId!: string;
}
