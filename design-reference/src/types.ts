export type Category = 'climate' | 'equality' | 'mental-health' | 'education' | 'housing' | 'community' | 'arts' | 'tech';
export type PostType = 'action' | 'event' | 'petition' | 'story';
export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'milestone';
export type AppPhase = 'splash' | 'onboarding' | 'auth' | 'app';
export type AuthScreen = 'choice' | 'login' | 'signup' | 'forgot' | 'otp';
export type AppTab = 'home' | 'explore' | 'create' | 'activity' | 'profile';

export type DetailView =
  | { type: 'post'; id: string }
  | { type: 'user'; id: string }
  | { type: 'notifications' }
  | { type: 'settings' }
  | { type: 'edit-profile' }
  | { type: 'menu' }
  | { type: 'projects-hub' }
  | { type: 'meetings-events' }
  | { type: 'resources-library' }
  | { type: 'member-directory' }
  | null;

export type Badge = {
  id: string;
  name: string;
  emoji: string;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  cause: string;
  followers: number;
  following: number;
  actionsCount: number;
  impactPoints: number;
  isVerified: boolean;
  badges: Badge[];
  joinedDate: string;
  location: string;
};

export type Post = {
  id: string;
  userId: string;
  user: User;
  type: PostType;
  title: string;
  body: string;
  image?: string;
  category: Category;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  timestamp: string;
  location?: string;
  goal?: number;
  progress?: number;
  eventDate?: string;
};

export type Comment = {
  id: string;
  user: User;
  body: string;
  timestamp: string;
  likes: number;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  user?: User;
  message: string;
  timestamp: string;
  isRead: boolean;
  postId?: string;
};

export type AppActions = {
  onPostPress: (id: string) => void;
  onUserPress: (id: string) => void;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onFollow: (id: string) => void;
  onBack: () => void;
  onNavigate: (tab: AppTab) => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenEditProfile: () => void;
  onOpenMenu: (sub?: 'projects-hub' | 'meetings-events' | 'resources-library' | 'member-directory') => void;
};
