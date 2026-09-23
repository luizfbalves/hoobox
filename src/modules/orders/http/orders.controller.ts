import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CorrelationId } from "../../../core/logging/correlation-id.decorator.js";
import { UserRole } from "../../../generated/prisma/enums.js";
import { Roles } from "../../auth/roles.decorator.js";
import { CreateOrderUseCase } from "../application/create-order.use-case.js";
import { OrderQueries } from "../application/order-queries.js";
import { ReprocessOrderUseCase } from "../application/reprocess-order.use-case.js";
import { CreateOrderDto } from "./dtos/create-order.dto.js";
import { ListOrdersQueryDto } from "./dtos/list-orders-query.dto.js";

@ApiTags("orders")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Token ausente, inválido ou expirado" })
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly queries: OrderQueries,
    private readonly reprocessOrder: ReprocessOrderUseCase,
  ) {}

  @Get()
  list(@Query() query: ListOrdersQueryDto) {
    return this.queries.list(query.page, query.limit);
  }

  @ApiNotFoundResponse({ description: "Pedido inexistente" })
  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.queries.getById(id);
  }

  @ApiAcceptedResponse({ description: "Pedido aceito como PENDING; processamento assíncrono" })
  @ApiNotFoundResponse({ description: "Produto inexistente" })
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() body: CreateOrderDto, @CorrelationId() correlationId: string) {
    return this.createOrder.execute(body, correlationId);
  }

  @ApiAcceptedResponse({ description: "Pedido voltou para PENDING e foi reenfileirado" })
  @ApiForbiddenResponse({ description: "Requer role ADMIN" })
  @ApiNotFoundResponse({ description: "Pedido inexistente" })
  @ApiConflictResponse({ description: "Pedido não está FAILED" })
  @Post(":id/reprocess")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  reprocess(
    @Param("id", ParseIntPipe) id: number,
    @CorrelationId() correlationId: string,
  ) {
    return this.reprocessOrder.execute(id, correlationId);
  }
}
