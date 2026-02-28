import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export type UserRole = 'clinician' | 'radiologist' | 'admin' | 'quality_officer';

const authService = new AuthService();

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticate() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Request without authorization header');
      
      // In development, allow requests without auth
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
        req.userId = 'dev_user';
        req.userRole = 'clinician';
        req.userName = 'Development User';
        req.userEmail = 'dev@example.com';
        return next();
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization token provided'
      });
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
    }

    const token = parts[1];

    try {
      // Verify JWT token
      const payload = authService.verifyAccessToken(token);

      // Attach user info to request
      req.userId = payload.userId;
      req.userRole = payload.role;
      req.userName = payload.name;
      req.userEmail = payload.email;

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }
  };
}

/**
 * Authorization middleware
 * Checks if user has required role (RBAC)
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    if (!allowedRoles.includes(req.userRole as UserRole)) {
      logger.warn(
        `User ${req.userId} with role ${req.userRole} attempted to access restricted resource: ${req.method} ${req.path}`
      );
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions for this resource'
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export function optionalAuth() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const payload = authService.verifyAccessToken(token);
      req.userId = payload.userId;
      req.userRole = payload.role;
      req.userName = payload.name;
      req.userEmail = payload.email;
    } catch (error) {
      // Silently fail for optional auth
      logger.debug('Optional auth failed:', error);
    }

    next();
  };
}
