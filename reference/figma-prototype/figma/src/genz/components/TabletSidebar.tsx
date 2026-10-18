import { AppTab } from '../types';
import { currentUser } from '../data';
import GenzLogo from './GenzLogo';
import { Avatar } from './SharedUI';
import {
  HomeIcon, HomeFilledIcon,
  CompassIcon, CompassFilledIcon,
  PlusIcon,
  BookmarkIcon, BookmarkFilledIcon,
  PersonIcon, PersonFilledIcon,
} from './Icons';

type TabletSidebarProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount: number;
  onOpenMenu: () => void;
  onUserPress: (id: string) => void;
};

const NAV = [
  {
    id: 'home' as AppTab,
    label: 'Home',
    icon: (a: boolean) => a ? <HomeFilledIcon size={20} color="#00FFFF" /> : <HomeIcon size={20} color="#4A7A9B" />,
  },
  {
    id: 'explore' as AppTab,
    label: 'Explore',
    icon: (a: boolean) => a ? <CompassFilledIcon size={20} color="#00FFFF" /> : <CompassIcon size={20} color="#4A7A9B" />,
  },
  {
    id: 'activity' as AppTab,
    label: 'Saved',
    icon: (a: boolean) => a ? <BookmarkFilledIcon size={20} color="#00FFFF" /> : <BookmarkIcon size={20} color="#4A7A9B" />,
    badge: true,
  },
  {
    id: 'profile' as AppTab,
    label: 'Profile',
    icon: (a: boolean) => a ? <PersonFilledIcon size={20} color="#00FFFF" /> : <PersonIcon size={20} color="#4A7A9B" />,
  },
];

export default function TabletSidebar({ activeTab, onTabChange, unreadCount, onOpenMenu, onUserPress }: TabletSidebarProps) {
  return (
    <div className="tablet-sidebar">
      {/* Logo / menu button */}
      <div className="px-5 pt-8 pb-6">
        <button
          onClick={onOpenMenu}
          className="flex items-center gap-2 active:opacity-70 transition-opacity"
        >
          <GenzLogo size="sm" variant="full" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3 flex-1">
        {NAV.map(({ id, label, icon, badge }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all text-left w-full"
              style={{
                background: active ? 'rgba(0,255,255,0.1)' : 'transparent',
                color: active ? '#00FFFF' : '#4A7A9B',
                border: active ? '1px solid rgba(0,255,255,0.15)' : '1px solid transparent',
              }}
            >
              <span className="flex-shrink-0">{icon(active)}</span>
              <span className="flex-1">{label}</span>
              {badge && unreadCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#FF5555', color: '#fff' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Create — styled as a CTA */}
        <button
          onClick={() => onTabChange('create')}
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all text-left w-full mt-2"
          style={{
            background: activeTab === 'create'
              ? 'linear-gradient(135deg, #00BFBF, #00FFFF)'
              : 'linear-gradient(135deg, #005F5F, #008888)',
            color: '#fff',
          }}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <PlusIcon size={14} color="#fff" />
          </div>
          Create Post
        </button>
      </nav>

      {/* Divider + user row */}
      <div
        className="mx-4 mb-4 mt-4 pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => onUserPress('me')}
          className="flex items-center gap-3 w-full px-1 py-2 rounded-xl transition-all active:opacity-70"
        >
          <Avatar src={currentUser.avatar} size={38} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>
              {currentUser.displayName}
            </p>
            <p className="text-xs truncate" style={{ color: '#4A7A9B' }}>
              @{currentUser.username}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
