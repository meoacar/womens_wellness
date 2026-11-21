import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { createCorsOriginValidator, resolveAllowedOrigins } from '../common/utils/cors';

/**
 * WebSocket Gateway for Real-time Admin Updates
 * 
 * Features:
 * - Real-time dashboard updates
 * - Live user activity monitoring
 * - System alerts and notifications
 * - Live metrics streaming
 */
@WebSocketGateway({
    namespace: '/admin',
    cors: {
        origin: createCorsOriginValidator(resolveAllowedOrigins()),
        credentials: true,
    },
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private connectedAdmins = new Map<string, Socket>();

    constructor(
        private adminService: AdminService,
        private prisma: PrismaService,
    ) {
        // Start periodic updates
        this.startPeriodicUpdates();
    }

    async handleConnection(client: Socket) {
        const adminId = await this.verifyAdminSocket(client);
        if (!adminId) {
            client.emit('error', { message: 'Yetkisiz WebSocket bağlantısı' });
            client.disconnect(true);
            return;
        }

        this.connectedAdmins.set(adminId, client);
        this.sendInitialData(client);
    }

    handleDisconnect(client: Socket) {
        console.log(`Admin disconnected: ${client.id}`);

        // Remove from connected admins
        for (const [adminId, socket] of this.connectedAdmins.entries()) {
            if (socket.id === client.id) {
                this.connectedAdmins.delete(adminId);
                break;
            }
        }
    }

    /**
     * Subscribe to dashboard updates
     */
    @SubscribeMessage('subscribe:dashboard')
    async handleDashboardSubscription(@ConnectedSocket() client: Socket) {
        const stats = await this.adminService.getDashboardStats();
        client.emit('dashboard:update', stats);
    }

    /**
     * Subscribe to user activity
     */
    @SubscribeMessage('subscribe:user-activity')
    async handleUserActivitySubscription(@ConnectedSocket() client: Socket) {
        const health = await this.adminService.getSystemHealth();
        client.emit('user-activity:update', {
            activeUsers: health.users.active,
            recentActions: [],
        });
    }

    /**
     * Subscribe to system metrics
     */
    @SubscribeMessage('subscribe:system-metrics')
    async handleSystemMetricsSubscription(@ConnectedSocket() client: Socket) {
        const health = await this.adminService.getSystemHealth();
        client.emit('system-metrics:update', health);
    }

    /**
     * Broadcast events to all connected admins
     */
    broadcastToAdmins(event: string, data: any) {
        this.server.emit(event, data);
    }

    /**
     * Send notification to specific admin
     */
    sendToAdmin(adminId: string, event: string, data: any) {
        const socket = this.connectedAdmins.get(adminId);
        if (socket) {
            socket.emit(event, data);
        }
    }

    /**
     * Periodic updates for dashboard
     */
    private startPeriodicUpdates() {
        // Update dashboard every 30 seconds
        setInterval(async () => {
            if (this.connectedAdmins.size > 0) {
                const stats = await this.adminService.getDashboardStats();
                this.broadcastToAdmins('dashboard:update', stats);
            }
        }, 30000);

        // Update system health every 60 seconds
        setInterval(async () => {
            if (this.connectedAdmins.size > 0) {
                const health = await this.adminService.getSystemHealth();
                this.broadcastToAdmins('system-metrics:update', health);
            }
        }, 60000);
    }

    /**
     * Send initial data when admin connects
     */
    private async sendInitialData(client: Socket) {
        try {
            const [stats, health] = await Promise.all([
                this.adminService.getDashboardStats(),
                this.adminService.getSystemHealth(),
            ]);

            client.emit('dashboard:update', stats);
            client.emit('system-metrics:update', health);
        } catch (error) {
            console.error('Error sending initial data:', error);
        }
    }

    /**
     * Extract admin ID from socket connection
     */
    private async verifyAdminSocket(client: Socket): Promise<string | null> {
        const rawAuth =
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization;
        const token = typeof rawAuth === 'string'
            ? rawAuth.replace(/^Bearer\s+/i, '').trim()
            : '';
        if (!token) return null;

        try {
            const jwt = require('jsonwebtoken');
            const secret = process.env.JWT_SECRET;
            if (!secret) return null;

            const decoded: any = jwt.verify(token, secret);
            const userId = decoded?.sub || decoded?.id;
            if (!userId) return null;

            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, isAdmin: true, status: true },
            });
            if (!user || user.status !== 'ACTIVE' || !user.isAdmin) return null;

            return user.id;
        } catch {
            return null;
        }
    }

    /**
     * Public methods for other services to trigger real-time updates
     */
    notifyNewUser(userData: any) {
        this.broadcastToAdmins('user:new', userData);
    }

    notifyUserUpdate(userData: any) {
        this.broadcastToAdmins('user:update', userData);
    }

    notifyNewSubscription(subscriptionData: any) {
        this.broadcastToAdmins('subscription:new', subscriptionData);
    }

    notifySystemAlert(alert: { level: string; message: string; timestamp: Date }) {
        this.broadcastToAdmins('system:alert', alert);
    }
}
