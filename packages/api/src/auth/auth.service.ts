import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserRole)
    private userRolesRepository: Repository<UserRole>,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   */
  async register(createUserDto: CreateUserDto) {
    const { email, phone_number, password, first_name, last_name, country_iso, country_name, default_language, default_currency } = createUserDto;

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phone_number }],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = this.usersRepository.create({
      email,
      phone_number,
      password_hash,
      first_name,
      last_name,
      country_iso,
      country_name,
      default_language: default_language || 'fr',
      default_currency: default_currency || 'XOF',
      status: 'ACTIVE',
      kyc_status: 'PENDING',
    });

    const savedUser = await this.usersRepository.save(user);

    // Assign CUSTOMER role by default
    await this.userRolesRepository.save({
      user_id: savedUser.id,
      role_name: 'CUSTOMER',
      module: 'GLOBAL',
      status: 'ACTIVE',
    });

    return {
      id: savedUser.id,
      email: savedUser.email,
      phone_number: savedUser.phone_number,
      first_name: savedUser.first_name,
      last_name: savedUser.last_name,
      country_iso: savedUser.country_iso,
      message: 'User registered successfully',
    };
  }

  /**
   * Login user and return JWT tokens
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      throw new UnauthorizedException('Account is locked. Please try again later.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment login attempts
      user.login_attempts = (user.login_attempts || 0) + 1;

      if (user.login_attempts >= 5) {
        user.account_locked_until = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }

      await this.usersRepository.save(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset login attempts
    user.login_attempts = 0;
    user.last_login_at = new Date();
    user.account_locked_until = null;
    await this.usersRepository.save(user);

    // Generate JWT tokens
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        phone_number: user.phone_number,
      },
      { expiresIn: '24h' },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '7d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        country_iso: user.country_iso,
        kyc_status: user.kyc_status,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const newAccessToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          phone_number: user.phone_number,
        },
        { expiresIn: '24h' },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get user roles
    const roles = await this.userRolesRepository.find({
      where: { user_id: userId, status: 'ACTIVE' },
    });

    return {
      id: user.id,
      email: user.email,
      phone_number: user.phone_number,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      country_iso: user.country_iso,
      country_name: user.country_name,
      timezone: user.timezone,
      default_language: user.default_language,
      default_currency: user.default_currency,
      status: user.status,
      email_verified: user.email_verified,
      phone_verified: user.phone_verified,
      kyc_status: user.kyc_status,
      two_factor_enabled: user.two_factor_enabled,
      roles: roles.map(r => ({ role_name: r.role_name, module: r.module })),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Verify email token
   */
  async verifyEmail(userId: string, token: string): Promise<{ message: string }> {
    // TODO: Implement email verification logic
    // For now, just mark email as verified
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (user) {
      user.email_verified = true;
      await this.usersRepository.save(user);
    }
    return { message: 'Email verified successfully' };
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return { message: 'If user exists, password reset email will be sent' };
    }
    // TODO: Send password reset email with token
    return { message: 'If user exists, password reset email will be sent' };
  }
}
