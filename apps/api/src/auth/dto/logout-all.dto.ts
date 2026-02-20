import { IsOptional, IsString } from 'class-validator';

export class LogoutAllDto {
  @IsString()
  @IsOptional()
  appId?: string;
}
