import * as dotenv from 'dotenv';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { LoggerManage } from './core/config/logger';

import { SocketManageEvent } from './core/config/socket_manage';
import { SessionPresenceSocket } from './modules/session/session.presence.socket';
import { SessionCleanupJob, sessionCleanupJob } from './modules/session/session.cleanup.job';
import { EditorYjsSocket } from './modules/editor/editor.yjs.socket';
import AuthRoutes from './feature/auth/auth_routes';
import SessionRoutes from './modules/session/session.routes';
import AIRoutes from './modules/ai-assistant/ai.routes';
import { exceptionManage } from './core/exception/exception_manage';
import UserRoutes from './feature/user/user_routes';
import cookieParser from 'cookie-parser';

/**
 * Clase que gestiona la configuración y el arranque del servidor Express con TypeScript.
 * Se encarga de middlewares, rutas, y la inicialización de Socket.io y y-websocket.
 */
export class Server {
    private app: Express;
    private port: number | string;
    private httpServer: http.Server;
    private io: SocketIOServer;
    private presenceSocket: SessionPresenceSocket;
    private yjsSocket: EditorYjsSocket;
    private cleanupJob: SessionCleanupJob;
    private mainRoute: string;
    private routesSrc: { [key: string]: string };
    private allowedOrigins: string[];

    constructor() {
        dotenv.config();
        this.allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean);

        this.app = express();
        this.port = process.env.PORT || 3000;
        this.httpServer = http.createServer(this.app);

        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: this.allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            destroyUpgrade: false,
        });

        this.presenceSocket = new SessionPresenceSocket();
        this.yjsSocket = new EditorYjsSocket();
        this.cleanupJob = sessionCleanupJob;

        this.mainRoute = '/api/v1';
        this.routesSrc = this.routesSource();

        this.middlewares();
        this.routes();
        this.socket();
    }

    /**
     * Configura los middlewares globales de Express (CORS, Helmet, Morgan, Body Parser).
     */
    private middlewares(): void {
        this.app.use(
            cors({
                origin: this.allowedOrigins,
                methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
                credentials: true,
            })
        );

        this.app.use(helmet());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.static('public'));
        this.app.use(cookieParser());
    }

    /**
     * Define las rutas base para los módulos.
     */
    private routesSource(): { [key: string]: string } {
        return {
            auth: `${this.mainRoute}/auth`,
            user: `${this.mainRoute}/user`,
            sessions: `${this.mainRoute}/sessions`,
            ai: `${this.mainRoute}/ai`,
        };
    }

    /**
     * Enlaza las rutas a la aplicación Express.
     */
    private routes(): void {
        this.app.use(this.routesSrc.auth, AuthRoutes);
        this.app.use(this.routesSrc.user, UserRoutes);
        this.app.use(this.routesSrc.sessions, SessionRoutes);
        this.app.use(this.routesSrc.ai, AIRoutes);

        this.app.get('/', (req, res) => {
            res.status(200).json({
                message: 'API v1.0 running successfully.',
            });
        });

        // Manejador de ruta no encontrada (404)
        this.app.use((req, res) => {
            res.status(404).json({
                code: 404,
                message: `Route not found: ${req.method} ${req.path}`,
            });
        });

        this.app.use(exceptionManage);
    }

    /**
     * Configura el manejo de eventos de Socket.io y el servidor WebSocket de Yjs (/yjs-ws).
     */
    private socket(): void {
        this.presenceSocket.registerMiddleware(this.io);
        this.io.on('connection', (socket) => new SocketManageEvent(socket, this.io));
        this.yjsSocket.attach(this.httpServer);
    }

    /**
     * Inicia el servidor HTTP y los jobs programados en segundo plano.
     */
    public listen(): void {
        const datetime = new Date().toISOString();
        this.cleanupJob.start();
        this.httpServer.listen(this.port, () => {
            const message = `[SERVER] Server enable at Port: ${this.port} at date ${datetime} in ${process.env.NODE_ENV || 'development'} mode.`;
            console.log(message);
        });
        LoggerManage.info('Iniciado el servidor', {
            port: this.port,
            date: datetime,
            enviroment: process.env.NODE_ENV,
        });
    }

    /**
     * Obtiene la instancia de la aplicación Express para testing o configuración adicional.
     */
    public getApp(): Express {
        return this.app;
    }

    /**
     * Obtiene la instancia del servidor HTTP subyacente.
     */
    public getHttpServer(): http.Server {
        return this.httpServer;
    }

    /**
     * Obtiene la instancia de Socket.IO.
     */
    public getIO(): SocketIOServer {
        return this.io;
    }

    /**
     * Obtiene la instancia del Job de limpieza de sesiones.
     */
    public getCleanupJob(): SessionCleanupJob {
        return this.cleanupJob;
    }
}
