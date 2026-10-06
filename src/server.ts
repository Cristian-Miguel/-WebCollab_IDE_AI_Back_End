import * as dotenv from 'dotenv';
import express, { Express, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { LoggerManage } from './core/config/logger'

import { SocketManageEvent } from './core/config/socket_manage'; 
import AuthRoutes from './feature/auth/auth_routes';
import { exceptionManage } from './core/exception/exception_manage';
import UserRoutes from './feature/user/user_routes';
import cookieParser from 'cookie-parser';

/**
 * Clase que gestiona la configuración y el arranque del servidor Express con TypeScript.
 * Se encarga de middlewares, rutas, y la inicialización de Socket.io.
 */
export class Server {
    private app: Express;
    private port: number | string;
    private httpServer: http.Server;
    private io: SocketIOServer;
    private mainRoute: string;
    private routesSrc: { [key: string]: string };

    constructor() {
        dotenv.config(); 
        
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.httpServer = http.createServer(this.app);
        
        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: process.env.CORS_ORIGINS?.split(',') || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            }
        });

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
        
        const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*';
        
        this.app.use(cors({
            origin: process.env.CORS_ORIGINS?.split(',') || '*',//origin: allowedOrigins
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            credentials: true,
        }));

        this.app.use(helmet());

        this.app.use(morgan('combined'));

        this.app.use(express.json());

        this.app.use(express.static('public'));

        this.app.use(cookieParser());
    }

    /**
     * Define las rutas base para los módulos.
     * @returns Un objeto con las rutas base.
     */
    private routesSource(): { [key: string]: string } {
        return {
            auth: `${this.mainRoute}/auth`,
            user: `${this.mainRoute}/user`,
        };
    }

    /**
     * Enlaza las rutas a la aplicación Express.
     */
    private routes(): void {
        this.app.use(this.routesSrc.auth, AuthRoutes);
        this.app.use(this.routesSrc.user, UserRoutes);

        this.app.get('/', (req, res) => {
            res.status(200).json({ 
                message: 'API v1.0 running successfully.' 
            });
        });
        
        // Manejador de ruta no encontrada (404)
        this.app.use((req, res) => {
            res.status(404).json({
                code: 404,
                message: `Route not found: ${req.method} ${req.path}`
            });
        });
        
        this.app.use(exceptionManage);
    }
    
    /**
     * Configura el manejo de eventos de Socket.io.
     */
    private socket(): void {
        this.io.on('connection', (socket) => new SocketManageEvent(socket, this.io) );
    }

    /**
     * Inicia el servidor HTTP.
     */
    public listen(): void {
        const datetime = new Date().toISOString();
        this.httpServer.listen(this.port, () => {
            const message = `[SERVER] Server enable at Port: ${this.port} at date ${datetime} in ${process.env.NODE_ENV || 'development'} mode.`;
            console.log(message);
        });
        LoggerManage.info("Iniciado el servidor", {
            port: this.port,
            date: datetime,
            enviroment: process.env.NODE_ENV
        })
    }

    /**
     * Obtiene la instancia de la aplicación Express para testing o configuración adicional.
     */
    public getApp(): Express {
        return this.app;
    }
}
