import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { TableConstants } from '../utils/table-constants';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ErrorService } from '../common/error/error.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly dbService: DbService,
    private readonly errorService: ErrorService
  ) {}

  async createInvitation(companyId: string, inviterId: string, dto: CreateInvitationDto) {
    // Check if user already exists
    const userCheck = await this.dbService.query(
      `SELECT id FROM ${TableConstants.USERS} WHERE email = $1 AND company_id = $2`,
      [dto.email, companyId]
    );

    if (userCheck.rows.length > 0) {
      this.errorService.errorThrower(409, { message: 'User with this email already exists in the company' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

    const result = await this.dbService.query(
      `INSERT INTO ${TableConstants.USER_INVITATIONS} 
       (company_id, email, role, token, invited_by, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, role, token, expires_at`,
      [companyId, dto.email, dto.role || 'telecaller', token, inviterId, expiresAt]
    );

    const invite = result.rows[0];

    // Simulating email send
    console.log(`[InvitationsService] Generated invite link for ${dto.email}: /invite/accept?token=${token}`);

    return {
      message: 'Invitation created successfully',
      inviteLink: `/invite/accept?token=${token}`,
      expiresAt: invite.expires_at,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    return this.dbService.transaction(async (client) => {
      // 1. Validate token
      const inviteResult = await client.query(
        `SELECT * FROM ${TableConstants.USER_INVITATIONS} WHERE token = $1 AND is_used = false FOR UPDATE`,
        [dto.token]
      );

      if (inviteResult.rows.length === 0) {
        this.errorService.errorThrower(404, { message: 'Invalid or already used invitation token' });
      }

      const invite = inviteResult.rows[0];

      if (new Date(invite.expires_at).getTime() < Date.now()) {
        this.errorService.errorThrower(400, { message: 'Invitation has expired' });
      }

      // 2. Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // 3. Create user
      const userResult = await client.query(
        `INSERT INTO ${TableConstants.USERS} 
         (company_id, email, password, first_name, last_name, role) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, email, role`,
        [invite.company_id, invite.email, hashedPassword, dto.firstName, dto.lastName, invite.role]
      );

      // 4. Mark invite as used
      await client.query(
        `UPDATE ${TableConstants.USER_INVITATIONS} SET is_used = true WHERE id = $1`,
        [invite.id]
      );

      return { message: 'Account created successfully', user: userResult.rows[0] };
    });
  }

  async getPendingInvitations(companyId: string) {
    const result = await this.dbService.query(
      `SELECT id, email, role, expires_at, created_at 
       FROM ${TableConstants.USER_INVITATIONS} 
       WHERE company_id = $1 AND is_used = false AND expires_at > NOW()`,
      [companyId]
    );
    return result.rows;
  }
}
