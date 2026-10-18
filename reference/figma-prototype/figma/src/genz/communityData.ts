import { Category } from './types';
import { users, currentUser } from './data';

export type MembershipState = 'guest' | 'pending' | 'invited' | 'member' | 'admin';
export type CommunityPrivacy = 'public' | 'private' | 'invite';

export type CommunityMember = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: 'Admin' | 'Moderator' | 'Member';
};

export type CommunityMessage = {
  id: string;
  authorId: string;
  name: string;
  username: string;
  avatar: string;
  body: string;
  timestamp: string;
  role?: 'Admin' | 'Moderator';
  reactions?: { emoji: string; count: number }[];
  attachment?: { kind: 'image' | 'file'; label: string; meta: string };
};

export type CommunityContentItem = {
  id: string;
  kind: 'guide' | 'video' | 'deck' | 'toolkit';
  title: string;
  meta: string;
  author: string;
  emoji: string;
  accent: string;
  pinned?: boolean;
};

export type Community = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  category: Category;
  privacy: CommunityPrivacy;
  members: number;
  posts: number;
  online: number;
  createdOn: string;
  location: string;
  rules: string[];
  membership: MembershipState;
  invitedBy?: string;
};

export const communities: Community[] = [
  {
    id: 'c1',
    name: 'Climate Builders Collective',
    tagline: 'Ship climate projects, not just posts',
    description:
      'A working community for Gen Z builders turning climate anxiety into shipped projects — reforestation drives, energy audits, and open-source climate tools. Weekly build calls, shared toolkits, and honest feedback.',
    emoji: '🌱',
    category: 'climate',
    privacy: 'public',
    members: 2480,
    posts: 318,
    online: 64,
    createdOn: 'March 2026',
    location: 'Global · Remote',
    rules: [
      'Bring receipts — share progress, not promises.',
      'Critique the work, never the person.',
      'No brand spam or recruiting without admin approval.',
    ],
    membership: 'guest',
  },
  {
    id: 'c2',
    name: 'Mind Space',
    tagline: 'Peer support for youth mental wellness',
    description:
      'A private, approval-based space where members share peer support practices, run listening circles, and build mental-health resources for schools and campuses.',
    emoji: '💚',
    category: 'mental-health',
    privacy: 'private',
    members: 864,
    posts: 512,
    online: 22,
    createdOn: 'January 2026',
    location: 'India · Hybrid',
    rules: [
      'What is shared here stays here.',
      'Support first, advise second.',
      'No diagnosing or medical claims.',
    ],
    membership: 'pending',
  },
  {
    id: 'c3',
    name: 'Housing Justice Lab',
    tagline: 'Invite-only research and campaign crew',
    description:
      'A small invite-only lab of organisers, researchers, and designers working on affordable housing campaigns, tenant tooling, and policy briefs.',
    emoji: '🏘️',
    category: 'housing',
    privacy: 'invite',
    members: 148,
    posts: 96,
    online: 9,
    createdOn: 'June 2026',
    location: 'Bengaluru',
    rules: [
      'Invite only — vouch for people you bring in.',
      'Share drafts early, credit collaborators.',
      'Keep partner data confidential.',
    ],
    membership: 'invited',
    invitedBy: 'Priya Patel',
  },
  {
    id: 'c4',
    name: 'Open Source for Good',
    tagline: 'Code that serves communities',
    description:
      'Members ship and maintain open-source tools for nonprofits and community groups. Mentored issues, pair-programming hours, and a shared component library.',
    emoji: '⚡',
    category: 'tech',
    privacy: 'public',
    members: 1932,
    posts: 744,
    online: 118,
    createdOn: 'November 2025',
    location: 'Global · Remote',
    rules: [
      'Document what you build.',
      'Mentor one newcomer per release.',
      'Licences must stay open.',
    ],
    membership: 'admin',
  },
];

export const getCommunityById = (id: string) =>
  communities.find(c => c.id === id) ?? communities[0];

export const communityMembers: CommunityMember[] = [
  { id: 'me', name: currentUser.displayName, username: currentUser.username, avatar: currentUser.avatar, role: 'Admin' },
  ...users.slice(0, 7).map((u, i) => ({
    id: u.id,
    name: u.displayName,
    username: u.username,
    avatar: u.avatar,
    role: (i === 0 ? 'Moderator' : 'Member') as CommunityMember['role'],
  })),
];

export const pinnedMessageIds = ['m1', 'm4'];
export const starredMessageIds = ['m4', 'm6'];

