-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Clean up existing tables and types if they exist (allows fresh rebuilds without errors)
drop table if exists finance_ledger cascade;
drop table if exists labour_payments cascade;
drop table if exists labour_attendance cascade;
drop table if exists labour_master cascade;
drop table if exists materials_inventory cascade;
drop table if exists plants_inventory cascade;
drop table if exists delivery_challans cascade;
drop table if exists boq_items cascade;
drop table if exists invoices cascade;
drop table if exists quotations cascade;
drop table if exists documents cascade;
drop table if exists daily_site_reports cascade;
drop table if exists schedule_stages cascade;
drop table if exists tasks cascade;
drop table if exists site_drawing_revisions cascade;
drop table if exists site_drawings cascade;
drop table if exists project_team cascade;
drop table if exists projects cascade;
drop table if exists profiles cascade;

drop type if exists user_role cascade;
drop type if exists project_type cascade;
drop type if exists drawing_status cascade;
drop type if exists task_status cascade;

-- ROLES ENUM
create type user_role as enum ('Admin', 'Designer', 'Nursery Manager', 'Supervisor', 'Client');
create type project_type as enum ('Residential', 'Commercial', 'Industrial', 'Maintenance', 'Plantation');
-- Drawing Status
create type drawing_status as enum ('Draft', 'Under Review', 'Approved', 'Revision Required', 'Final Issue');
-- Task Status
create type task_status as enum ('Pending', 'In Progress', 'Completed', 'On Hold');

-- 1. USERS & ROLES
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role user_role default 'Client',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PROJECTS
create table projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  client_name text not null,
  client_email text,
  type project_type not null,
  site_address text,
  map_location text, -- URL to Google Maps
  plot_area numeric, -- Size in sqft or acres
  budget numeric,
  start_date date,
  completion_date date,
  status text default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. TEAM ASSIGNMENT
create table project_team (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  profile_id uuid references profiles on delete cascade,
  assigned_role text, -- Designer, Supervisor, Nursery Manager, Worker Coordinator
  unique(project_id, profile_id)
);

-- 4. SITE DRAWINGS (Landscape layouts, irrigation grids)
create table site_drawings (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  drawing_number text not null, -- e.g., GSP-LD-001
  name text not null,
  category text not null, -- Landscape / Irrigation / Civil Layout
  revision_number integer default 0,
  uploaded_by uuid references profiles(id),
  checked_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  submission_date date default current_date,
  status drawing_status default 'Draft',
  file_url text, -- URL in Supabase Storage
  client_comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. SITE DRAWING REVISIONS
create table site_drawing_revisions (
  id uuid default uuid_generate_v4() primary key,
  drawing_id uuid references site_drawings on delete cascade,
  revision_number integer not null,
  file_url text not null,
  comments text,
  uploaded_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. TASKS
create table tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  name text not null,
  assigned_to uuid references profiles(id),
  deadline date,
  priority text default 'Medium', -- Low, Medium, High
  status task_status default 'Pending',
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. PROJECT SCHEDULE STAGES
create table schedule_stages (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  stage_name text not null, -- Earthwork, Irrigation Layout, Soil Preparation, Plantation, Hardscaping, Maintenance Period
  start_date date,
  end_date date,
  status text default 'Not Started', -- Not Started, In Progress, Completed
  delay_alerts text,
  daily_updates text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. DAILY SITE REPORTS
create table daily_site_reports (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  report_date date default current_date,
  supervisor_id uuid references profiles(id),
  weather_condition text, -- Sunny, Rainy, Overcast
  labour_count integer default 0,
  work_done text not null,
  materials_used text,
  issues_on_site text,
  photo_urls text[], -- Compressed photos URL in Supabase
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. DOCUMENTS
create table documents (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  name text not null,
  category text not null, -- Agreement, Quotation, BOQ, Invoice, Purchase Order, Plant List, Work Order
  file_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. QUOTATIONS
create table quotations (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  quotation_number text not null unique,
  client_name text not null,
  amount numeric not null,
  gst_percent numeric default 18,
  gst_amount numeric,
  total_amount numeric,
  scope_of_work text,
  status text default 'Pending', -- Pending, Approved, Rejected, Converted
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. INVOICES
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  invoice_number text not null unique,
  amount numeric not null,
  gst_percent numeric default 18,
  gst_amount numeric,
  total_amount numeric,
  due_date date,
  status text default 'Unpaid', -- Unpaid, Paid, Overdue
  file_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1 BOQ ITEMS
create table boq_items (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  category text not null, -- Plantation, Hardscaping, Soil Preparation, Irrigation, Maintenance
  item_name text not null,
  quantity numeric default 1,
  unit text, -- units, Brass, bags, running-feet, sqft
  rate numeric default 0,
  amount numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 13. DELIVERY CHALLANS
create table delivery_challans (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  challan_number text not null unique,
  material_delivered text not null, -- e.g. Native Trees, ornamental grass
  quantity text not null,
  vehicle_number text,
  driver_name text,
  site_receiver_signature text, -- URL or indicator
  delivery_date timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. PLANT INVENTORY (Nursery stock master)
create table plants_inventory (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  botanical_name text,
  category text not null, -- Ornamental Plants, Avenue Trees, Native Trees, Fruit Plants, Indoor Plants, Topiary, Medicinal Plants
  size_height text, -- e.g. 2-3 ft, 5-6 ft bag
  quantity_available integer default 0,
  low_stock_threshold integer default 10,
  nursery_source text,
  purchase_rate numeric default 0,
  selling_rate numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 15. MATERIAL INVENTORY
create table materials_inventory (
  id uuid default uuid_generate_v4() primary key,
  item_name text not null,
  category text not null, -- Pots, Fertilizers, Drip Irrigation Material, Pebbles, Soil, Cocopeat, Garden Tools
  quantity_available numeric default 0,
  unit text, -- bags, units, meters, pieces
  low_stock_threshold numeric default 5,
  purchase_rate numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 16. LABOUR MASTER
create table labour_master (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  mobile text,
  skill_type text, -- Planter, Digger, Plumber, Mason, Supervisor
  daily_wage numeric default 0,
  aadhaar_number text,
  bank_details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 17. LABOUR DAILY ATTENDANCE
create table labour_attendance (
  id uuid default uuid_generate_v4() primary key,
  labour_id uuid references labour_master on delete cascade,
  project_id uuid references projects on delete cascade,
  attendance_date date default current_date,
  status text not null, -- Present, Absent
  working_hours numeric default 8,
  overtime_hours numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(labour_id, attendance_date)
);

-- 18. LABOUR WAGE PAYMENTS
create table labour_payments (
  id uuid default uuid_generate_v4() primary key,
  labour_id uuid references labour_master on delete cascade,
  project_id uuid references projects on delete cascade,
  payment_date date default current_date,
  amount_paid numeric not null,
  advance_given numeric default 0,
  payment_mode text default 'Cash', -- Cash, Bank, UPI
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 19. FINANCE TRANSACTIONS (General Ledger)
create table finance_ledger (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects on delete cascade,
  type text not null, -- Credit (Client payment, Advance, Extra Work), Debit (Labour, Plants, Transport, Soil, Fertilizer, Machinery, Fuel, Food, Misc)
  category text not null,
  amount numeric not null,
  date date default current_date,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable Row Level Security (RLS) on all tables to allow query operations
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_team DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_drawings DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_drawing_revisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_site_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans DISABLE ROW LEVEL SECURITY;
ALTER TABLE plants_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_ledger DISABLE ROW LEVEL SECURITY;

