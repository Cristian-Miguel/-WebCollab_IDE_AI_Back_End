import { Server } from './server';

export const server = new Server();
export const app = server.getApp();
export const httpServer = server.getHttpServer();
export const io = server.getIO();

if (process.env.NODE_ENV !== 'test') {
    server.listen();
}
