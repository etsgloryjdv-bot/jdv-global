# Database Schema Documentation

## Overview
This PostgreSQL schema forms the backbone of JDV GLOBAL, supporting multi-tenant operations across 22+ modules with advanced features for payments, transactions, real estate, transportation, and marketplace operations.

## Key Features

### 1. **Users & Authentication**
- UUID primary keys for security
- Multi-language and multi-currency support
- KYC (Know Your Customer) verification workflow
- 2FA/MFA support
- Role-based access control (RBAC)
- Permission management per module

### 2. **JDV PAY - Payment System**
- **Wallets**: Multi-currency support, balance tracking, KYC-based limits
- **Transactions**: Complete audit trail with fees, exchange rates, and reconciliation
- **Commissions**: Automated commission tracking, payout eligibility
- **Exchange Rates**: Real-time rates with platform markup

### 3. **Marketplace (JDV Market)**
- Product management with media support
- Geolocation-based queries (PostGIS)
- Inventory tracking
- Order management with status workflow
- Seller commission tracking

### 4. **Real Estate (JDV Immo)**
- Property listings with detailed information
- Dual pricing (sale/rent)
- Geolocation indexing for map display
- Amenities and utilities tracking
- Virtual tour support

### 5. **Transport (JDV Transport)**
- Driver management with verification
- Real-time location tracking (PostGIS)
- Ride/trip management with route optimization
- Dynamic pricing (surge multiplier)
- Rating and review system

### 6. **Notifications**
- Multi-channel delivery (in-app, email, SMS)
- Status tracking (sent, delivered, read)
- Module-specific targeting
- Action URLs for deep linking

### 7. **Audit & Compliance**
- Complete audit logging
- Row-Level Security (RLS) for Supabase
- AML (Anti-Money Laundering) risk scoring
- User action tracking

## PostGIS Integration

Geospatial queries for:
- Finding nearby products, properties, drivers
- Distance calculations
- Location-based analytics
- Heatmaps and clustering

```sql
-- Example: Find products within 5km
SELECT * FROM market_products
WHERE ST_Distance(location, ST_Point(2.3522, 48.8566)::geography) < 5000;
```

## Security Features

### Row-Level Security (RLS)
- Users can only access their own data
- Tenant isolation for multi-tenant scenarios
- Admin-only audit log access

### Encryption
- Payment provider keys encrypted at rest
- Password hashing with bcrypt
- Transaction data isolation

### Constraints
- Foreign key constraints for referential integrity
- CHECK constraints for data validation
- UNIQUE constraints for critical fields

## Performance Optimization

### Indexes
- Single column indexes on frequently filtered fields
- Composite indexes for common query patterns
- Full-text search indexes for product/property search
- Spatial indexes (GIST) for PostGIS queries

### Partitioning Strategy (Future)
- Transactions table can be partitioned by date
- Audit logs can be partitioned by user_id
- Notifications can be partitioned by created_at

## Data Types

- **UUID**: Primary keys for distributed systems
- **DECIMAL(18, 4)**: Financial amounts (up to 99,999,999.9999)
- **GEOGRAPHY**: PostGIS for accurate distance calculations
- **JSONB**: Flexible nested data (amenities, metadata, payment methods)
- **INET**: IP addresses for audit logging
- **TIMESTAMP**: All times in UTC

## Migration Strategy

1. Run schema.sql to create base structure
2. Apply RLS policies for security
3. Insert initial currency and country data
4. Set up replication for backups
5. Enable monitoring and alerting

## Future Enhancements

- Table partitioning for large datasets
- Materialized views for analytics
- Time-series extension for metrics
- Full-text search optimization
- Distributed PostgreSQL setup (Citus)

## Related Documentation

- [MongoDB Schemas](./mongodb.schema.md)
- [API Endpoints](../docs/API.md)
- [Database Configuration](../docs/CONFIGURATION.md)