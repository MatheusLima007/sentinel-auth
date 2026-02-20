import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'demo@local.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Demo@12345' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'demo-web' })
  @IsString()
  @IsNotEmpty()
  appId!: string;
}
