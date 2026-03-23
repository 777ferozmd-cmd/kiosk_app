# Project Context: Kiosk App

## Overview
This project is a multi-module kiosk system designed for product ordering and management. It features a modern admin dashboard for inventory and order control, and a responsive web-based kiosk for customer interactions.

## Architecture
The system is divided into two main components:
1. **Admin Dashboard (`/admin_dashboard`)**:
   - **Tech Stack**: React 19, Vite, TypeScript, Framer Motion, Lucide React.
   - **Role**: Handles administrator login, product inventory management (availability toggling), order tracking, statistics, and global application settings.
2. **Web Kiosk (`/web_kiosk`)**:
   - **Tech Stack**: Vanilla HTML5, CSS3, JavaScript.
   - **Role**: Customer-facing ordering interface. It interacts directly with Supabase for real-time menu updates and order submission.

## Backend & Database
- **Supabase**: Used as the primary backend for data storage (PostgreSQL), authentication, and real-time updates.
- **Real-time Sync**: The project leverages Supabase Realtime to push menu availability changes from the Admin Dashboard to the Web Kiosk instantly.

## Recent Features & Changes
- **Security Enhancements**: Implemented robust security measures across the Kiosk App and Admin Dashboard to prevent user tampering and ensure data integrity.
  - Added strict input validation and sanitization to prevent XSS.
  - Enforced Supabase Row Level Security (RLS) policies (`supabase_rls_policies.sql`) to protect data access and modifications.
  - Secured the admin dashboard against unauthenticated access and protected sensitive environment variables.
  - Implemented client-side state reset for the kiosk to clear data between sessions and prevent duplicate submissions.
- **Menu Management Sync**: Implemented real-time toggling of product availability. When an admin marks an item as "Sold Out" in the dashboard, the kiosk immediately grays out and disables that item.
- **Order Management**: Admin dashboard allows viewing, searching, and filtering of recent orders.
- **Razorpay Removal**: All Razorpay-related payment integration code has been removed.

## Key Files
- `admin_dashboard/src/lib/supabase.ts`: Supabase client initialization.
- `web_kiosk/app.js`: Core logic for the kiosk menu, cart, ordering, and client-side validations.
- `admin_dashboard/src/components/Login.tsx`: Secured Admin authentication component.
- `supabase_rls_policies.sql`: Database security and access control policies.
- `web_kiosk/seed.js`: Script for initializing or resetting the database schema/data.

## Current State & Next Steps
- **State**: The application is significantly more secure with RLS policies, input validation, and protected admin routes. Real-time menu sync is functional. Admin dashboard features (stats, orders, settings) are implemented.
- **Next Steps**: Continue refining the order status workflow, thoroughly test the new security boundaries, and potentially add user-facing order status tracking.
