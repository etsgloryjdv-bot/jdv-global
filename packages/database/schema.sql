-- =====================================================================
-- JDV GLOBAL - PostgreSQL Database Schema
-- Version: 1.0.0
-- =====================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "hstore";

-- =====================================================================
-- 1. USERS & AUTHENTICATION
-- =====================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    
    -- Location & Preferences
    country_iso VARCHAR(3) NOT NULL,          -- ISO 3166-1 alpha-3 (e.g., BEN, IND, BRA)
    country_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    default_language VARCHAR(5) DEFAULT 'fr', -- fr, en, pt, es, zh, ar, sw, yo, wo, hi
    default_currency VARCHAR(3) DEFAULT 'XOF',-- Currency code
    
    -- Account Status
    status VARCHAR(20) DEFAULT 'ACTIVE',      -- ACTIVE, INACTIVE, SUSPENDED, DELETED
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED, EXPIRED
    kyc_verified_at TIMESTAMP,
    
    -- Security
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    login_attempts INT DEFAULT 0,
    account_locked_until TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT email_format CHECK (email LIKE '%@%.%'),
    CONSTRAINT phone_format CHECK (phone_number LIKE '+%')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_country ON users(country_iso);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- User Roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,           -- CUSTOMER, SELLER, DRIVER, PROVIDER, ADMIN, SUPPORT
    module VARCHAR(30) NOT NULL,              -- JDV_PAY, JDV_MARKET, JDV_TRANSPORT, etc.
    status VARCHAR(20) DEFAULT 'ACTIVE',
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, role_name, module)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_name);
CREATE INDEX idx_user_roles_module ON user_roles(module);

-- User Permissions
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    module VARCHAR(30) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(user_id, permission_name, module)
);

-- =====================================================================
-- 2. KYC (Know Your Customer)
-- =====================================================================

CREATE TABLE kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Personal Information
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10),
    nationality VARCHAR(3) NOT NULL,
    
    -- Identification
    id_type VARCHAR(50),                      -- PASSPORT, DRIVER_LICENSE, NATIONAL_ID
    id_number VARCHAR(50) UNIQUE,
    id_expiry_date DATE,
    id_document_url TEXT,
    id_verified BOOLEAN DEFAULT FALSE,
    
    -- Address
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    address_verified BOOLEAN DEFAULT FALSE,
    
    -- Proof of Residence
    proof_of_residence_url TEXT,
    proof_verified BOOLEAN DEFAULT FALSE,
    
    -- Verification Status
    submission_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_user ON kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(submission_status);

-- =====================================================================
-- 3. JDV PAY - WALLETS & TRANSACTIONS
-- =====================================================================

CREATE TABLE jdv_pay_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Balance Information
    balance_primary DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,  -- Primary currency balance
    currency_primary VARCHAR(3) NOT NULL,                     -- Primary currency code
    
    -- Multi-currency Support
    balance_secondary DECIMAL(18, 4) DEFAULT 0.0000,
    currency_secondary VARCHAR(3),
    
    -- Wallet Status
    status VARCHAR(20) DEFAULT 'ACTIVE',    -- ACTIVE, SUSPENDED, FROZEN, CLOSED
    is_default BOOLEAN DEFAULT TRUE,
    
    -- Verification & KYC
    kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_limit DECIMAL(18, 4),                -- Transaction limit based on KYC level
    daily_transaction_limit DECIMAL(18, 4),
    monthly_transaction_limit DECIMAL(18, 4),
    
    -- Anti-Money Laundering
    aml_risk_score INT DEFAULT 0,            -- 0-100
    aml_flagged BOOLEAN DEFAULT FALSE,
    aml_last_check TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT wallet_balance_check CHECK (balance_primary >= 0)
);

CREATE INDEX idx_wallet_user ON jdv_pay_wallets(user_id);
CREATE INDEX idx_wallet_status ON jdv_pay_wallets(status);

