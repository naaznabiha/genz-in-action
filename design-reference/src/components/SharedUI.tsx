import React, { useState } from 'react';
import { Post, User, Category } from '../types';
import { CATEGORY_COLORS, CATEGORY_LABELS, TYPE_LABELS } from '../data';
import {
  HeartIcon, HeartFilledIcon, ChatBubbleIcon, ShareIcon,
  BookmarkIcon, BookmarkFilledIcon, CheckVerifiedIcon,
  MapPinIcon, CalendarIcon, DotsIcon, LightningIcon,
} from './Icons';

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

type AvatarProps = {
  src: string;
  size?: number;
  className?: string;
  onClick?: (e?: React.MouseEvent) => void;
};
export function Avatar({ src, size = 36, className = '', onClick }: AvatarProps) {
  return (
    <img
      src={src}
      alt="avatar"
      width={size}
      height={size}
      onClick={onClick}
      className={`rounded-full object-cover flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

type CategoryChipProps = { category: Category; small?: boolean };
export function CategoryChip({ category, small = false }: CategoryChipProps) {
  const c = CATEGORY_COLORS[category];
  return (
    <span
      className={`rounded-full font-semibold ${small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

type TypeBadgeProps = { type: string };
export function TypeBadge({ type }: TypeBadgeProps) {
  const map: Record<string, string> = {
    action: '#00BFBF',
    event: '#0EA5E9',
    petition: '#FF5555',
    story: '#F59E0B',
  };
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
      style={{ background: map[type] ?? '#00BFBF' }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

type ProgressBarProps = { goal: number; progress: number; color?: string };
export function ProgressBar({ goal, progress, color = '#00BFBF' }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((progress / goal) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1" style={{ color: '#CDE2F0' }}>
        <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatNumber(progress)} signed</span>
        <span>Goal: {formatNumber(goal)}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#0D2A40' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

type PostCardProps = {
  post: Post;
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onSave: () => void;
  onPress: () => void;
  onUserPress: () => void;
};

export function PostCard({ post, isLiked, isSaved, onLike, onSave, onPress, onUserPress }: PostCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [saved, setSaved] = useState(isSaved);
  const [likeCount, setLikeCount] = useState(post.likes);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
    onLike();
  };
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(!saved);
    onSave();
  };

  return (
    <div
      onClick={onPress}
      className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
      style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {post.image && (
        <div className="relative">
          <img src={post.image} alt={post.title} className="w-full object-cover" style={{ aspectRatio: '16/9', maxHeight: 280 }} />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <TypeBadge type={post.type} />
            <CategoryChip category={post.category} small />
          </div>
        </div>
      )}

      <div className="p-4">
        {!post.image && (
          <div className="flex gap-1.5 mb-3">
            <TypeBadge type={post.type} />
            <CategoryChip category={post.category} small />
          </div>
        )}

        <div className="flex items-start gap-3 mb-3">
          <Avatar src={post.user.avatar} size={32} onClick={() => { onUserPress(); }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>{post.user.displayName}</span>
              {post.user.isVerified && <CheckVerifiedIcon size={14} />}
            </div>
            <span className="text-xs" style={{ color: '#CDE2F0' }}>@{post.user.username} · {post.timestamp}</span>
          </div>
        </div>

        <h3 className="text-base font-bold mb-2 leading-snug" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {post.title}
        </h3>

        <p className="text-sm leading-relaxed mb-3 line-clamp-3" style={{ color: '#CDE2F0' }}>
          {post.body}
        </p>

        {(post.eventDate || post.location) && (
          <div className="flex flex-wrap gap-3 mb-3">
            {post.eventDate && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#00FFFF' }}>
                <CalendarIcon size={13} color="#00FFFF" />
                <span>{post.eventDate}</span>
              </div>
            )}
            {post.location && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#CDE2F0' }}>
                <MapPinIcon size={13} color="#CDE2F0" />
                <span>{post.location}</span>
              </div>
            )}
          </div>
        )}

        {post.goal != null && post.progress != null && (
          <ProgressBar goal={post.goal} progress={post.progress} />
        )}

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="flex items-center gap-1.5 transition-colors" style={{ color: liked ? '#FF5555' : '#CDE2F0' }}>
              {liked
                ? <HeartFilledIcon size={18} color="#FF5555" />
                : <HeartIcon size={18} color="#CDE2F0" />}
              <span className="text-xs font-medium">{formatNumber(likeCount)}</span>
            </button>
            <button className="flex items-center gap-1.5" style={{ color: '#CDE2F0' }}>
              <ChatBubbleIcon size={18} color="#CDE2F0" />
              <span className="text-xs font-medium">{formatNumber(post.comments)}</span>
            </button>
            <button className="flex items-center gap-1.5" style={{ color: '#CDE2F0' }}>
              <ShareIcon size={18} color="#CDE2F0" />
              <span className="text-xs font-medium">{formatNumber(post.shares)}</span>
            </button>
          </div>
          <button onClick={handleSave} className="transition-colors">
            {saved
              ? <BookmarkFilledIcon size={18} color="#00FFFF" />
              : <BookmarkIcon size={18} color="#CDE2F0" />}
          </button>
        </div>
      </div>
    </div>
  );
}

type UserRowProps = {
  user: User;
  isFollowing: boolean;
  onFollow: () => void;
  onPress: () => void;
  compact?: boolean;
};
export function UserRow({ user, isFollowing, onFollow, onPress, compact = false }: UserRowProps) {
  const [following, setFollowing] = useState(isFollowing);

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowing(!following);
    onFollow();
  };

  return (
    <div onClick={onPress} className="flex items-center gap-3 cursor-pointer py-2">
      <Avatar src={user.avatar} size={compact ? 36 : 44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm truncate" style={{ color: '#FFFFFF' }}>{user.displayName}</span>
          {user.isVerified && <CheckVerifiedIcon size={13} />}
        </div>
        {!compact && <p className="text-xs truncate" style={{ color: '#CDE2F0' }}>@{user.username} · {user.cause}</p>}
        {compact && <p className="text-xs" style={{ color: '#CDE2F0' }}>@{user.username}</p>}
      </div>
      <button
        onClick={handleFollow}
        className="text-xs font-semibold px-4 py-1.5 rounded-full transition-all flex-shrink-0"
        style={following
          ? { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#CDE2F0' }
          : { background: '#00BFBF', color: 'white' }
        }
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};
export function Input({ label, error, icon, rightIcon, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="text-sm font-medium mb-1.5 block" style={{ color: '#CDE2F0' }}>{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>}
        <input
          {...props}
          className={`w-full rounded-xl px-4 py-3.5 text-sm outline-none transition-all ${icon ? 'pl-11' : ''} ${rightIcon ? 'pr-11' : ''} ${className}`}
          style={{
            background: '#0D2A40',
            color: '#FFFFFF',
            border: error ? '1px solid #FF5555' : '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'Inter', sans-serif",
          }}
        />
        {rightIcon && <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightIcon}</div>}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#FF5555' }}>{error}</p>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
};
export function Button({ variant = 'primary', size = 'md', loading, fullWidth, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2';
  const sizes = { sm: 'px-4 py-2 text-sm', md: 'px-5 py-3.5 text-sm', lg: 'px-6 py-4 text-base' };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: disabled ? '#004444' : '#00BFBF', color: 'white' },
    secondary: { background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)' },
    ghost: { background: 'transparent', color: '#00FFFF' },
    destructive: { background: '#2D0F15', color: '#FF5555', border: '1px solid rgba(244,63,94,0.3)' },
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ ...styles[variant], opacity: (disabled || loading) ? 0.6 : 1 }}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
}

export function ScreenHeader({ title, onBack, rightAction }: { title: string; onBack?: () => void; rightAction?: React.ReactNode }) {
  return (
    <div className="flex items-center px-5 pt-4 pb-3 gap-3">
      {onBack && (
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 text-lg font-bold" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h1>
      {rightAction}
    </div>
  );
}

export function StatusBar() {
  return (
    <div className="hide-on-tablet flex items-center justify-between px-5" style={{ flexShrink: 0, paddingTop: 'max(env(safe-area-inset-top, 26px), 26px)', paddingBottom: 10 }}>
      <span className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect x="0" y="6" width="3" height="6" rx="1" fill="#FFFFFF" />
          <rect x="4.5" y="4" width="3" height="8" rx="1" fill="#FFFFFF" />
          <rect x="9" y="1.5" width="3" height="10.5" rx="1" fill="#FFFFFF" />
          <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="rgba(255,255,255,0.3)" />
        </svg>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="#FFFFFF">
          <path d="M7 2.8C9.5 2.8 11.7 3.9 13.2 5.5L14 4.7C12.3 2.8 9.8 1.5 7 1.5C4.2 1.5 1.7 2.8 0 4.7L0.8 5.5C2.3 3.9 4.5 2.8 7 2.8ZM7 5.5C8.5 5.5 9.8 6.1 10.8 7L11.6 6.2C10.4 5.1 8.8 4.4 7 4.4C5.2 4.4 3.6 5.1 2.4 6.2L3.2 7C4.2 6.1 5.5 5.5 7 5.5ZM9.5 8.8L7 11L4.5 8.8C5.3 8 6.1 7.6 7 7.6C7.9 7.6 8.7 8 9.5 8.8Z" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#FFFFFF" strokeOpacity="0.35" />
          <rect x="1.5" y="1.5" width="16" height="9" rx="2" fill="#FFFFFF" />
          <path d="M23 4.5V7.5C23.8284 7.22098 24.5 6.71393 24.5 6C24.5 5.28607 23.8284 4.77902 23 4.5Z" fill="#FFFFFF" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export function EmptyState({ emoji, title, subtitle, action }: { emoji: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-lg font-bold mb-2" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
      <p className="text-sm mb-6" style={{ color: '#CDE2F0' }}>{subtitle}</p>
      {action}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden p-4" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="skeleton rounded-xl mb-4" style={{ aspectRatio: '16/9', maxHeight: 240 }} />
      <div className="flex gap-3 mb-3">
        <div className="skeleton rounded-full" style={{ width: 32, height: 32 }} />
        <div className="flex-1">
          <div className="skeleton rounded mb-1.5" style={{ height: 12, width: '60%' }} />
          <div className="skeleton rounded" style={{ height: 10, width: '40%' }} />
        </div>
      </div>
      <div className="skeleton rounded mb-2" style={{ height: 14, width: '90%' }} />
      <div className="skeleton rounded" style={{ height: 14, width: '70%' }} />
    </div>
  );
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className="fixed bottom-28 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 z-50 pointer-events-none"
      style={{
        background: '#0D2A40',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.15)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 320,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
