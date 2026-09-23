import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'Camiseta' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 19.99, description: 'Preço unitário, até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(21_474_836)
  price: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Maria Silva', description: 'Contendo "fail" simula falha técnica no worker' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
