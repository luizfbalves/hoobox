import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
