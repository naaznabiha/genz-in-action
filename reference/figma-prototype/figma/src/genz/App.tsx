import { useState, useCallback } from 'react';
import { AppPhase, AuthScreen, AppTab, DetailView, AppActions } from './types';
import { posts, users, notifications, initialSavedPosts, initialLikedPosts, initialFollowedUsers, initialReadNotifications, getUserById } from './data';

import { SplashScreen, OnboardingScreen, AuthFlow } from './screens/AuthFlow';
import HomeScreen from './screens/HomeScreen';
import ExploreScreen from './screens/ExploreScreen';
import CreateScreen from './screens/CreateScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import MenuScreen from './screens/MenuScreen';
import { ProjectsHubScreen, MeetingsEventsScreen, ResourcesLibraryScreen, MemberDirectoryScreen } from './screens/MenuSubScreens';
import CreateCommunityScreen from './screens/CreateCommunityScreen';
import CommunitiesScreen from './screens/CommunitiesScreen';
import CommunityDetailScreen from './screens/CommunityDetailScreen';
import { FollowRequestsScreen, BlockedUsersScreen } from './screens/PrivacySubScreens';
import BottomNav from './components/BottomNav';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [authScreen, setAuthScreen] = useState<AuthScreen>('choice');
  const [appTab, setAppTab] = useState<AppTab>('home');
  const [detail, setDetail] = useState<DetailView>(null);
  const [prevDetail, setPrevDetail] = useState<DetailView>(null);

  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set(initialSavedPosts));
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set(initialLikedPosts));
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set(initialFollowedUsers));
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set(initialReadNotifications));

  const unreadCount = notifications.filter(n => !readNotifications.has(n.id)).length;

  const onLike = useCallback((id: string) => {
    setSavedPosts(prev => prev);
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSave = useCallback((id: string) => {
    setSavedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onFollow = useCallback((id: string) => {
    setFollowedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onMarkRead = useCallback((id: string) => {
    setReadNotifications(prev => new Set([...prev, id]));
  }, []);

  const onMarkAllRead = useCallback(() => {
    setReadNotifications(new Set(notifications.map(n => n.id)));
  }, []);

  const actions: AppActions = {
    onPostPress: (id: string) => { setPrevDetail(detail); setDetail({ type: 'post', id }); },
    onUserPress: (id: string) => { setPrevDetail(detail); setDetail({ type: 'user', id }); },
    onLike,
    onSave,
    onFollow,
    onBack: () => setDetail(null),
    onNavigate: (tab: AppTab) => { setDetail(null); setAppTab(tab); },
    onOpenNotifications: () => setDetail({ type: 'notifications' }),
    onOpenSettings: () => setDetail({ type: 'settings' }),
    onOpenEditProfile: () => setDetail({ type: 'edit-profile' }),
    onOpenMenu: (sub) => setDetail({ type: sub ?? 'menu' }),
    onOpenCommunity: (id: string) => { setPrevDetail(detail); setDetail({ type: 'community', id }); },
  };

  if (phase === 'splash') {
    return (
      <PhoneShell>
        <SplashScreen onDone={() => setPhase('onboarding')} />
      </PhoneShell>
    );
  }

  if (phase === 'onboarding') {
    return (
      <PhoneShell>
        <OnboardingScreen onDone={() => setPhase('auth')} />
      </PhoneShell>
    );
  }

  if (phase === 'auth') {
    return (
      <PhoneShell>
        <AuthFlow
          screen={authScreen}
          onScreenChange={setAuthScreen}
          onSuccess={() => setPhase('app')}
        />
      </PhoneShell>
    );
  }

  const getPost = (id: string) => posts.find(p => p.id === id);
  const getUser = (id: string) => getUserById(id);

  const renderDetailOverlay = () => {
    if (!detail) return null;

    if (detail.type === 'post') {
      const post = getPost(detail.id);
      if (!post) return null;
      return (
        <OverlayScreen>
          <PostDetailScreen
            post={post}
            isLiked={likedPosts.has(post.id)}
            isSaved={savedPosts.has(post.id)}
            actions={actions}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'user') {
      const user = getUser(detail.id);
      const isOwn = detail.id === 'me';
      const profileActions = { ...actions, onBack: () => { setDetail(prevDetail); setPrevDetail(null); } };
      return (
        <OverlayScreen>
          <ProfileScreen
            user={user}
            savedPosts={savedPosts}
            likedPosts={likedPosts}
            followedUsers={followedUsers}
            actions={profileActions}
            isOwnProfile={isOwn}
            showBack
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'notifications') {
      return (
        <OverlayScreen>
          <NotificationsScreen
            readNotifications={readNotifications}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onBack={() => setDetail(null)}
            onUserPress={actions.onUserPress}
            onPostPress={actions.onPostPress}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'settings') {
      return (
        <OverlayScreen>
          <SettingsScreen
            onBack={() => setDetail(null)}
            onLogout={() => { setPhase('auth'); setAuthScreen('choice'); setDetail(null); }}
            onOpenEditProfile={actions.onOpenEditProfile}
            onOpenFollowRequests={() => setDetail({ type: 'follow-requests' })}
            onOpenBlockedUsers={() => setDetail({ type: 'blocked-users' })}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'edit-profile') {
      return (
        <OverlayScreen>
          <EditProfileScreen
            onBack={() => setDetail(null)}
            onSave={() => setDetail(null)}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'menu') {
      return (
        <OverlayScreen>
          <MenuScreen actions={actions} onBack={() => setDetail(null)} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'projects-hub') {
      return (
        <OverlayScreen>
          <ProjectsHubScreen onBack={() => setDetail({ type: 'menu' })} actions={actions} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'meetings-events') {
      return (
        <OverlayScreen>
          <MeetingsEventsScreen onBack={() => setDetail({ type: 'menu' })} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'resources-library') {
      return (
        <OverlayScreen>
          <ResourcesLibraryScreen onBack={() => setDetail({ type: 'menu' })} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'member-directory') {
      return (
        <OverlayScreen>
          <MemberDirectoryScreen
            onBack={() => setDetail({ type: 'menu' })}
            actions={actions}
            followedUsers={followedUsers}
            onFollow={onFollow}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'create-community') {
      return (
        <OverlayScreen>
          <CreateCommunityScreen onBack={() => setDetail({ type: 'communities' })} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'communities') {
      return (
        <OverlayScreen>
          <CommunitiesScreen
            onBack={() => setDetail({ type: 'menu' })}
            onOpenCommunity={actions.onOpenCommunity}
            onCreate={() => setDetail({ type: 'create-community' })}
          />
        </OverlayScreen>
      );
    }

    if (detail.type === 'community') {
      return (
        <OverlayScreen>
          <CommunityDetailScreen communityId={detail.id} onBack={() => setDetail({ type: 'communities' })} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'follow-requests') {
      return (
        <OverlayScreen>
          <FollowRequestsScreen onBack={() => setDetail({ type: 'settings' })} />
        </OverlayScreen>
      );
    }

    if (detail.type === 'blocked-users') {
      return (
        <OverlayScreen>
          <BlockedUsersScreen onBack={() => setDetail({ type: 'settings' })} />
        </OverlayScreen>
      );
    }

    return null;
  };

  const renderTab = () => {
    switch (appTab) {
      case 'home':
        return (
          <HomeScreen
            savedPosts={savedPosts}
            likedPosts={likedPosts}
            followedUsers={followedUsers}
            actions={actions}
            unreadCount={unreadCount}
          />
        );
      case 'explore':
        return (
          <ExploreScreen
            savedPosts={savedPosts}
            likedPosts={likedPosts}
            followedUsers={followedUsers}
            actions={actions}
          />
        );
      case 'create':
        return <CreateScreen onSuccess={() => { setAppTab('home'); }} />;
      case 'activity':
        return (
          <ActivityScreen
            savedPosts={savedPosts}
            likedPosts={likedPosts}
            actions={actions}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            savedPosts={savedPosts}
            likedPosts={likedPosts}
            followedUsers={followedUsers}
            actions={actions}
            isOwnProfile
          />
        );
    }
  };

  return (
    <PhoneShell>
      <div className="screen" style={{ background: '#0B2239' }}>
        <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderTab()}
        </div>
        <BottomNav
          activeTab={appTab}
          onTabChange={(tab) => { setDetail(null); setAppTab(tab); }}
          unreadCount={unreadCount}
        />
      </div>
      {renderDetailOverlay()}
    </PhoneShell>
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>;
}

function OverlayScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-50 animate-slide-up"
      style={{ background: '#0B2239' }}
    >
      {children}
    </div>
  );
}
