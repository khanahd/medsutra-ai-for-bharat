import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../../config/database';
import { User, UserRole } from '../../entities/User';
import { Session } from '../../entities/Session';
import logger from '../../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);
  private sessionRepository = AppDataSource.getRepository(Session);

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepository.create({
      email,
      name,
      passwordHash,
      role,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null
    });

    await this.userRepository.save(user);
    logger.info(`User registered: ${email} with role ${role}`);

    return user;
  }

  /**
   * Authenticate user and generate tokens
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new Error(
        `Account is locked due to too many failed login attempts. Try again in ${minutesRemaining} minutes.`
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed attempts
      user.failedLoginAttempts += 1;

      // Lock account if max attempts reached
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000);
        await this.userRepository.save(user);
        logger.warn(`Account locked for user ${email} due to ${MAX_FAILED_ATTEMPTS} failed attempts`);
        throw new Error(
          `Account locked due to too many failed login attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`
        );
      }

      await this.userRepository.save(user);
      throw new Error('Invalid credentials');
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    logger.info(`User logged in: ${email}`);

    return { user, tokens };
  }

  /**
   * Logout user and invalidate session
   */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true }
    });

    if (session) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      logger.info(`User logged out: session ${session.id}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    // Find active session
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true },
      relations: ['user']
    });

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      throw new Error('Refresh token expired');
    }

    // Check if user is still active
    if (!session.user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(
      session.user,
      session.ipAddress || undefined,
      session.userAgent || undefined
    );

    // Invalidate old session
    session.isActive = false;
    await this.sessionRepository.save(session);

    logger.info(`Access token refreshed for user ${session.user.email}`);

    return tokens;
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid current password');
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    logger.info(`Password changed for user ${user.email}`);
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    await this.userRepository.save(user);

    // Invalidate all sessions
    await this.sessionRepository.update({ userId, isActive: true }, { isActive: false });

    logger.info(`User deactivated: ${user.email}`);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    // Generate access token
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token
    const refreshToken = uuidv4();

    // Calculate expiration
    const expiresIn = this.parseExpiration(REFRESH_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresIn);

    // Save session
    const session = this.sessionRepository.create({
      userId: user.id,
      refreshToken,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
      isActive: true
    });

    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(JWT_EXPIRES_IN)
    };
  }

  /**
   * Parse expiration string to milliseconds
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60 * 1000; // Default 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
