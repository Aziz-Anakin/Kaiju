import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Serveur temps réel qui garde une connexion ouverte avec chaque navigateur
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN?.split(',') } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté ${client.id}`);
  }

  // Envoie un événement à tous les navigateurs connectés
  broadcast(event: string, data: unknown) {
    this.server.emit(event, data);
  }
}
