export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          commission_percent: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          seo_text: string | null
          show_in_header: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          commission_percent?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          seo_text?: string | null
          show_in_header?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          commission_percent?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          seo_text?: string | null
          show_in_header?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          offer_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          offer_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          offer_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: number
          ip: string
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          ip: string
          success: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
      offer_input_fields: {
        Row: {
          id: string
          key: string
          label: string
          offer_id: number
          required: boolean
          select_options: string[] | null
          sort_order: number
          type: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          offer_id: number
          required?: boolean
          select_options?: string[] | null
          sort_order?: number
          type: string
        }
        Update: {
          id?: string
          key?: string
          label?: string
          offer_id?: number
          required?: boolean
          select_options?: string[] | null
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_input_fields_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_options: {
        Row: {
          id: string
          label: string
          offer_id: number
          price_minor: number
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          offer_id: number
          price_minor: number
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          offer_id?: number
          price_minor?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_options_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          category_id: string
          created_at: string
          currency: string
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          description: string
          id: number
          image_url: string | null
          old_price_minor: number | null
          platform: string | null
          price_minor: number
          region: string | null
          sales_count: number
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["offer_status"]
          stock_count: number
          title: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string
          id?: never
          image_url?: string | null
          old_price_minor?: number | null
          platform?: string | null
          price_minor: number
          region?: string | null
          sales_count?: number
          seller_id: string
          slug: string
          status?: Database["public"]["Enums"]["offer_status"]
          stock_count?: number
          title: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string
          id?: never
          image_url?: string | null
          old_price_minor?: number | null
          platform?: string | null
          price_minor?: number
          region?: string | null
          sales_count?: number
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["offer_status"]
          stock_count?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          email: string
          id: string
          locale: string
          status: Database["public"]["Enums"]["user_status"]
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          email: string
          id: string
          locale?: string
          status?: Database["public"]["Enums"]["user_status"]
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          email?: string
          id?: string
          locale?: string
          status?: Database["public"]["Enums"]["user_status"]
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          bio: string | null
          country: string | null
          created_at: string
          display_name: string
          rating_avg: number
          rating_count: number
          sales_count: number
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name: string
          rating_avg?: number
          rating_count?: number
          sales_count?: number
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          rating_avg?: number
          rating_count?: number
          sales_count?: number
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      category_subtree: { Args: { _root: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin"
      delivery_type: "auto_codes" | "manual"
      offer_status: "draft" | "active" | "paused" | "archived"
      user_status: "active" | "suspended" | "banned"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["buyer", "seller", "admin"],
      delivery_type: ["auto_codes", "manual"],
      offer_status: ["draft", "active", "paused", "archived"],
      user_status: ["active", "suspended", "banned"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
