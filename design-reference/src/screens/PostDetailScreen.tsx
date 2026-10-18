import { useState } from 'react';
import { Post, AppActions } from '../types';
import { comments as allComments, currentUser } from '../data';
import { CATEGORY_COLORS, CATEGORY_LABELS, TYPE_LABELS } from '../data';
import { Avatar, ProgressBar, StatusBar } from '../components/SharedUI';
import { HeartIcon, HeartFilledIcon, ChatBubbleIcon, ShareIcon, BookmarkIcon, BookmarkFilledIcon, CheckVerifiedIcon, MapPinIcon, CalendarIcon, ArrowLeftIcon } from '../components/Icons';

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

type PostDetailProps = {
  post: Post;
  isLiked: boolean;
  isSaved: boolean;
  actions: AppActions;
};

export default function PostDetailScreen({ post, isLiked, isSaved, actions }: PostDetailProps) {
  const [liked, setLiked] = useState(isLiked);
  const [saved, setSaved] = useState(isSaved);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [comment, setComment] = useState('');
  const [localComments, setLocalComments] = useState(allComments[post.id] ?? []);
  const [submitting, setSubmitting] = useState(false);

  const catColor = CATEGORY_COLORS[post.category];

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
    actions.onLike(post.id);
  };

  const handleSave = () => {
    setSaved(!saved);
    actions.onSave(post.id);
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setLocalComments(prev => [{
        id: `c-new-${Date.now()}`,
        user: currentUser,
        body: comment,
        timestamp: 'Just now',
        likes: 0,
      }, ...prev]);
      setComment('');
      setSubmitting(false);
    }, 800);
  };

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="screen-body">
        {post.image ? (
          <div className="relative">
            <img src={post.image} alt={post.title} className="w-full object-cover" style={{ height: 240 }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(8,8,15,0.5) 0%, transparent 40%, rgba(8,8,15,0.8) 100%)' }} />
            <button
              onClick={actions.onBack}
              className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(8,8,15,0.7)', backdropFilter: 'blur(8px)' }}
            >
              <ArrowLeftIcon size={20} color="#FFFFFF" />
            </button>
            <div className="absolute top-4 right-4 flex gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
                style={{ background: 'rgba(0,200,200,0.12)', backdropFilter: 'blur(8px)' }}
              >
                {TYPE_LABELS[post.type]}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-2 flex items-center gap-3">
            <button onClick={actions.onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
              <ArrowLeftIcon size={18} color="#FFFFFF" />
            </button>
          </div>
        )}

        <div className="px-5 pt-4">
          {!post.image && (
            <div className="flex gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white" style={{ background: '#00BFBF' }}>
                {TYPE_LABELS[post.type]}
              </span>
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: catColor.bg, color: catColor.text }}>
                {CATEGORY_LABELS[post.category]}
              </span>
            </div>
          )}

          <h1 className="text-2xl font-black mb-4 leading-tight" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {post.title}
          </h1>

          <button
            onClick={() => actions.onUserPress(post.user.id)}
            className="flex items-center gap-3 mb-4"
          >
            <Avatar src={post.user.avatar} size={40} />
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm" style={{ color: '#FFFFFF' }}>{post.user.displayName}</span>
                {post.user.isVerified && <CheckVerifiedIcon size={14} />}
              </div>
              <p className="text-xs" style={{ color: '#CDE2F0' }}>@{post.user.username} · {post.timestamp}</p>
            </div>
          </button>

          {(post.eventDate || post.location) && (
            <div className="flex flex-wrap gap-4 mb-4 p-4 rounded-2xl" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              {post.eventDate && (
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} color="#00FFFF" />
                  <div>
                    <p className="text-xs" style={{ color: '#CDE2F0' }}>Date</p>
                    <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{post.eventDate}</p>
                  </div>
                </div>
              )}
              {post.location && (
                <div className="flex items-center gap-2">
                  <MapPinIcon size={16} color="#FFD700" />
                  <div>
                    <p className="text-xs" style={{ color: '#CDE2F0' }}>Location</p>
                    <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{post.location}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {post.goal != null && post.progress != null && (
            <div className="mb-4 p-4 rounded-2xl" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              <ProgressBar goal={post.goal} progress={post.progress} />
              <button
                className="w-full mt-4 py-3 rounded-xl text-sm font-bold"
                style={{ background: '#00BFBF', color: 'white' }}
              >
                ✍️ Sign This Petition
              </button>
            </div>
          )}

          <p className="text-sm leading-relaxed mb-6 whitespace-pre-line" style={{ color: '#CDE2F0' }}>
            {post.body}
          </p>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {post.tags.map(tag => (
                <span key={tag} className="text-xs px-3 py-1 rounded-full" style={{ background: '#0D2A40', color: '#CDE2F0' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-5">
              <button onClick={handleLike} className="flex items-center gap-2" style={{ color: liked ? '#FF5555' : '#CDE2F0' }}>
                {liked ? <HeartFilledIcon size={22} color="#FF5555" /> : <HeartIcon size={22} color="#CDE2F0" />}
                <span className="text-sm font-medium">{formatNumber(likeCount)}</span>
              </button>
              <button className="flex items-center gap-2" style={{ color: '#CDE2F0' }}>
                <ChatBubbleIcon size={22} color="#CDE2F0" />
                <span className="text-sm font-medium">{formatNumber(post.comments)}</span>
              </button>
              <button className="flex items-center gap-2" style={{ color: '#CDE2F0' }}>
                <ShareIcon size={22} color="#CDE2F0" />
                <span className="text-sm font-medium">{formatNumber(post.shares)}</span>
              </button>
            </div>
            <button onClick={handleSave}>
              {saved ? <BookmarkFilledIcon size={22} color="#00FFFF" /> : <BookmarkIcon size={22} color="#CDE2F0" />}
            </button>
          </div>

          {post.type === 'event' && (
            <div className="mt-5">
              <button
                className="w-full py-4 rounded-2xl text-base font-bold"
                style={{ background: 'linear-gradient(135deg, #008888, #00BFBF)', color: 'white' }}
              >
                🙋 RSVP to Event
              </button>
            </div>
          )}

          {post.type === 'action' && (
            <div className="mt-5">
              <button
                className="w-full py-4 rounded-2xl text-base font-bold"
                style={{ background: 'linear-gradient(135deg, #008888, #00BFBF)', color: 'white' }}
              >
                ⚡ Take This Action
              </button>
            </div>
          )}

          <div className="mt-7 mb-4">
            <h3 className="text-base font-bold mb-4" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Comments ({localComments.length})
            </h3>

            <div className="flex gap-3 mb-5">
              <Avatar src={currentUser.avatar} size={36} />
              <div className="flex-1 flex gap-2">
                <input
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button
                  onClick={handleComment}
                  disabled={!comment.trim() || submitting}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: comment.trim() ? '#00BFBF' : '#0D2A40', color: comment.trim() ? 'white' : '#4A7A9B' }}
                >
                  {submitting ? '...' : 'Post'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {localComments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <Avatar src={c.user.avatar} size={32} onClick={() => actions.onUserPress(c.user.id)} />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{c.user.displayName}</span>
                      <span className="text-xs" style={{ color: '#4A7A9B' }}>{c.timestamp}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#CDE2F0' }}>{c.body}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <button className="flex items-center gap-1 text-xs" style={{ color: '#CDE2F0' }}>
                        <HeartIcon size={13} color="#CDE2F0" /> {c.likes}
                      </button>
                      <button className="text-xs" style={{ color: '#CDE2F0' }}>Reply</button>
                    </div>
                  </div>
                </div>
              ))}
              {localComments.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: '#CDE2F0' }}>Be the first to comment!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
