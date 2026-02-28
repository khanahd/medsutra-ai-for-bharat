import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/register
 * Register a new user (admin only in production)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: email, password, name, role'
      });
    }

    // Validate role
    const validRoles = ['clinician', 'radiologist', 'admin', 'quality_officer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Register user
    const user = await authService.register(email, password, name, role);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    logger.error('Registration error:', error);
    res.status(400).json({
      error: 'Registration Failed',
      message: error.message || 'Failed to register user'
    });
  }
});

/**
 * POST /api/auth/login
 * User authentication
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: email, password'
      });
    }

    // Authenticate user
    const { user, tokens } = await authService.login(
      email,
      password,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(401).json({
      error: 'Authentication Failed',
      message: error.message || 'Invalid credentials'
    });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', authenticate(), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing refresh token'
      });
    }

    await authService.logout(refreshToken);

    res.json({
      message: 'Logout successful'
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(400).json({
      error: 'Logout Failed',
      message: error.message || 'Failed to logout'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing refresh token'
      });
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token Refresh Failed',
      message: error.message || 'Invalid or expired refresh token'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const user = await authService.getUserById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
  } catch (error: any) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: oldPassword, newPassword'
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    await authService.changePassword(req.userId, oldPassword, newPassword);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    logger.error('Change password error:', error);
    res.status(400).json({
      error: 'Password Change Failed',
      message: error.message || 'Failed to change password'
    });
  }
});

export default router;
