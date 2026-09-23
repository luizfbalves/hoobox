export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: number;
  toPayload(): Record<string, string | number>;
}

export function toOutboxRow(event: DomainEvent) {
  return {
    aggregateId: event.aggregateId,
    eventType: event.type,
    payload: event.toPayload(),
  };
}
