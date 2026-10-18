import { useState } from 'react';
import { currentUser } from '../data';
import { Button, Input, Avatar, StatusBar } from '../components/SharedUI';
import { MapPinIcon, GlobeIcon } from '../components/Icons';

type EditProfileScreenProps = {
  onBack: () => void;
  onSave: () => void;
};

export default function EditProfileScreen({ onBack, onSave }: EditProfileScreenProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [cause, setCause] = useState(currentUser.cause);
  const [location, setLocation] = useState(currentUser.location);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave();
    }, 1200);
  };

  const hasChanges = displayName !== currentUser.displayName ||
    username !== currentUser.username ||
    bio !== currentUser.bio;

  return (
    <div className="screen" style={{ background: '#0B2239' }}>
      <StatusBar />

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: '#0D2A40' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h1 className="text-lg font-black" style={{ color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Edit Profile</h1>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave} disabled={!hasChanges}>
            Save
          </Button>
        </div>
      </div>

      <div className="screen-body px-5 pb-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar src={currentUser.avatar} size={88} />
            <button
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#00BFBF', border: '2px solid #0B2239' }}
            >
              <span className="text-sm">📷</span>
            </button>
          </div>
          <button className="text-sm font-semibold mt-3" style={{ color: '#00FFFF' }}>
            Change Photo
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
          <div>
            <Input
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
            />
            <p className="text-xs mt-1" style={{ color: '#CDE2F0' }}>actionr.app/@{username}</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5" style={{ color: '#CDE2F0' }}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell your story..."
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Inter', sans-serif" }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#4A7A9B' }}>{bio.length}/160</p>
          </div>
          <Input
            label="Primary Cause"
            value={cause}
            onChange={e => setCause(e.target.value)}
            placeholder="e.g. Climate Justice"
          />
          <div>
            <label className="text-sm font-medium block mb-1.5 flex items-center gap-2" style={{ color: '#CDE2F0' }}>
              <MapPinIcon size={14} color="#CDE2F0" /> Location
            </label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="City, State"
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
              style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5 flex items-center gap-2" style={{ color: '#CDE2F0' }}>
              <GlobeIcon size={14} color="#CDE2F0" /> Website
            </label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
              style={{ background: '#0D2A40', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        <div className="mt-6 p-4 rounded-2xl" style={{ background: '#11324D', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#FFFFFF' }}>Danger Zone</h3>
          <button className="text-sm font-semibold" style={{ color: '#FF5555' }}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