-- Wallet Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES jdv_pay_wallets(id) ON DELETE RESTRICT,
    
    -- Transaction Details
    transaction_type VARCHAR(20) NOT NULL,   -- DEBIT, CREDIT, TRANSFER, REFUND, COMMISSION
    reference_id VARCHAR(100),               -- External reference (order ID, etc.)
    
    -- Module Source
    module_source VARCHAR(30) NOT NULL,      -- JDV_MARKET, JDV_TRANSPORT, JDV_IMMO, etc.
    module_transaction_id VARCHAR(100),      -- Transaction ID from source module
    
    -- Amount & Currency
    amount_local DECIMAL(18, 4) NOT NULL,    -- Amount in wallet's currency
    currency_local VARCHAR(3) NOT NULL,
    amount_original DECIMAL(18, 4),          -- Original amount if converted
    currency_original VARCHAR(3),            -- Original currency
    exchange_rate_used DECIMAL(12, 8),       -- Conversion rate applied
    
    -- Fees
    fee_amount DECIMAL(18, 4) DEFAULT 0.0000,
    fee_reason VARCHAR(100),                 -- PLATFORM_FEE, CONVERSION_FEE, etc.
    net_amount DECIMAL(18, 4),               -- Amount after fees
    
    -- Status & Timing
    status VARCHAR(20) DEFAULT 'PENDING',    -- PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_reason TEXT,
    
    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    
    -- Metadata
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT amount_positive CHECK (amount_local > 0)
);

CREATE INDEX idx_transaction_wallet ON transactions(wallet_id);
CREATE INDEX idx_transaction_module ON transactions(module_source);
CREATE INDEX idx_transaction_status ON transactions(status);
CREATE INDEX idx_transaction_reference ON transactions(reference_id);
CREATE INDEX idx_transaction_date ON transactions(created_at DESC);
CREATE INDEX idx_transaction_type ON transactions(transaction_type);

