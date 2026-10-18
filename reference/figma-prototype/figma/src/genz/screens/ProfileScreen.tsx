import { useState } from 'react';
import { User, AppActions } from '../types';
import { currentUser, posts as allPosts } from '../data';
import { PostCard, Avatar, StatusBar, CategoryChip } from '../components/SharedUI';
import { CheckVerifiedIcon, SettingsIcon, EditIcon, MapPinIcon, CalendarIcon, TrophyIcon, LightningIcon } from '../components/Icons';

type ProfileTab = 'actions' | 'about';

type ProfileScreenProps = {
  user?: User;
  savedPosts: Set<string>;
  likedPosts: Set<string>;
  followedUsers: Set<string>;
  actions: AppActions;
  isOwnProfile?: boolean;
  showBack?: boolean;
};

export default function ProfileScreen({
  user,
  savedPosts,
  likedPosts,
  followedUsers,
  actions,
  isOwnProfile = true,
  showBack = false,
}: ProfileScreenProps) {
  const profileUser = user ?? currentUser;
  const [tab, setTab] = useState<ProfileTab>('actions');
  const [isFollowing, setIsFollowing] = useState(followedUsers.has(profileUser.id));

  const userPosts = allPosts.filter(p => p.userId === profileUser.id);

  const stats = [
    { label: 'Actions', value: profileUser.actionsCount },
    { label: 'Followers', value: formatNum(profileUser.followers) },
    { label: 'Following', value: formatNum(profileUser.following) },
    { label: 'Impact', value: `${profileUser.impactPoints}` },
  ];

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="screen-body">
        <div className="px-5 pb-4">
          <div className="flex items-start justify-between mb-5">
            {showBack ? (
              <button onClick={actions.onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}
            {isOwnProfile ? (
              <div className="flex gap-2">
                <button
                  onClick={actions.onOpenEditProfile}
                  className="w-9 h-9 flex items-center justify-center rounded-full"
                  style={{ background: '#0D2A40' }}
                >
                  <EditIcon size={17} color="#CDE2F0" />
                </button>
                <button
                  onClick={actions.onOpenSettings}
                  className="w-9 h-9 flex items-center justify-center rounded-full"
                  style={{ background: '#0D2A40' }}
                >
                  <SettingsIcon size={17} color="#CDE2F0" />
                </button>
              </div>
            ) : (
              <div style={{ width: 36 }} />
            )}
          </div>

          <div className="flex items-start gap-4 mb-5">
            <div className="relative">
              <Avatar src={profileUser.avatar} size={80} />
              {profileUser.isVerified && (
                <div className="absolute -bottom-0.5 -right-0.5">
                  <CheckVerifiedIcon size={20} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {profileUser.displayName}
              </h2>
              <p className="text-sm mb-1" style={{ color: '#CDE2F0' }}>@{profileUser.username}</p>
              {profileUser.badges.map(b => (
                <span key={b.id} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1" style={{ background: '#0D2A40', color: '#00FFFF' }}>
                  {b.emoji} {b.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm mb-4 leading-relaxed" style={{ color: '#CDE2F0' }}>{profileUser.bio}</p>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#CDE2F0' }}>
              <MapPinIcon size={13} color="#CDE2F0" />
              <span>{profileUser.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#CDE2F0' }}>
              <CalendarIcon size={13} color="#CDE2F0" />
              <span>Joined {profileUser.joinedDate}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-base font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {s.value}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#CDE2F0' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 mb-5" style={{ background: 'linear-gradient(135deg, #071828 0%, #071828 100%)', border: '1px solid rgba(0,255,255,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <LightningIcon size={16} color="#00FFFF" />
              <span className="text-sm font-bold" style={{ color: '#00FFFF' }}>Impact Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {profileUser.impactPoints.toLocaleString()}
              </span>
              <span className="text-sm" style={{ color: '#CDE2F0' }}>points</span>
            </div>
            <div className="mt-3 flex gap-2">
              {['🌊', '✊', '💙'].map((em, i) => (
                <div key={i} className="text-lg">{em}</div>
              ))}
            </div>
          </div>

          {!isOwnProfile && (
            <div className="flex gap-3 mb-5 max-w-md">
              <button
                onClick={() => { setIsFollowing(!isFollowing); actions.onFollow(profileUser.id); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={isFollowing
                  ? { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#CDE2F0' }
                  : { background: '#00BFBF', color: 'white' }
                }
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}>
                Message
              </button>
            </div>
          )}

          {isOwnProfile && (
            <button onClick={actions.onOpenEditProfile} className="w-full max-w-md py-3 rounded-xl text-sm font-semibold mb-5" style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}>
              Edit Profile
            </button>
          )}

          <div className="flex gap-2 mb-4 max-w-md">
            {(['actions', 'about'] as ProfileTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                style={tab === t
                  ? { background: '#00BFBF', color: 'white' }
                  : { background: '#0D2A40', color: '#CDE2F0' }
                }
              >
                {t === 'actions' ? `Actions (${userPosts.length})` : 'About'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'actions' ? (
          <div className="px-5 pb-8">
            {userPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm" style={{ color: '#CDE2F0' }}>No actions posted yet.</p>
              </div>
            ) : (
              <div className="feed-grid">
                {userPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isLiked={likedPosts.has(post.id)}
                    isSaved={savedPosts.has(post.id)}
                    onLike={() => actions.onLike(post.id)}
                    onSave={() => actions.onSave(post.id)}
                    onPress={() => actions.onPostPress(post.id)}
                    onUserPress={() => actions.onUserPress(post.user.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 pb-8">
            <div className="rounded-2xl p-5" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrophyIcon size={18} color="#FBBF24" />
                <h3 className="text-sm font-bold" style={{ color: '#FFFFFF' }}>Badges Earned</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {profileUser.badges.map(b => (
                  <div key={b.id} className="flex flex-col items-center gap-1 p-3 rounded-xl" style={{ background: '#0D2A40', minWidth: 70 }}>
                    <span className="text-2xl">{b.emoji}</span>
                    <span className="text-xs text-center font-medium" style={{ color: '#CDE2F0' }}>{b.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span style={{ color: '#CDE2F0' }}>Primary Cause</span>
                  <CategoryChip category={'climate'} small />
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span style={{ color: '#CDE2F0' }}>Location</span>
                  <span style={{ color: '#FFFFFF' }}>{profileUser.location}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#CDE2F0' }}>Member since</span>
                  <span style={{ color: '#FFFFFF' }}>{profileUser.joinedDate}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
