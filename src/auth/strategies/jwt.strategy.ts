import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'delta-crm-access-token-secret-key-12345',
    });
  }

  async validate(payload: JwtPayload & { company_id?: string }) {
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role,
      company_id: payload.company_id 
    };
  }
}