-- Commission Records
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    wallet_id UUID NOT NULL REFERENCES jdv_pay_wallets(id) ON DELETE RESTRICT,
    
    -- Commission Details
    commission_type VARCHAR(30) NOT NULL,    -- SELLER_COMMISSION, DRIVER_COMMISSION, etc.
    commission_rate DECIMAL(5, 4) NOT NULL,  -- 0.0000 to 100.0000 %
    commission_amount DECIMAL(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Source
    source_module VARCHAR(30) NOT NULL,
    source_transaction_id VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',    -- PENDING, EARNED, PAID_OUT, CANCELLED
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_out_at TIMESTAMP,
    
    -- Payout Eligibility
    minimum_balance_required DECIMAL(18, 4),
    payout_eligible BOOLEAN DEFAULT FALSE,
    payout_eligible_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commission_wallet ON commissions(wallet_id);
CREATE INDEX idx_commission_status ON commissions(status);
CREATE INDEX idx_commission_earned ON commissions(earned_at DESC);

-- =====================================================================
-- 4. MARKETPLACE (JDV MARKET)
-- =====================================================================

CREATE TABLE market_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    parent_id UUID REFERENCES market_categories(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(slug)
);

CREATE TABLE market_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES market_categories(id) ON DELETE SET NULL,
    
    -- Product Information
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    
    -- Pricing
    price_base DECIMAL(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    discount_valid_until TIMESTAMP,
    
    -- Inventory
    stock_quantity INT DEFAULT 0,
    stock_alert_level INT DEFAULT 5,
    sku_tracking BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',     -- DRAFT, ACTIVE, INACTIVE, DELETED
    published_at TIMESTAMP,
    
    -- Media
    thumbnail_url TEXT,
    images JSONB,
    video_url TEXT,
    
    -- Geolocation
    location GEOGRAPHY(POINT, 4326),        -- PostGIS for location-based queries
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_country VARCHAR(3),
    
    -- SEO & Analytics
    meta_title VARCHAR(160),
    meta_description VARCHAR(160),
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    rating_average DECIMAL(3, 2),
    review_count INT DEFAULT 0,
    
    -- Metadata
    attributes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT price_positive CHECK (price_base > 0)
);

CREATE INDEX idx_product_seller ON market_products(seller_id);
CREATE INDEX idx_product_category ON market_products(category_id);
CREATE INDEX idx_product_status ON market_products(status);
CREATE INDEX idx_product_location ON market_products USING GIST(location);
CREATE INDEX idx_product_created ON market_products(created_at DESC);
CREATE INDEX idx_product_slug ON market_products(slug);

-- Product Orders
CREATE TABLE market_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES market_products(id) ON DELETE SET NULL,
    
    -- Order Details
    order_number VARCHAR(50) UNIQUE NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(18, 4) NOT NULL,
    total_amount DECIMAL(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Discounts & Taxes
    discount_amount DECIMAL(18, 4) DEFAULT 0.0000,
    tax_amount DECIMAL(18, 4) DEFAULT 0.0000,
    final_amount DECIMAL(18, 4) NOT NULL,
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, FAILED
    payment_method VARCHAR(30),
    jdv_pay_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Delivery
    delivery_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SHIPPED, IN_TRANSIT, DELIVERED, CANCELLED
    shipping_address TEXT NOT NULL,
    tracking_number VARCHAR(100),
    estimated_delivery DATE,
    delivered_at TIMESTAMP,
    
    -- Order Status
    status VARCHAR(20) DEFAULT 'NEW',       -- NEW, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_buyer ON market_orders(buyer_id);
CREATE INDEX idx_order_seller ON market_orders(seller_id);
CREATE INDEX idx_order_status ON market_orders(status);
CREATE INDEX idx_order_created ON market_orders(created_at DESC);

-- =====================================================================
-- 5. REAL ESTATE (JDV IMMO)
-- =====================================================================

CREATE TABLE immo_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Property Details
    title VARCHAR(200) NOT NULL,
    description TEXT,
    property_type VARCHAR(50) NOT NULL,     -- HOUSE, APARTMENT, LAND, COMMERCIAL, etc.
    bedrooms INT,
    bathrooms INT,
    total_area DECIMAL(10, 2),              -- in square meters
    
    -- Location
    location GEOGRAPHY(POINT, 4326),        -- PostGIS for location-based queries
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(3) NOT NULL,
    
    -- Pricing
    price_amount DECIMAL(18, 4) NOT NULL,
    price_currency VARCHAR(3) NOT NULL,
    price_type VARCHAR(20),                 -- SALE, RENT, BOTH
    rental_price_monthly DECIMAL(18, 4),   -- If available for rent
    
    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',     -- DRAFT, ACTIVE, SOLD, RENTED, INACTIVE
    published_at TIMESTAMP,
    
    -- Media
    thumbnail_url TEXT,
    images JSONB,
    video_url TEXT,
    virtual_tour_url TEXT,
    floor_plan_url TEXT,
    
    -- Amenities
    amenities JSONB,                         -- WiFi, Pool, Gym, Security, etc.
    utilities_included JSONB,
    
    -- Rules & Restrictions
    pet_friendly BOOLEAN DEFAULT FALSE,
    smoking_allowed BOOLEAN DEFAULT FALSE,
    lease_term_months INT,
    
    -- Analytics
    view_count INT DEFAULT 0,
    inquiry_count INT DEFAULT 0,
    booking_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_property_owner ON immo_properties(owner_id);
CREATE INDEX idx_property_type ON immo_properties(property_type);
CREATE INDEX idx_property_status ON immo_properties(status);
CREATE INDEX idx_property_location ON immo_properties USING GIST(location);
CREATE INDEX idx_property_city ON immo_properties(city);

-- =====================================================================
-- 6. TRANSPORT (JDV TRANSPORT)
-- =====================================================================

CREATE TABLE transport_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Driver Information
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry_date DATE NOT NULL,
    license_verified BOOLEAN DEFAULT FALSE,
    insurance_provider VARCHAR(100),
    insurance_number VARCHAR(100),
    insurance_expiry DATE,
    
    -- Vehicle Information
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    vehicle_license_plate VARCHAR(20),
    vehicle_year INT,
    vehicle_vin VARCHAR(50),
    registration_expiry DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'INACTIVE',  -- ACTIVE, INACTIVE, SUSPENDED, OFFLINE
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    
    -- Rating
    rating_average DECIMAL(3, 2),
    rating_count INT DEFAULT 0,
    acceptance_rate DECIMAL(5, 2),
    cancellation_rate DECIMAL(5, 2),
    
    -- Location
    current_location GEOGRAPHY(POINT, 4326),
    location_updated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_driver_user ON transport_drivers(user_id);
CREATE INDEX idx_driver_status ON transport_drivers(status);
CREATE INDEX idx_driver_location ON transport_drivers USING GIST(current_location);

-- Rides/Trips
CREATE TABLE transport_rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES transport_drivers(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Route
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address VARCHAR(255),
    dropoff_address VARCHAR(255),
    
    -- Trip Details
    distance_km DECIMAL(10, 2),
    estimated_duration_minutes INT,
    
    -- Pricing
    base_fare DECIMAL(18, 4),
    distance_fare DECIMAL(18, 4),
    time_fare DECIMAL(18, 4),
    surge_multiplier DECIMAL(5, 2) DEFAULT 1.00,
    total_fare DECIMAL(18, 4),
    currency VARCHAR(3),
    
    -- Status
    status VARCHAR(30) DEFAULT 'REQUESTED',     -- REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Payment
    payment_method VARCHAR(30),
    jdv_pay_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    
    -- Rating & Review
    rating INT,
    review TEXT,
    rated_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ride_driver ON transport_rides(driver_id);
CREATE INDEX idx_ride_customer ON transport_rides(customer_id);
CREATE INDEX idx_ride_status ON transport_rides(status);
CREATE INDEX idx_ride_created ON transport_rides(created_at DESC);

-- =====================================================================
-- 7. NOTIFICATIONS
-- =====================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50),          -- ORDER, PAYMENT, MESSAGE, ALERT, etc.
    
    -- Targeting
    module VARCHAR(30),                     -- Which module sent this notification
    related_id VARCHAR(100),                -- ID of related entity (order, transaction, etc.)
    related_type VARCHAR(50),               -- Type of related entity
    
    -- Channels
    channels JSONB,                         -- {"in_app": true, "email": true, "sms": false}
    
    -- Status
    status VARCHAR(20) DEFAULT 'SENT',      -- SENT, DELIVERED, FAILED, READ
    read_at TIMESTAMP,
    clicked_at TIMESTAMP,
    action_url VARCHAR(500),
    
    -- Metadata
    data JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_user ON notifications(user_id);
CREATE INDEX idx_notification_status ON notifications(status);
CREATE INDEX idx_notification_created ON notifications(created_at DESC);

-- =====================================================================
-- 8. AUDIT LOGS
-- =====================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(100) NOT NULL,           -- CREATE, UPDATE, DELETE, LOGIN, etc.
    entity_type VARCHAR(50),                -- User, Product, Order, etc.
    entity_id VARCHAR(100),
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    module VARCHAR(30),
    
    -- Status
    status VARCHAR(20) DEFAULT 'SUCCESS',   -- SUCCESS, FAILED
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_ip CHECK (ip_address IS NULL OR ip_address != '0.0.0.0')
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================================
-- 9. CURRENCIES & EXCHANGE RATES
-- =====================================================================

CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) UNIQUE NOT NULL,        -- ISO 4217 (XOF, USD, EUR, etc.)
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5),
    decimal_places INT DEFAULT 2,
    countries JSONB,                         -- List of countries using this currency
    
    -- Configuration
    status VARCHAR(20) DEFAULT 'ACTIVE',
    is_fiat BOOLEAN DEFAULT TRUE,
    is_crypto BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(12, 8) NOT NULL,
    source VARCHAR(50),                     -- API source (exchangerate-api, etc.)
    
    -- Pricing (markup/margin)
    platform_markup_percentage DECIMAL(5, 4) DEFAULT 0.0200,  -- 2% markup
    final_rate DECIMAL(12, 8) NOT NULL,     -- Rate after markup
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 day',
    
    UNIQUE(from_currency, to_currency),
    CONSTRAINT rate_positive CHECK (rate > 0)
);

