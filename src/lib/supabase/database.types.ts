// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт. Ця стартова версія написана вручну
// й описує таблиці з міграцій 20261012000000_profiles_and_roles.sql, 20261021233408_org_roles.sql і
// 20261022000503_departments.sql, 20261022010957_approvers.sql, 20261025143511_auto_approve.sql і
// 20261025160124_permissions.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      department_members: {
        Row: {
          profile_id: string;
          department_id: string;
          approves: boolean;
          auto_approve: boolean;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          department_id: string;
          approves?: boolean;
          auto_approve?: boolean;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          department_id?: string;
          approves?: boolean;
          auto_approve?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "department_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "department_members_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          is_active: boolean;
          can_card_expense: boolean;
          can_check_request: boolean;
          can_vendor_invoice: boolean;
          can_self_purchase: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          can_card_expense?: boolean;
          can_check_request?: boolean;
          can_vendor_invoice?: boolean;
          can_self_purchase?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          is_active?: boolean;
          can_card_expense?: boolean;
          can_check_request?: boolean;
          can_vendor_invoice?: boolean;
          can_self_purchase?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
