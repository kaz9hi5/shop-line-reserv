/**
 * Database type definitions for shopSmsReserv
 * 
 * NOTE: This file can be regenerated using:
 *   supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
 * 
 * For now, these types are manually maintained based on the migration files.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean;
          created_at: string;
          updated_at: string;
          reservation_deadline_hours: number;
          default_open_time: string;
          default_close_time: string;
          default_lunch_enabled: boolean;
          default_lunch_start: string | null;
          default_lunch_end: string | null;
        };
        Insert: {
          id?: boolean;
          created_at?: string;
          updated_at?: string;
          reservation_deadline_hours?: number;
          default_open_time?: string;
          default_close_time?: string;
          default_lunch_enabled?: boolean;
          default_lunch_start?: string | null;
          default_lunch_end?: string | null;
        };
        Update: {
          id?: boolean;
          created_at?: string;
          updated_at?: string;
          reservation_deadline_hours?: number;
          default_open_time?: string;
          default_close_time?: string;
          default_lunch_enabled?: boolean;
          default_lunch_start?: string | null;
          default_lunch_end?: string | null;
        };
      };
      admin_allowed_ips: {
        Row: {
          ip: string;
          created_at: string;
          updated_at: string;
          device_fingerprint: string | null;
          staff_id: string | null;
        };
        Insert: {
          ip: string;
          created_at?: string;
          updated_at?: string;
          device_fingerprint?: string | null;
          staff_id?: string | null;
        };
        Update: {
          ip?: string;
          created_at?: string;
          updated_at?: string;
          device_fingerprint?: string | null;
          staff_id?: string | null;
        };
      };
      staff: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          name: string;
          role: "manager" | "staff";
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          name: string;
          role: "manager" | "staff";
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          name?: string;
          role?: "manager" | "staff";
        };
      };
      treatments: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          description: string;
          duration_minutes: number;
          price_yen: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          description?: string;
          duration_minutes: number;
          price_yen: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          description?: string;
          duration_minutes?: number;
          price_yen?: number;
          sort_order?: number;
        };
      };
      business_days: {
        Row: {
          day: string;
          created_at: string;
          updated_at: string;
          status: "open" | "holiday" | "closed";
          staff_id: string | null;
        };
        Insert: {
          day: string;
          created_at?: string;
          updated_at?: string;
          status: "open" | "holiday" | "closed";
          staff_id?: string | null;
        };
        Update: {
          day?: string;
          created_at?: string;
          updated_at?: string;
          status?: "open" | "holiday" | "closed";
          staff_id?: string | null;
        };
      };
      business_hours_overrides: {
        Row: {
          day: string;
          created_at: string;
          updated_at: string;
          open_time: string;
          close_time: string;
          lunch_enabled: boolean;
          lunch_start: string | null;
          lunch_end: string | null;
          staff_id: string | null;
        };
        Insert: {
          day: string;
          created_at?: string;
          updated_at?: string;
          open_time: string;
          close_time: string;
          lunch_enabled?: boolean;
          lunch_start?: string | null;
          lunch_end?: string | null;
          staff_id?: string | null;
        };
        Update: {
          day?: string;
          created_at?: string;
          updated_at?: string;
          open_time?: string;
          close_time?: string;
          lunch_enabled?: boolean;
          lunch_start?: string | null;
          lunch_end?: string | null;
          staff_id?: string | null;
        };
      };
      line_users: {
        Row: {
          line_user_id: string;
          created_at: string;
          updated_at: string;
          line_display_name: string | null;
          name: string | null;
          picture_url: string | null;
          is_friend: boolean;
          unfriended_at: string | null;
        };
        Insert: {
          line_user_id: string;
          created_at?: string;
          updated_at?: string;
          line_display_name?: string | null;
          name?: string | null;
          picture_url?: string | null;
          is_friend?: boolean;
          unfriended_at?: string | null;
        };
        Update: {
          line_user_id?: string;
          created_at?: string;
          updated_at?: string;
          line_display_name?: string | null;
          name?: string | null;
          picture_url?: string | null;
          is_friend?: boolean;
          unfriended_at?: string | null;
        };
      };
      reservations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          user_name: string;
          line_user_id: string;
          line_display_name: string | null;
          treatment_id: string | null;
          treatment_name_snapshot: string;
          treatment_duration_minutes_snapshot: number;
          treatment_price_yen_snapshot: number;
          start_at: string;
          end_at: string;
          via: "web" | "phone" | "admin";
          arrived_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          user_name: string;
          line_user_id: string;
          line_display_name?: string | null;
          treatment_id: string;
          start_at: string;
          via?: "web" | "phone" | "admin";
          arrived_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          user_name?: string;
          line_user_id?: string;
          line_display_name?: string | null;
          treatment_id?: string;
          start_at?: string;
          via?: "web" | "phone" | "admin";
          arrived_at?: string | null;
        };
      };
      customer_action_counters: {
        Row: {
          line_user_id: string;
          created_at: string;
          updated_at: string;
          reset_at: string | null;
          cancel_count: number;
          change_count: number;
        };
        Insert: {
          line_user_id: string;
          created_at?: string;
          updated_at?: string;
          reset_at?: string | null;
          cancel_count?: number;
          change_count?: number;
        };
        Update: {
          line_user_id?: string;
          created_at?: string;
          updated_at?: string;
          reset_at?: string | null;
          cancel_count?: number;
          change_count?: number;
        };
      };
    };
    Functions: {
      mark_arrived_and_reset_counts: {
        Args: {
          p_reservation_id: string;
        };
        Returns: void;
      };
    };
  };
}

