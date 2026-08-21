import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImmoProperty } from '../database/entities/immo-property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';

@Injectable()
export class RealEstateService {
  constructor(
    @InjectRepository(ImmoProperty)
    private propertiesRepository: Repository<ImmoProperty>,
  ) {}

  /**
   * List a property
   */
  async listProperty(ownerId: string, createPropertyDto: CreatePropertyDto) {
    const {
      title,
      description,
      property_type,
      bedrooms,
      bathrooms,
      total_area,
      street_address,
      city,
      state_province,
      postal_code,
      country,
      price_amount,
      price_currency,
      price_type,
      pet_friendly,
      smoking_allowed,
    } = createPropertyDto;

    // Create property
    const property = this.propertiesRepository.create({
      owner_id: ownerId,
      title,
      description,
      property_type,
      bedrooms,
      bathrooms,
      total_area,
      street_address,
      city,
      state_province,
      postal_code,
      country,
      price_amount,
      price_currency,
      price_type,
      pet_friendly,
      smoking_allowed,
      status: 'DRAFT',
    });

    const savedProperty = await this.propertiesRepository.save(property);

    return {
      property_id: savedProperty.id,
      title: savedProperty.title,
      status: savedProperty.status,
      price: savedProperty.price_amount,
      currency: savedProperty.price_currency,
      message: 'Property listed successfully',
    };
  }

  /**
   * Publish property listing
   */
  async publishProperty(propertyId: string, ownerId: string) {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId, owner_id: ownerId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    property.status = 'ACTIVE';
    property.published_at = new Date();
    const updated = await this.propertiesRepository.save(property);

    return {
      property_id: updated.id,
      status: updated.status,
      published_at: updated.published_at,
    };
  }

  /**
   * Search properties
   */
  async searchProperties(filters: {
    city?: string;
    country?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = this.propertiesRepository
      .createQueryBuilder('property')
      .where('property.status = :status', { status: 'ACTIVE' });

    if (filters.city) {
      query = query.andWhere('property.city ILIKE :city', {
        city: `%${filters.city}%`,
      });
    }

    if (filters.country) {
      query = query.andWhere('property.country = :country', {
        country: filters.country,
      });
    }

    if (filters.property_type) {
      query = query.andWhere('property.property_type = :property_type', {
        property_type: filters.property_type,
      });
    }

    if (filters.min_price) {
      query = query.andWhere('property.price_amount >= :min_price', {
        min_price: filters.min_price,
      });
    }

    if (filters.max_price) {
      query = query.andWhere('property.price_amount <= :max_price', {
        max_price: filters.max_price,
      });
    }

    if (filters.min_bedrooms) {
      query = query.andWhere('property.bedrooms >= :min_bedrooms', {
        min_bedrooms: filters.min_bedrooms,
      });
    }

    const [properties, total] = await query
      .orderBy('property.created_at', 'DESC')
      .limit(filters.limit || 20)
      .offset(filters.offset || 0)
      .getManyAndCount();

    return {
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        property_type: p.property_type,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.total_area,
        city: p.city,
        country: p.country,
        price: p.price_amount,
        currency: p.price_currency,
        price_type: p.price_type,
        thumbnail: p.thumbnail_url,
      })),
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    };
  }

  /**
   * Get property details
   */
  async getProperty(propertyId: string) {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Increment view count
    property.view_count = (property.view_count || 0) + 1;
    await this.propertiesRepository.save(property);

    return {
      id: property.id,
      title: property.title,
      description: property.description,
      property_type: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      total_area: property.total_area,
      street_address: property.street_address,
      city: property.city,
      state_province: property.state_province,
      postal_code: property.postal_code,
      country: property.country,
      price: property.price_amount,
      currency: property.price_currency,
      price_type: property.price_type,
      rental_price_monthly: property.rental_price_monthly,
      amenities: property.amenities,
      utilities: property.utilities_included,
      pet_friendly: property.pet_friendly,
      smoking_allowed: property.smoking_allowed,
      images: property.images,
      virtual_tour: property.virtual_tour_url,
      floor_plan: property.floor_plan_url,
      owner_id: property.owner_id,
      status: property.status,
      views: property.view_count,
      inquiries: property.inquiry_count,
      created_at: property.created_at,
    };
  }

  /**
   * Get owner properties
   */
  async getOwnerProperties(ownerId: string, limit = 20, offset = 0) {
    const [properties, total] = await this.propertiesRepository.findAndCount({
      where: { owner_id: ownerId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        property_type: p.property_type,
        city: p.city,
        price: p.price_amount,
        status: p.status,
        views: p.view_count,
        inquiries: p.inquiry_count,
        created_at: p.created_at,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Update property
   */
  async updateProperty(propertyId: string, ownerId: string, updates: Partial<ImmoProperty>) {
    const property = await this.propertiesRepository.findOne({
      where: { id: propertyId, owner_id: ownerId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    Object.assign(property, updates);
    const updated = await this.propertiesRepository.save(property);

    return {
      property_id: updated.id,
      title: updated.title,
      status: updated.status,
      updated_at: updated.updated_at,
    };
  }
}
