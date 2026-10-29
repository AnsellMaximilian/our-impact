export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      campaign_organizations: {
        Row: {
          campaign_id: string;
          created_at: string;
          display_order: number;
          id: number;
          organization_id: number;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          display_order: number;
          id?: never;
          organization_id: number;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          display_order?: number;
          id?: never;
          organization_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_organizations_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_organizations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          allocation_model: string;
          budget_minor: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          period_cadence: string;
          public_id: string;
          published_at: string | null;
          status: string;
          summary: string;
          timezone: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          allocation_model?: string;
          budget_minor: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          period_cadence?: string;
          public_id: string;
          published_at?: string | null;
          status?: string;
          summary: string;
          timezone?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          allocation_model?: string;
          budget_minor?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          period_cadence?: string;
          public_id?: string;
          published_at?: string | null;
          status?: string;
          summary?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          public_name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          public_name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          public_name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          company_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          brand_color: string;
          category: string;
          country_code: string;
          created_at: string;
          id: number;
          is_active: boolean;
          name: string;
          short_description: string;
          slug: string;
          verification_state: string;
          website_url: string | null;
        };
        Insert: {
          brand_color?: string;
          category: string;
          country_code?: string;
          created_at?: string;
          id?: number;
          is_active?: boolean;
          name: string;
          short_description: string;
          slug: string;
          verification_state?: string;
          website_url?: string | null;
        };
        Update: {
          brand_color?: string;
          category?: string;
          country_code?: string;
          created_at?: string;
          id?: number;
          is_active?: boolean;
          name?: string;
          short_description?: string;
          slug?: string;
          verification_state?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_draft_campaign: {
        Args: {
          p_allocation_model: string;
          p_budget_minor: number;
          p_company_id: string;
          p_currency: string;
          p_organization_ids: number[];
          p_period_cadence: string;
          p_summary: string;
          p_timezone: string;
          p_title: string;
        };
        Returns: {
          allocation_model: string;
          budget_minor: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          period_cadence: string;
          public_id: string;
          published_at: string | null;
          status: string;
          summary: string;
          timezone: string;
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaigns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
