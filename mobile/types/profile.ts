export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  cause: string;
  location: string;
  website: string;
  followers_count: number;
  following_count: number;
  actions_count: number;
  impact_points: number;
  is_verified: boolean;
  created_at: string;
};