CREATE INDEX idx_exchange_rate_currency_pair ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rate_updated ON exchange_rates(updated_at DESC);

-- =====================================================================
-- 10. COUNTRIES CONFIGURATION
-- =====================================================================

CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_iso_3 VARCHAR(3) UNIQUE NOT NULL,  -- BEN, IND, BRA, etc.
    code_iso_2 VARCHAR(2) UNIQUE NOT NULL,  -- BE, IN, BR, etc.
    code_iso_numeric VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_official VARCHAR(150),
    
    -- Regional Information
    region VARCHAR(50),                     -- Africa, Asia, Americas
    sub_region VARCHAR(100),
    
    -- Primary Configuration
    primary_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    primary_language VARCHAR(5),
    timezone VARCHAR(50),
    
    -- Geographic
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_supported BOOLEAN DEFAULT TRUE,
    payment_providers JSONB,                -- {"fedapay": true, "stripe": false}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_country_code ON countries(code_iso_3);
CREATE INDEX idx_country_region ON countries(region);

-- =====================================================================
-- 11. PAYMENT PROVIDERS
-- =====================================================================

CREATE TABLE payment_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Provider Info
    provider_name VARCHAR(50) NOT NULL,     -- fedapay, stripe, paypal, etc.
    country_code VARCHAR(3),                -- Specific to country or global
    
    -- Configuration
    api_key VARCHAR(500),                   -- Encrypted
    secret_key VARCHAR(500),                -- Encrypted
    webhook_url TEXT,
    webhook_secret VARCHAR(500),            -- Encrypted
    
    -- Environment
    environment VARCHAR(20) DEFAULT 'sandbox', -- sandbox, production
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Features
    supports_refunds BOOLEAN DEFAULT TRUE,
    supports_webhooks BOOLEAN DEFAULT TRUE,
    supports_currency JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(provider_name, country_code)
);

-- =====================================================================
-- 12. TRIGGERS & FUNCTIONS
-- =====================================================================

