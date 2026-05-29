import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { CommentType } from '@support-hub/database';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;
}
