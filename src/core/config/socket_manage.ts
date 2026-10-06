import { Socket, Server } from 'socket.io';

/**
 * Clase para manejar los eventos de Socket.io.
 * Mantiene la estructura de tu archivo original (SocketManageEvent).
 */
export class SocketManageEvent {
    
    // El 'io' es la instancia global del servidor de sockets.
    // El 'socket' es el cliente que se acaba de conectar.
    constructor(private socket: Socket, private io: Server) {
        console.log(`[Socket] Client connected: ${this.socket.id}`);
        this.setupListeners();
    }

    private setupListeners(): void {
        // Define aquí los listeners de eventos para el socket conectado
        this.socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${this.socket.id}`);
        });

        // Ejemplo de evento
        // this.socket.on('new-message', (payload: { message: string }) => {
        //     console.log(`Received message: ${payload.message}`);
        //     // Envía el mensaje a todos los clientes
        //     this.io.emit('message-from-server', { sender: this.socket.id, message: payload.message });
        // });
    }
}