-- Update user.updated_at on changes
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_update BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_user_timestamp();

-- Log transaction to audit_logs
CREATE OR REPLACE FUNCTION log_transaction()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (action, entity_type, entity_id, new_values, status)
    VALUES ('CREATE', 'transaction', NEW.id::text, row_to_json(NEW), 'SUCCESS');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transaction_log AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction();

-- Update wallet timestamp
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallet_update BEFORE UPDATE ON jdv_pay_wallets
    FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();

-- =====================================================================
-- 13. ROW-LEVEL SECURITY (RLS) - For Supabase
-- =====================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jdv_pay_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can only see their own wallet
CREATE POLICY "Users can view own wallet"
    ON jdv_pay_wallets FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (
        wallet_id IN (
            SELECT id FROM jdv_pay_wallets WHERE user_id = auth.uid()
        )
    );

-- Users can only see their own KYC submission
CREATE POLICY "Users can view own KYC"
    ON kyc_submissions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only see their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- =====================================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================================

-- Composite indexes for common queries
CREATE INDEX idx_orders_buyer_status ON market_orders(buyer_id, status);
CREATE INDEX idx_orders_seller_status ON market_orders(seller_id, status);
CREATE INDEX idx_transactions_wallet_date ON transactions(wallet_id, created_at DESC);
CREATE INDEX idx_products_seller_status ON market_products(seller_id, status);

-- Full-text search indexes
CREATE INDEX idx_product_search ON market_products USING GIN (
    to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

CREATE INDEX idx_property_search ON immo_properties USING GIN (
    to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

-- =====================================================================
-- INITIAL DATA (Currencies & Countries)
-- =====================================================================

INSERT INTO currencies (code, name, symbol, countries, is_fiat) VALUES
-- Africa
('XOF', 'West African CFA franc', 'Fr', '{"BEN", "BFA", "CIV", "MLI", "SEN", "TGO"}', TRUE),
('NGN', 'Nigerian Naira', '₦', '{"NGA"}', TRUE),
('ZAR', 'South African Rand', 'R', '{"ZAF"}', TRUE),
('KES', 'Kenyan Shilling', 'KSh', '{"KEN"}', TRUE),
('GHS', 'Ghanaian Cedi', '₵', '{"GHA"}', TRUE),
('TZS', 'Tanzanian Shilling', 'TSh', '{"TZA"}', TRUE),
('UGX', 'Ugandan Shilling', 'USh', '{"UGA"}', TRUE),
('EGP', 'Egyptian Pound', 'E£', '{"EGY"}', TRUE),
('MAD', 'Moroccan Dirham', 'د.م.', '{"MAR"}', TRUE),
-- Asia
('INR', 'Indian Rupee', '₹', '{"IND"}', TRUE),
('CNY', 'Chinese Yuan', '¥', '{"CHN"}', TRUE),
('JPY', 'Japanese Yen', '¥', '{"JPN"}', TRUE),
('SGD', 'Singapore Dollar', 'SGD', '{"SGP"}', TRUE),
('IDR', 'Indonesian Rupiah', 'Rp', '{"IDN"}', TRUE),
('PHP', 'Philippine Peso', '₱', '{"PHL"}', TRUE),
('THB', 'Thai Baht', '฿', '{"THA"}', TRUE),
('MYR', 'Malaysian Ringgit', 'RM', '{"MYS"}', TRUE),
('VND', 'Vietnamese Dong', '₫', '{"VNM"}', TRUE),
('PKR', 'Pakistani Rupee', 'Rs', '{"PAK"}', TRUE),
-- Americas
('USD', 'United States Dollar', '$', '{"USA", "PAN", "ECU"}', TRUE),
('MXN', 'Mexican Peso', '$', '{"MEX"}', TRUE),
('BRL', 'Brazilian Real', 'R$', '{"BRA"}', TRUE),
('ARS', 'Argentine Peso', '$', '{"ARG"}', TRUE),
('CLP', 'Chilean Peso', '$', '{"CHL"}', TRUE),
('COP', 'Colombian Peso', '$', '{"COL"}', TRUE),
('JMD', 'Jamaican Dollar', 'J$', '{"JAM"}', TRUE),
('TTD', 'Trinidad and Tobago Dollar', 'TT$', '{"TTO"}', TRUE),
-- Global
('EUR', 'Euro', '€', '{}', TRUE),
('GBP', 'British Pound', '£', '{"GBR"}', TRUE);

-- Note: Full country data should be imported separately

CREATE INDEX idx_currency_code ON currencies(code);

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================