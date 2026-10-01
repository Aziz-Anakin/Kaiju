import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let emit: jest.Mock;

  beforeEach(() => {
    gateway = new EventsGateway();
    emit = jest.fn();
    gateway.server = { emit } as any;
  });

  it('envoie un événement stock-changed', () => {
    gateway.broadcast('stock-changed', { quarter: 'A' });

    expect(emit).toHaveBeenCalledWith('stock-changed', { quarter: 'A' });
  });

  it('envoie un événement transfer-changed', () => {
    gateway.broadcast('transfer-changed', { id: 1 });

    expect(emit).toHaveBeenCalledWith('transfer-changed', { id: 1 });
  });

  it('envoie un événement disaster-level-changed', () => {
    gateway.broadcast('disaster-level-changed', { quarter: 'X', level: 3 });

    expect(emit).toHaveBeenCalledWith('disaster-level-changed', {
      quarter: 'X',
      level: 3,
    });
  });
});
