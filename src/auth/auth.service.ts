import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class AuthService {
  constructor(
    private dbService: DbService,
    private jwtService: JwtService,
    private errorService: ErrorService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, role } = registerDto;

    // Check if user already exists
    const userCheck = await this.dbService.query(
      `SELECT id FROM ${this.dbService.usersTable} WHERE email = $1`,
      [email],
    );

    if (userCheck.rows.length > 0) {
      this.errorService.errorThrower(409, {
        message: 'Email is already registered',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Hardcoded default company ID for new signups
    const defaultCompanyId = '7f1acd83-d5d2-47c2-8d95-4f0627ee1306';

    // Insert user
    const insertResult = await this.dbService.query(
      `INSERT INTO ${this.dbService.usersTable} (email, password, first_name, last_name, role, company_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name AS "firstName", last_name AS "lastName", role, company_id AS "companyId", created_at AS "createdAt"`,
      [
        email,
        hashedPassword,
        firstName,
        lastName,
        role.toLowerCase(),
        defaultCompanyId,
      ],
    );

    return insertResult.rows[0];
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const userResult = await this.dbService.query(
      `SELECT id, email, password, first_name, last_name, role, company_id FROM ${this.dbService.usersTable} WHERE email = $1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      this.errorService.errorThrower(401, { message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.errorService.errorThrower(401, { message: 'Invalid credentials' });
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.company_id,
    );

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(oldRefreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify(oldRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (err) {
      this.errorService.errorThrower(401, {
        message: 'Invalid refresh token signature',
      });
    }

    return this.dbService.transaction(async (client: PoolClient) => {
      // Lock the token row so only one refresh can rotate it at a time.
      const tokenResult = await client.query(
        `SELECT id, user_id, is_used, is_revoked, expires_at FROM ${this.dbService.refreshTokensTable} WHERE token = $1 FOR UPDATE`,
        [oldRefreshToken],
      );

      if (tokenResult.rows.length === 0) {
        this.errorService.errorThrower(401, {
          message: 'Refresh token not registered',
        });
      }

      const dbToken = tokenResult.rows[0];

      if (dbToken.is_revoked) {
        this.errorService.errorThrower(401, {
          message: 'Refresh token has been revoked',
        });
      }

      if (dbToken.is_used) {
        await client.query(
          `UPDATE ${this.dbService.refreshTokensTable} SET is_revoked = TRUE WHERE user_id = $1`,
          [payload.sub],
        );
        this.errorService.errorThrower(401, {
          message: 'Token reuse detected! All family sessions revoked.',
        });
      }

      if (new Date(dbToken.expires_at).getTime() < Date.now()) {
        this.errorService.errorThrower(401, {
          message: 'Refresh token expired',
        });
      }

      // Fetch user's company_id
      const userResult = await client.query(
        `SELECT company_id FROM ${this.dbService.usersTable} WHERE id = $1`,
        [payload.sub],
      );
      const companyId = userResult.rows[0]?.company_id;

      const tokens = await this.generateTokens(
        payload.sub,
        payload.email,
        payload.role,
        companyId,
      );
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await client.query(
        `UPDATE ${this.dbService.refreshTokensTable} SET is_used = TRUE WHERE token = $1`,
        [oldRefreshToken],
      );

      await client.query(
        `INSERT INTO ${this.dbService.refreshTokensTable} (token, user_id, expires_at) VALUES ($1, $2, $3)`,
        [tokens.refreshToken, payload.sub, expiresAt],
      );

      return tokens;
    });
  }

  async logout(refreshToken: string) {
    // Revoke the token
    await this.dbService.query(
      `UPDATE ${this.dbService.refreshTokensTable} SET is_revoked = TRUE WHERE token = $1`,
      [refreshToken],
    );
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: import('./dto/forgot-password.dto').ForgotPasswordDto,
  ) {
    const { email } = forgotPasswordDto;

    const userResult = await this.dbService.query(
      `SELECT id FROM ${this.dbService.usersTable} WHERE email = $1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      // Don't leak whether the email exists
      return {
        message: 'If an account exists, a password reset link has been sent.',
      };
    }

    const userId = userResult.rows[0].id;
    // Generate a secure reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Set expiration to 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.dbService.query(
      `INSERT INTO ${this.dbService.passwordResetsTable} (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, resetToken, expiresAt],
    );

    // TODO: Send email with the resetToken (e.g. using Resend, Sendgrid, etc.)
    console.log(`Reset token for ${email}: ${resetToken}`);

    return {
      message: 'If an account exists, a password reset link has been sent.',
    };
  }

  async resetPassword(
    resetPasswordDto: import('./dto/reset-password.dto').ResetPasswordDto,
  ) {
    const { token, password } = resetPasswordDto;

    return this.dbService.transaction(async (client: PoolClient) => {
      // Find the valid token
      const tokenResult = await client.query(
        `SELECT id, user_id, expires_at, is_used FROM ${this.dbService.passwordResetsTable} 
         WHERE token = $1 AND is_used = FALSE FOR UPDATE`,
        [token],
      );

      if (tokenResult.rows.length === 0) {
        this.errorService.errorThrower(401, {
          message: 'Invalid or expired reset token',
        });
      }

      const dbToken = tokenResult.rows[0];

      if (new Date(dbToken.expires_at).getTime() < Date.now()) {
        this.errorService.errorThrower(401, { message: 'Reset token expired' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password
      await client.query(
        `UPDATE ${this.dbService.usersTable} SET password = $1 WHERE id = $2`,
        [hashedPassword, dbToken.user_id],
      );

      // Mark token as used
      await client.query(
        `UPDATE ${this.dbService.passwordResetsTable} SET is_used = TRUE WHERE id = $1`,
        [dbToken.id],
      );

      return { message: 'Password has been reset successfully' };
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    companyId?: string,
  ) {
    const payload: JwtPayload & { company_id?: string } = {
      sub: userId,
      email,
      role,
      company_id: companyId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.dbService.query(
      `INSERT INTO ${this.dbService.refreshTokensTable} (token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [token, userId, expiresAt],
    );
  }
}
