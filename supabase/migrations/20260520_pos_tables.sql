-- POS System: restaurant tables, sessions, order items

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id serial PRIMARY KEY,
  number int NOT NULL UNIQUE,
  name text,
  capacity int DEFAULT 4
);

INSERT INTO restaurant_tables (number, name, capacity) VALUES
  (1,'Tafel 1',4),(2,'Tafel 2',4),(3,'Tafel 3',4),(4,'Tafel 4',4),
  (5,'Tafel 5',4),(6,'Tafel 6',4),(7,'Tafel 7',4),(8,'Tafel 8',6),
  (9,'Tafel 9',6),(10,'Tafel 10',2),(11,'Tafel 11',2),(12,'Tafel 12',8),
  (13,'Terras 1',4),(14,'Terras 2',4),(15,'VIP',10)
ON CONFLICT (number) DO NOTHING;

CREATE TABLE IF NOT EXISTS table_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id int REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  status text DEFAULT 'open' CHECK (status IN ('open','closed')),
  guest_count int,
  note text
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES table_sessions(id) ON DELETE CASCADE,
  item_name_nl text NOT NULL,
  item_name_en text,
  item_name_tr text,
  category_nl text,
  category_en text,
  category_tr text,
  price numeric(8,2),
  quantity int DEFAULT 1 CHECK (quantity > 0),
  status text DEFAULT 'ordered' CHECK (status IN ('ordered','served','cancelled')),
  note text,
  added_by_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurant_tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
