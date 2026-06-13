-- Création des types ENUM
CREATE TYPE user_role AS ENUM ('client', 'driver');
CREATE TYPE vehicle_size AS ENUM ('van_small', 'van_large', 'truck');
CREATE TYPE ride_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'gateway');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Table: users (liée à auth.users de Supabase)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'client',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  avatar_url VARCHAR(255),
  driver_license_number VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: vehicles
CREATE TABLE public.vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  size_category vehicle_size NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  make_model VARCHAR(100) NOT NULL,
  payload_capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: rides
CREATE TABLE public.rides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat FLOAT8 NOT NULL,
  pickup_lng FLOAT8 NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat FLOAT8 NOT NULL,
  dropoff_lng FLOAT8 NOT NULL,
  status ride_status NOT NULL DEFAULT 'pending',
  price_calculated NUMERIC(10, 2) NOT NULL,
  helpers_count INTEGER DEFAULT 0,
  distance_km NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Table: transactions
CREATE TABLE public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'OMR',
  payment_method payment_method NOT NULL DEFAULT 'cash',
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Exemples de Policies (à adapter selon les besoins exacts de sécurité)
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Les clients peuvent voir leurs propres trajets" ON public.rides FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Les chauffeurs peuvent voir les trajets en attente" ON public.rides FOR SELECT USING (status = 'pending');
CREATE POLICY "Les chauffeurs peuvent voir leurs trajets assignés" ON public.rides FOR SELECT USING (auth.uid() = driver_id);
