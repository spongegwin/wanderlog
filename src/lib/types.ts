export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type TripStatus = "upcoming" | "past";
export type ParticipantRole = "organizer" | "confirmed" | "maybe" | "invited";
export type BlockType = "flight" | "stay" | "activity" | "meal" | "transport" | "hike" | "rest" | "idea";
export type BlockStatus = "idea" | "suggested" | "confirmed" | "completed";
export type HikeDifficulty = "easy" | "moderate" | "strenuous";
export type ResourceCategory = "trail_map" | "guide" | "booking" | "community" | "other";
export type TransportMode = "drive" | "ferry" | "flight" | "transit" | "walk" | "other";

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
  essence: string | null;
  photo_1_url: string | null;
  photo_2_url: string | null;
  invite_token: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  user_id: string | null;
  name: string | null;
  role: ParticipantRole;
  color: string | null;
  joined_at: string;
  invited_email: string | null;
}

export interface ItineraryBlock {
  id: string;
  trip_id: string;
  type: BlockType;
  icon: string | null;
  title: string;
  subtitle: string | null;
  status: BlockStatus;
  day_label: string | null;
  date: string | null;
  sort_order: number;
  transport_mode: TransportMode | null;
  from_location: string | null;
  to_location: string | null;
  distance_mi: number | null;
  duration_min: number | null;
  booking_conf: string | null;
  booking_details: string | null;
  booking_link: string | null;
  cancel_deadline: string | null;
  hike_start: string | null;
  hike_start_elev: string | null;
  hike_end: string | null;
  hike_end_elev: string | null;
  hike_distance: string | null;
  hike_elev_gain: string | null;
  hike_est_hours: string | null;
  hike_difficulty: HikeDifficulty | null;
  hike_has_variant: boolean;
  hike_variant_note: string | null;
  hike_elev_profile: Json | null;
  hike_waypoints: HikeWaypoint[] | null;
  weather_high: string | null;
  weather_low: string | null;
  weather_note: string | null;
  cost_amount: number | null;
  cost_currency: string;
  added_by: string | null;
  created_at: string;
}

export interface BlockBooking {
  id: string;
  block_id: string;
  user_id: string | null;
  name: string | null;
  conf_number: string | null;
  booked_at: string;
}

export interface Comment {
  id: string;
  block_id: string;
  user_id: string | null;
  author_name: string | null;
  author_color: string | null;
  text: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  block_id: string;
  user_id: string | null;
  emoji: string;
  created_at: string;
}

export type PackingScope = "shared" | "personal";

export interface PackingItem {
  id: string;
  trip_id: string;
  label: string;
  category: string;
  scope: PackingScope;
  assigned_to: string | null;
  packed: boolean;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
  sort_order: number;
}

export interface BlockVote {
  id: string;
  block_id: string;
  user_id: string | null;
  vote: "up" | "down";
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  trip_id: string;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  target_id: string | null;
  summary: string | null;
  created_at: string;
}

export interface Resource {
  id: string;
  trip_id: string;
  category: ResourceCategory | null;
  title: string | null;
  url: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
}

type RowToInsert<T> = Partial<T>;
type RowToUpdate<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: Trip;
        Insert: RowToInsert<Trip>;
        Update: RowToUpdate<Trip>;
        Relationships: [];
      };
      participants: {
        Row: Participant;
        Insert: RowToInsert<Participant>;
        Update: RowToUpdate<Participant>;
        Relationships: [];
      };
      itinerary_blocks: {
        Row: ItineraryBlock;
        Insert: RowToInsert<ItineraryBlock>;
        Update: RowToUpdate<ItineraryBlock>;
        Relationships: [];
      };
      block_bookings: {
        Row: BlockBooking;
        Insert: RowToInsert<BlockBooking>;
        Update: RowToUpdate<BlockBooking>;
        Relationships: [];
      };
      comments: {
        Row: Comment;
        Insert: RowToInsert<Comment>;
        Update: RowToUpdate<Comment>;
        Relationships: [];
      };
      reactions: {
        Row: Reaction;
        Insert: RowToInsert<Reaction>;
        Update: RowToUpdate<Reaction>;
        Relationships: [];
      };
      resources: {
        Row: Resource;
        Insert: RowToInsert<Resource>;
        Update: RowToUpdate<Resource>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface HikeWaypoint {
  location: string;
  elevation_ft?: number | null;
  gain_ft?: number | null;
  loss_ft?: number | null;
  dist_mi?: number | null;
  total_dist_mi?: number | null;
  duration?: string | null;
  time?: string | null;
  escape?: string | null;
  notes?: string | null;
  is_break?: boolean;
  lat?: number | null;
  lon?: number | null;
}

export type ParsedBlock = {
  type: BlockType;
  icon: string;
  title: string;
  subtitle: string;
  status: BlockStatus;
  day_label: string | null;
  date: string | null;
  booking_conf: string | null;
  booking_link: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  cancel_deadline: string | null;
  transport_mode: TransportMode | null;
  from_location: string | null;
  to_location: string | null;
  distance_mi: number | null;
  duration_min: number | null;
};

export type Confidence = "found" | "inferred" | "missing";

export type ParsedHike = {
  name: string;
  start_point: string;
  end_point: string;
  distance: string | null;
  elevation_gain: string | null;
  est_hours: string | null;
  day_label: string | null;
  date: string | null;
  difficulty: HikeDifficulty | null;
  has_variant: boolean;
  variant_note: string | null;
  notes: string | null;
  booking_link: string | null;
  confidence: {
    name: Confidence;
    start_point: Confidence;
    end_point: Confidence;
    distance: Confidence;
    elevation_gain: Confidence;
    est_hours: Confidence;
    day_label: Confidence;
    date: Confidence;
    difficulty: Confidence;
  };
};
