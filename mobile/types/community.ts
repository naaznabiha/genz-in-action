/**
 * Community shapes (Phase 6; supabase/migrations/20261024120000…120700).
 * Identity (name, description, image, public/private, member count) is public
 * (D47); the discussion, content and member list are readable only when
 * `can_read` is true (members, or anyone for a public community — D49).
 */
export type CommunityRole = "owner" | "admin" | "member";
export type MembershipStatus = "active" | "left" | "removed";
export type AttachmentKind = "image" | "pdf";

/** One row of get_communities (Explore → Communities). */
export type CommunitySummary = {
  id: string;
  name: string;
  description: string;
  image_path: string | null;
  is_private: boolean;
  owner_id: string;
  member_count: number;
  /** Your active role, or null when you aren't a member. */
  my_role: CommunityRole | null;
  created_at: string;
};
export type CommunityCursor = { createdAt: string; id: string };
export type CommunityPage = { communities: CommunitySummary[]; nextCursor: CommunityCursor | null };

/** get_community: the detail header plus your state. Counts are null unless you can read it. */
export type CommunityDetail = {
  id: string;
  name: string;
  description: string;
  image_path: string | null;
  is_private: boolean;
  owner_id: string;
  owner_username: string | null;
  owner_display_name: string | null;
  created_at: string;
  member_count: number;
  my_role: CommunityRole | null;
  my_status: MembershipStatus | null;
  my_joined_at: string | null;
  can_read: boolean;
  pending_invite_id: string | null;
  invited_by_name: string | null;
  pinned_count: number | null;
  messages_today: number | null;
  content_count: number | null;
};

/** get_my_community_invites: invitations waiting for you. */
export type MyCommunityInvite = {
  invite_id: string;
  community_id: string;
  community_name: string;
  community_image: string | null;
  is_private: boolean;
  inviter_id: string;
  inviter_username: string;
  inviter_display_name: string;
  created_at: string;
};

export type CommunityMember = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  role: CommunityRole;
  /** 0 owner, 1 admin, 2 member — the list's sort order and cursor. */
  role_rank: number;
  joined_at: string;
};
export type MemberCursor = { rank: number; name: string };
export type MemberPage = { members: CommunityMember[]; nextCursor: MemberCursor | null };

/** get_community_invites: pending invites (owner/admin see all; others only their own). */
export type PendingInvite = {
  invite_id: string;
  invitee_id: string;
  invitee_username: string;
  invitee_display_name: string;
  invitee_avatar_path: string | null;
  inviter_id: string;
  inviter_display_name: string;
  created_at: string;
};

export type Attachment = {
  path: string;
  kind: AttachmentKind;
  name: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  /** Short-lived signed URL (private bucket); null if it couldn't be signed. */
  url: string | null;
};

export type MessageRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  /** Current role; null when the author is no longer a member. */
  author_role: CommunityRole | null;
  body: string;
  attachment_path: string | null;
  attachment_kind: AttachmentKind | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_width: number | null;
  attachment_height: number | null;
  created_at: string;
  pinned: boolean;
  starred_by_me: boolean;
};
export type CommunityMessage = MessageRow & { attachment: Attachment | null };
export type MessageCursor = { createdAt: string; id: string };
export type MessagePage = { messages: CommunityMessage[]; nextCursor: MessageCursor | null };

export type PinnedMessage = {
  id: string;
  author_id: string;
  author_display_name: string;
  body: string;
  attachment_kind: AttachmentKind | null;
  attachment_name: string | null;
  created_at: string;
  pinned_at: string;
  pinned_by_name: string | null;
};

export type StarredRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  body: string;
  attachment_path: string | null;
  attachment_kind: AttachmentKind | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
  pinned: boolean;
  starred_at: string;
};
export type StarredMessage = StarredRow & { attachment: Attachment | null };
export type StarredPage = { messages: StarredMessage[]; nextCursor: MessageCursor | null };

export type FeedFilter = "all" | "posts" | "photos" | "documents" | "text";

/** One row of get_community_feed: a content item or a post shared to the community. */
export type FeedRow = {
  item_type: "content" | "post";
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  /** false → shown as "no longer a member" (content stays, D49). */
  author_is_member: boolean;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  attachment_path: string | null;
  attachment_kind: AttachmentKind | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_width: number | null;
  attachment_height: number | null;
  post_type: string | null;
  post_category: string | null;
  post_location: string | null;
  post_event_at: string | null;
  like_count: number | null;
  comment_count: number | null;
  liked_by_me: boolean | null;
  saved_by_me: boolean | null;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
};

/** A community content item (Content tab / content page). */
export type ContentItem = {
  id: string;
  community_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  author_is_member: boolean;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  attachment: Attachment | null;
};

/** A picked file ready to upload into community-media. */
export type PickedAttachment =
  | { kind: "image"; uri: string; base64: string; width: number; height: number; name: string }
  | { kind: "pdf"; uri: string; bytes: Uint8Array; size: number; name: string };
