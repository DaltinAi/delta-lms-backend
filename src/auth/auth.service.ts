import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private dbService: DbService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, role } = registerDto;

    // Check if user already exists
    const userCheck = await this.dbService.query(
      `SELECT id FROM ${this.dbService.usersTable} WHERE email = $1`,
      [email],
    );

    if (userCheck.rows.length > 0) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const insertResult = await this.dbService.query(
      `INSERT INTO ${this.dbService.usersTable} (email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name AS "firstName", last_name AS "lastName", role, created_at AS "createdAt"`,
      [email, hashedPassword, firstName, lastName, role],
    );

    return insertResult.rows[0];
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const userResult = await this.dbService.query(
      `SELECT id, email, password, first_name, last_name, role FROM ${this.dbService.usersTable} WHERE email = $1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

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
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    return this.dbService.withTransaction(async (client) => {
      // Lock the token row so only one refresh can rotate it at a time.
      const tokenResult = await client.query(
        `SELECT id, user_id, is_used, is_revoked, expires_at FROM ${this.dbService.refreshTokensTable} WHERE token = $1 FOR UPDATE`,
        [oldRefreshToken],
      );

      if (tokenResult.rows.length === 0) {
        throw new UnauthorizedException('Refresh token not registered');
      }

      const dbToken = tokenResult.rows[0];

      if (dbToken.is_revoked) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      if (dbToken.is_used) {
        await client.query(
          `UPDATE ${this.dbService.refreshTokensTable} SET is_revoked = TRUE WHERE user_id = $1`,
          [payload.sub],
        );
        throw new UnauthorizedException('Token reuse detected! All family sessions revoked.');
      }

      if (new Date(dbToken.expires_at).getTime() < Date.now()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const tokens = await this.generateTokens(payload.sub, payload.email, payload.role);
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

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

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
