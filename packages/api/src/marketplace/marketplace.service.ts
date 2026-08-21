import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketProduct } from '../database/entities/market-product.entity';
import { MarketOrder } from '../database/entities/market-order.entity';
import { MarketCategory } from '../database/entities/market-category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketProduct)
    private productsRepository: Repository<MarketProduct>,
    @InjectRepository(MarketOrder)
    private ordersRepository: Repository<MarketOrder>,
    @InjectRepository(MarketCategory)
    private categoriesRepository: Repository<MarketCategory>,
  ) {}

  /**
   * Create a new product listing
   */
  async createProduct(sellerId: string, createProductDto: CreateProductDto) {
    const { category_id, title, description, sku, price_base, currency, stock_quantity } =
      createProductDto;

    // Validate category
    const category = await this.categoriesRepository.findOne({
      where: { id: category_id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Create product
    const product = this.productsRepository.create({
      seller_id: sellerId,
      category_id,
      title,
      slug: this.generateSlug(title),
      description,
      sku,
      price_base,
      currency,
      stock_quantity: stock_quantity || 0,
      status: 'DRAFT',
    });

    const savedProduct = await this.productsRepository.save(product);

    return {
      id: savedProduct.id,
      title: savedProduct.title,
      status: savedProduct.status,
      price: savedProduct.price_base,
      currency: savedProduct.currency,
      message: 'Product created successfully',
    };
  }

  /**
   * Publish a product
   */
  async publishProduct(productId: string, sellerId: string) {
    const product = await this.productsRepository.findOne({
      where: { id: productId, seller_id: sellerId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.status = 'ACTIVE';
    product.published_at = new Date();
    const updated = await this.productsRepository.save(product);

    return {
      id: updated.id,
      status: updated.status,
      published_at: updated.published_at,
      message: 'Product published successfully',
    };
  }

  /**
   * Get all products (with filters)
   */
  async getProducts(filters: {
    category_id?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = this.productsRepository
      .createQueryBuilder('product')
      .where('product.status = :status', { status: filters.status || 'ACTIVE' });

    if (filters.category_id) {
      query = query.andWhere('product.category_id = :category_id', {
        category_id: filters.category_id,
      });
    }

    if (filters.min_price) {
      query = query.andWhere('product.price_base >= :min_price', {
        min_price: filters.min_price,
      });
    }

    if (filters.max_price) {
      query = query.andWhere('product.price_base <= :max_price', {
        max_price: filters.max_price,
      });
    }

    if (filters.search) {
      query = query.andWhere(
        '(product.title ILIKE :search OR product.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [products, total] = await query
      .orderBy('product.created_at', 'DESC')
      .limit(filters.limit || 20)
      .offset(filters.offset || 0)
      .getManyAndCount();

    return {
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price_base,
        currency: p.currency,
        category_id: p.category_id,
        stock: p.stock_quantity,
        rating: p.rating_average,
        reviews: p.review_count,
        thumbnail: p.thumbnail_url,
      })),
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    };
  }

  /**
   * Get product details
   */
  async getProduct(productId: string) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment view count
    product.view_count = (product.view_count || 0) + 1;
    await this.productsRepository.save(product);

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price_base,
      currency: product.currency,
      discount: product.discount_percentage,
      stock: product.stock_quantity,
      category_id: product.category_id,
      seller_id: product.seller_id,
      status: product.status,
      images: product.images,
      rating: product.rating_average,
      reviews: product.review_count,
      views: product.view_count,
      created_at: product.created_at,
    };
  }

  /**
   * Create order
   */
  async createOrder(buyerId: string, createOrderDto: CreateOrderDto) {
    const { product_id, seller_id, quantity } = createOrderDto;

    // Validate product
    const product = await this.productsRepository.findOne({
      where: { id: product_id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock_quantity < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    // Create order
    const order = this.ordersRepository.create({
      buyer_id: buyerId,
      seller_id,
      product_id,
      order_number: `ORD-${Date.now()}-${uuidv4().substring(0, 8)}`,
      quantity,
      unit_price: product.price_base,
      total_amount: product.price_base * quantity,
      currency: product.currency,
      final_amount: product.price_base * quantity,
      payment_status: 'PENDING',
      delivery_status: 'PENDING',
      status: 'NEW',
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Reduce stock
    product.stock_quantity -= quantity;
    await this.productsRepository.save(product);

    return {
      order_id: savedOrder.id,
      order_number: savedOrder.order_number,
      total_amount: savedOrder.total_amount,
      currency: savedOrder.currency,
      status: savedOrder.status,
      message: 'Order created successfully',
    };
  }

  /**
   * Get seller orders
   */
  async getSellerOrders(sellerId: string, limit = 20, offset = 0) {
    const [orders, total] = await this.ordersRepository.findAndCount({
      where: { seller_id: sellerId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      orders: orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        buyer_id: o.buyer_id,
        product_id: o.product_id,
        quantity: o.quantity,
        total_amount: o.total_amount,
        status: o.status,
        payment_status: o.payment_status,
        delivery_status: o.delivery_status,
        created_at: o.created_at,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get buyer orders
   */
  async getBuyerOrders(buyerId: string, limit = 20, offset = 0) {
    const [orders, total] = await this.ordersRepository.findAndCount({
      where: { buyer_id: buyerId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      orders: orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        seller_id: o.seller_id,
        product_id: o.product_id,
        quantity: o.quantity,
        total_amount: o.total_amount,
        status: o.status,
        payment_status: o.payment_status,
        delivery_status: o.delivery_status,
        created_at: o.created_at,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string, sellerId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId, seller_id: sellerId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = status;
    const updated = await this.ordersRepository.save(order);

    return {
      order_id: updated.id,
      status: updated.status,
      updated_at: updated.updated_at,
    };
  }

  /**
   * Helper: Generate slug from title
   */
  private generateSlug(title: string): string {
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uuidv4().substring(0, 8)}`;
  }
}
