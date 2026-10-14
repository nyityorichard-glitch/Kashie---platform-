-- =========================================================
-- KASHIE DATABASE SCHEMA
-- PostgreSQL
-- =========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. USER ACCOUNTS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'artist'
        CHECK (role IN ('artist', 'buyer', 'admin')),

    account_status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
            account_status IN (
                'active',
                'pending',
                'suspended',
                'disabled'
            )
        ),

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(account_status);


-- =========================================================
-- 2. ARTIST PROFILES
-- =========================================================

CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    artist_id VARCHAR(50) UNIQUE,

    biography TEXT,

    institution VARCHAR(200),

    specialization VARCHAR(150),

    location VARCHAR(150),

    profile_image_url TEXT,

    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            verification_status IN (
                'pending',
                'verified',
                'rejected'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_verification
    ON artists(verification_status);


-- =========================================================
-- 3. ARTWORKS
-- =========================================================

CREATE TABLE IF NOT EXISTS artworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    artist_id UUID NOT NULL
        REFERENCES artists(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    medium VARCHAR(100),

    artwork_category VARCHAR(100),

    price NUMERIC(14, 2)
        CHECK (price IS NULL OR price >= 0),

    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    image_url TEXT,

    artwork_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            artwork_status IN (
                'pending',
                'approved',
                'rejected',
                'sold',
                'unavailable'
            )
        ),

    availability_status VARCHAR(30) NOT NULL DEFAULT 'available'
        CHECK (
            availability_status IN (
                'available',
                'reserved',
                'sold',
                'unavailable'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artworks_artist
    ON artworks(artist_id);

CREATE INDEX IF NOT EXISTS idx_artworks_status
    ON artworks(artwork_status);

CREATE INDEX IF NOT EXISTS idx_artworks_created
    ON artworks(created_at DESC);


-- =========================================================
-- 4. ORDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_reference VARCHAR(100) NOT NULL UNIQUE,

    buyer_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    artwork_id UUID
        REFERENCES artworks(id)
        ON DELETE SET NULL,

    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount >= 0),

    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    order_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            order_status IN (
                'pending',
                'paid',
                'cancelled',
                'refunded',
                'completed'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer
    ON orders(buyer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(order_status);


-- =========================================================
-- 5. PAYMENT RECORDS
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id)
        ON DELETE RESTRICT,

    provider VARCHAR(50) NOT NULL DEFAULT 'paystack',

    provider_reference VARCHAR(200) UNIQUE,

    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount >= 0),

    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            payment_status IN (
                'pending',
                'successful',
                'failed',
                'refunded'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order
    ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(payment_status);


-- =========================================================
-- 6. COMMISSION PROJECTS
-- =========================================================

CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    artist_id UUID
        REFERENCES artists(id)
        ON DELETE SET NULL,

    project_title VARCHAR(200) NOT NULL,

    project_description TEXT,

    agreed_amount NUMERIC(14, 2)
        CHECK (
            agreed_amount IS NULL OR agreed_amount >= 0
        ),

    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    project_status VARCHAR(40) NOT NULL DEFAULT 'requested'
        CHECK (
            project_status IN (
                'requested',
                'under_review',
                'artist_selected',
                'in_progress',
                'quality_check',
                'delivered',
                'completed',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 7. EXHIBITIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS exhibitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(200) NOT NULL,

    description TEXT,

    venue VARCHAR(200),

    location VARCHAR(200),

    start_date DATE,

    end_date DATE,

    exhibition_status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (
            exhibition_status IN (
                'draft',
                'upcoming',
                'active',
                'completed',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 8. ADMINISTRATIVE AUDIT LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150) NOT NULL,

    entity_type VARCHAR(100),

    entity_id TEXT,

    details JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created
    ON admin_audit_logs(created_at DESC);

COMMIT;
