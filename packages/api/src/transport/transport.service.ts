import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransportDriver } from '../database/entities/transport-driver.entity';
import { TransportRide } from '../database/entities/transport-ride.entity';
import { CreateRideDto } from './dto/create-ride.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';

@Injectable()
export class TransportService {
  constructor(
    @InjectRepository(TransportDriver)
    private driversRepository: Repository<TransportDriver>,
    @InjectRepository(TransportRide)
    private ridesRepository: Repository<TransportRide>,
  ) {}

  /**
   * Register driver
   */
  async registerDriver(userId: string, registerDriverDto: RegisterDriverDto) {
    const { license_number, license_expiry_date, vehicle_make, vehicle_model, vehicle_color } =
      registerDriverDto;

    // Check if driver already registered
    const existingDriver = await this.driversRepository.findOne({
      where: { user_id: userId },
    });

    if (existingDriver) {
      throw new BadRequestException('Driver already registered');
    }

    // Create driver record
    const driver = this.driversRepository.create({
      user_id: userId,
      license_number,
      license_expiry_date: new Date(license_expiry_date),
      vehicle_make,
      vehicle_model,
      vehicle_color,
      status: 'INACTIVE',
      verified: false,
    });

    const savedDriver = await this.driversRepository.save(driver);

    return {
      driver_id: savedDriver.id,
      status: savedDriver.status,
      verified: savedDriver.verified,
      message: 'Driver registration submitted. Awaiting verification.',
    };
  }

  /**
   * Get driver profile
   */
  async getDriver(driverId: string) {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return {
      id: driver.id,
      user_id: driver.user_id,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry_date,
      vehicle_make: driver.vehicle_make,
      vehicle_model: driver.vehicle_model,
      vehicle_color: driver.vehicle_color,
      status: driver.status,
      verified: driver.verified,
      rating: driver.rating_average,
      acceptance_rate: driver.acceptance_rate,
      cancellation_rate: driver.cancellation_rate,
    };
  }

  /**
   * Request a ride
   */
  async requestRide(customerId: string, createRideDto: CreateRideDto) {
    const {
      pickup_location,
      dropoff_location,
      pickup_address,
      dropoff_address,
      distance_km,
      estimated_duration_minutes,
    } = createRideDto;

    // Create ride request
    const ride = this.ridesRepository.create({
      customer_id: customerId,
      pickup_location,
      dropoff_location,
      pickup_address,
      dropoff_address,
      distance_km,
      estimated_duration_minutes,
      status: 'REQUESTED',
      requested_at: new Date(),
    });

    const savedRide = await this.ridesRepository.save(ride);

    return {
      ride_id: savedRide.id,
      status: savedRide.status,
      message: 'Ride request created. Matching drivers...',
    };
  }

  /**
   * Accept ride (driver side)
   */
  async acceptRide(rideId: string, driverId: string) {
    const ride = await this.ridesRepository.findOne({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== 'REQUESTED') {
      throw new BadRequestException('Ride already accepted or completed');
    }

    ride.driver_id = driverId;
    ride.status = 'ACCEPTED';
    ride.accepted_at = new Date();

    const updated = await this.ridesRepository.save(ride);

    return {
      ride_id: updated.id,
      status: updated.status,
      driver_id: updated.driver_id,
      accepted_at: updated.accepted_at,
    };
  }

  /**
   * Start ride
   */
  async startRide(rideId: string, driverId: string) {
    const ride = await this.ridesRepository.findOne({
      where: { id: rideId, driver_id: driverId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== 'ACCEPTED') {
      throw new BadRequestException('Ride cannot be started');
    }

    ride.status = 'IN_PROGRESS';
    ride.started_at = new Date();

    const updated = await this.ridesRepository.save(ride);

    return {
      ride_id: updated.id,
      status: updated.status,
      started_at: updated.started_at,
    };
  }

  /**
   * Complete ride
   */
  async completeRide(rideId: string, driverId: string) {
    const ride = await this.ridesRepository.findOne({
      where: { id: rideId, driver_id: driverId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Ride is not in progress');
    }

    ride.status = 'COMPLETED';
    ride.completed_at = new Date();

    const updated = await this.ridesRepository.save(ride);

    return {
      ride_id: updated.id,
      status: updated.status,
      completed_at: updated.completed_at,
      total_fare: updated.total_fare,
    };
  }

  /**
   * Get active rides for driver
   */
  async getActiveRidesForDriver(driverId: string) {
    const rides = await this.ridesRepository.find({
      where: [
        { driver_id: driverId, status: 'ACCEPTED' },
        { driver_id: driverId, status: 'IN_PROGRESS' },
      ],
      order: { created_at: 'DESC' },
    });

    return {
      rides: rides.map(r => ({
        id: r.id,
        customer_id: r.customer_id,
        pickup_address: r.pickup_address,
        dropoff_address: r.dropoff_address,
        status: r.status,
        distance: r.distance_km,
        duration: r.estimated_duration_minutes,
      })),
    };
  }

  /**
   * Get ride history for customer
   */
  async getRideHistory(customerId: string, limit = 20, offset = 0) {
    const [rides, total] = await this.ridesRepository.findAndCount({
      where: { customer_id: customerId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      rides: rides.map(r => ({
        id: r.id,
        driver_id: r.driver_id,
        pickup_address: r.pickup_address,
        dropoff_address: r.dropoff_address,
        status: r.status,
        total_fare: r.total_fare,
        rating: r.rating,
        created_at: r.created_at,
      })),
      total,
      limit,
      offset,
    };
  }
}
