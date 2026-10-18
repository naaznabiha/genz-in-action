import { useState } from 'react';
import { currentUser } from '../data';
import { Avatar, StatusBar } from '../components/SharedUI';
import { BellIcon, ShieldIcon, EyeIcon, LogOutIcon, ChevronRightIcon, GlobeIcon, CheckVerifiedIcon, EditIcon } from '../components/Icons';

type SettingsScreenProps = {
  onBack: () => void;
  onLogout: () => void;
  onOpenEditProfile: () => void;
};

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-12 h-7 rounded-full transition-all flex-shrink-0"
      style={{ background: on ? '#00BFBF' : '#0D2A40', border: on ? 'none' : '1px solid rgba(255,255,255,0.1)' }}
    >
      <div
        className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
        style={{ left: on ? 26 : 2 }}
      />
    </button>
  );
}

type SettingItem = {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  toggle?: boolean;
  value?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  danger?: boolean;
};

function SettingRow({ item }: { item: SettingItem }) {
  const isToggle = item.toggle !== undefined && item.onToggle;
  const inner = (
    <>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.danger ? '#2D0F15' : '#0D2A40' }}>
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: item.danger ? '#FF5555' : '#FFFFFF' }}>{item.label}</p>
        {item.subtitle && <p className="text-xs mt-0.5" style={{ color: '#CDE2F0' }}>{item.subtitle}</p>}
      </div>
      {isToggle ? (
        <Toggle on={item.value ?? false} onToggle={item.onToggle!} />
      ) : (
        <ChevronRightIcon size={16} color="#4A7A9B" />
      )}
    </>
  );

  if (isToggle) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-4">
        {inner}
      </div>
    );
  }

  return (
    <button
      onClick={item.onPress}
      className="w-full flex items-center gap-4 px-5 py-4 text-left"
    >
      {inner}
    </button>
  );
}

export default function SettingsScreen({ onBack, onLogout, onOpenEditProfile }: SettingsScreenProps) {
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifActivity, setNotifActivity] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [dataSharing, setDataSharing] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          icon: <EditIcon size={16} color="#00FFFF" />,
          label: 'Edit Profile',
          subtitle: 'Update your name, bio, and photo',
          onPress: onOpenEditProfile,
        },
        {
          icon: <CheckVerifiedIcon size={16} color="#00FFFF" />,
          label: 'Get Verified',
          subtitle: 'Apply for the verified badge',
          onPress: () => {},
        },
        {
          icon: <GlobeIcon size={16} color="#60A5FA" />,
          label: 'Language',
          subtitle: 'English (US)',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: <BellIcon size={16} color="#FB923C" />,
          label: 'Push Notifications',
          subtitle: 'New actions, follows, mentions',
          toggle: true,
          value: notifPush,
          onToggle: () => setNotifPush(!notifPush),
        },
        {
          icon: <BellIcon size={16} color="#FB923C" />,
          label: 'Email Notifications',
          subtitle: 'Weekly digest and highlights',
          toggle: true,
          value: notifEmail,
          onToggle: () => setNotifEmail(!notifEmail),
        },
        {
          icon: <BellIcon size={16} color="#FB923C" />,
          label: 'Activity Updates',
          subtitle: 'Likes, comments, new followers',
          toggle: true,
          value: notifActivity,
          onToggle: () => setNotifActivity(!notifActivity),
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          icon: <EyeIcon size={16} color="#FFD700" />,
          label: 'Private Account',
          subtitle: 'Only approved followers can see your posts',
          toggle: true,
          value: privateAccount,
          onToggle: () => setPrivateAccount(!privateAccount),
        },
        {
          icon: <ShieldIcon size={16} color="#FFD700" />,
          label: 'Data Sharing',
          subtitle: 'Help improve Actionr with usage data',
          toggle: true,
          value: dataSharing,
          onToggle: () => setDataSharing(!dataSharing),
        },
        {
          icon: <ShieldIcon size={16} color="#FFD700" />,
          label: 'Blocked Users',
          subtitle: '0 blocked',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: <span className="text-base">❓</span>,
          label: 'Help & FAQ',
          onPress: () => {},
        },
        {
          icon: <span className="text-base">📄</span>,
          label: 'Terms of Service',
          onPress: () => {},
        },
        {
          icon: <span className="text-base">🔒</span>,
          label: 'Privacy Policy',
          onPress: () => {},
        },
      ],
    },
    {
      title: '',
      items: [
        {
          icon: <LogOutIcon size={16} color="#FF5555" />,
          label: 'Log Out',
          danger: true,
          onPress: () => setShowLogoutConfirm(true),
        },
      ],
    },
  ];

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h1 className="text-xl font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Settings</h1>
        </div>
      </div>

      <div className="screen-body pb-6">
        <div className="px-5 mb-5">
          <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Avatar src={currentUser.avatar} size={52} />
            <div>
              <p className="font-bold" style={{ color: '#FFFFFF' }}>{currentUser.displayName}</p>
              <p className="text-sm" style={{ color: '#CDE2F0' }}>@{currentUser.username}</p>
            </div>
          </div>
        </div>

        {sections.map((section, si) => (
          <div key={si} className="mb-4">
            {section.title && (
              <p className="text-xs font-semibold uppercase tracking-wider px-5 mb-2" style={{ color: '#4A7A9B' }}>
                {section.title}
              </p>
            )}
            <div className="mx-5 rounded-2xl overflow-hidden" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
              {section.items.map((item, ii) => (
                <div key={ii}>
                  {ii > 0 && <div className="ml-[68px] mr-5 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />}
                  <SettingRow item={item} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-xs mt-4 pb-4" style={{ color: '#4A7A9B' }}>
          Actionr v1.0.0 · Made with ⚡ for changemakers
        </p>
      </div>

      {showLogoutConfirm && (
        <div className="absolute inset-0 flex items-end" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full rounded-t-3xl p-6 animate-slide-up"
            style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <h3 className="text-xl font-black mb-2 text-center" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Log out?
            </h3>
            <p className="text-sm text-center mb-6" style={{ color: '#CDE2F0' }}>
              You will need to log in again to access your account.
            </p>
            <button
              onClick={onLogout}
              className="w-full py-4 rounded-2xl mb-3 text-sm font-bold"
              style={{ background: '#FF5555', color: 'white' }}
            >
              Yes, Log Out
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full py-4 rounded-2xl text-sm font-semibold"
              style={{ background: '#0D2A40', color: '#FFFFFF' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