export const communityMessages: CommunityMessage[] = [
  {
    id: 'm1',
    authorId: 'me',
    name: currentUser.displayName,
    username: currentUser.username,
    avatar: currentUser.avatar,
    role: 'Admin',
    body: 'Welcome to the build channel. Start here: read the pinned onboarding guide, then drop a one-line intro with the project you are shipping this month.',
    timestamp: '2 days ago',
    reactions: [{ emoji: '⚡', count: 41 }, { emoji: '🌱', count: 18 }],
  },
  {
    id: 'm2',
    authorId: users[0].id,
    name: users[0].displayName,
    username: users[0].username,
    avatar: users[0].avatar,
    role: 'Moderator',
    body: 'Build call moved to Thursday 7pm IST — same link. Bring a 2-minute demo, even if it is broken.',
    timestamp: '9h ago',
    reactions: [{ emoji: '👍', count: 12 }],
  },
  {
    id: 'm3',
    authorId: users[1].id,
    name: users[1].displayName,
    username: users[1].username,
    avatar: users[1].avatar,
    body: 'Our campus tree-mapping pilot hit 300 logged trees. Sharing the data template if anyone wants to run it in their city.',
    timestamp: '6h ago',
    attachment: { kind: 'file', label: 'tree-mapping-template.csv', meta: 'CSV · 48 KB' },
    reactions: [{ emoji: '🔥', count: 27 }],
  },
  {
    id: 'm4',
    authorId: users[2].id,
    name: users[2].displayName,
    username: users[2].username,
    avatar: users[2].avatar,
    body: 'Grant deadline reminder: the Youth Climate Fund closes on the 28th. Draft applications get reviewed here every Sunday.',
    timestamp: '4h ago',
    reactions: [{ emoji: '📌', count: 9 }, { emoji: '🙏', count: 6 }],
  },
  {
    id: 'm5',
    authorId: users[3].id,
    name: users[3].displayName,
    username: users[3].username,
    avatar: users[3].avatar,
    body: 'Anyone in Pune free Saturday? We need two more volunteers for the river clean-up logistics.',
    timestamp: '2h ago',
  },
  {
    id: 'm6',
    authorId: users[4].id,
    name: users[4].displayName,
    username: users[4].username,
    avatar: users[4].avatar,
    body: 'Energy audit toolkit v2 is out — added the school checklist everyone asked for last week.',
    timestamp: '38m ago',
    attachment: { kind: 'image', label: 'audit-toolkit-cover.png', meta: 'Image · 1.2 MB' },
    reactions: [{ emoji: '⚡', count: 15 }],
  },
];

export const communityContent: CommunityContentItem[] = [
  { id: 'ct1', kind: 'guide', title: 'Community Onboarding Guide', meta: 'Updated 3 days ago · 6 min read', author: currentUser.displayName, emoji: '📘', accent: '#00FFFF', pinned: true },
  { id: 'ct2', kind: 'toolkit', title: 'Energy Audit Toolkit v2', meta: 'PDF · 4.1 MB', author: users[4].displayName, emoji: '🧰', accent: '#FFD700' },
  { id: 'ct3', kind: 'video', title: 'Build Call — Demo Day Recording', meta: 'Video · 42 min', author: users[0].displayName, emoji: '🎬', accent: '#A78BFA' },
  { id: 'ct4', kind: 'deck', title: 'Youth Climate Fund — Pitch Template', meta: 'Slides · 18 pages', author: users[2].displayName, emoji: '📊', accent: '#4ADE80' },
];

export type FollowRequest = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  mutuals: number;
  timestamp: string;
  note?: string;
};

export const followRequests: FollowRequest[] = users.slice(2, 7).map((u, i) => ({
  id: u.id,
  name: u.displayName,
  username: u.username,
  avatar: u.avatar,
  mutuals: [4, 12, 1, 7, 0][i] ?? 0,
  timestamp: ['2m ago', '1h ago', '5h ago', 'Yesterday', '3d ago'][i] ?? 'Recently',
  note: i === 1 ? 'We met at the climate build call — would love to follow your work.' : undefined,
}));

export type BlockedUser = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  blockedOn: string;
  reason: string;
};

export const blockedUsers: BlockedUser[] = users.slice(7, 10).map((u, i) => ({
  id: u.id,
  name: u.displayName,
  username: u.username,
  avatar: u.avatar,
  blockedOn: ['12 Aug 2026', '3 Jul 2026', '19 May 2026'][i] ?? '2026',
  reason: ['Spam or scam', 'Harassment', 'Unwanted contact'][i] ?? 'Other',
}));
