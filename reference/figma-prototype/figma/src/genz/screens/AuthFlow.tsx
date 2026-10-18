import { useState, useEffect } from 'react';
import { AuthScreen } from '../types';
import { StatusBar } from '../components/SharedUI';
import { EyeIcon, EyeOffIcon, CheckIcon } from '../components/Icons';
import GenzLogo from '../components/GenzLogo';
import logoAsset from '@/assets/genz-logo.png.asset.json';
const logoMark = logoAsset.url;
import bannerAsset from '@/assets/genz-auth-banner.png.asset.json';
const genzBannerPng = bannerAsset.url;

const BG = '#0B2239';
const CARD = '#11324D';
const ELEVATED = '#0D2A40';
const CYAN = '#00FFFF';
const GOLD = '#FFD700';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const RED = '#FF5555';
const GREEN = '#32CD32';
const BORDER = 'rgba(0,200,200,0.15)';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="screen items-center justify-between" style={{ background: '#0B2239', paddingTop: 'max(env(safe-area-inset-top, 48px), 48px)', paddingBottom: 48 }}>
      <div />
      <div className="flex flex-col items-center gap-4 w-full px-2">
        <img
          src={logoMark}
          alt="GenZ in Action"
          style={{ width: '100%', maxWidth: 360, height: 'auto', objectFit: 'contain' }}
        />
        <p className="text-base font-semibold text-center leading-relaxed" style={{ color: TEXT2, maxWidth: 300, letterSpacing: '0.01em' }}>
          Learn, Experiment, Build, Demo,{'\n'}Improve and Repeat
        </p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-1 rounded-full" style={{ width: i === 0 ? 20 : 6, background: i === 0 ? CYAN : 'rgba(0,255,255,0.25)' }} />
        ))}
      </div>
    </div>
  );
}

const ONBOARDING_SLIDES = [
  { emoji: '🧪', title: 'Learn & Experiment', subtitle: 'Explore real-world causes, test ideas, and build skills that matter for your generation.', color: CYAN, bg: '#071828' },
  { emoji: '🛠️', title: 'Build & Demo', subtitle: 'Create projects, share your work, and showcase what Gen Z can do to the world.', color: GOLD, bg: '#1A1200' },
  { emoji: '🔄', title: 'Improve & Repeat', subtitle: 'Get feedback, level up your impact, and keep pushing until change actually happens.', color: GREEN, bg: '#071A07' },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const slide = ONBOARDING_SLIDES[step];
  const isLast = step === ONBOARDING_SLIDES.length - 1;

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="flex justify-center px-5 pt-6 pb-4">
        <GenzLogo size="sm" variant="mark" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8 text-6xl" style={{ background: slide.bg, border: `2px solid ${slide.color}30` }}>
          {slide.emoji}
        </div>
        <h2 className="text-3xl font-black mb-4 leading-tight" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.5px' }}>
          {slide.title}
        </h2>
        <p className="text-base leading-relaxed" style={{ color: TEXT2, maxWidth: 300 }}>{slide.subtitle}</p>
      </div>

      <div className="px-6 pb-10">
        <div className="flex justify-center gap-2 mb-8">
          {ONBOARDING_SLIDES.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === step ? 28 : 8, background: i === step ? slide.color : 'rgba(0,200,200,0.2)' }} />
          ))}
        </div>
        <button
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
          style={{ background: slide.color, color: BG }}
        >
          {isLast ? "Let's Go" : 'Continue'}
        </button>
        {!isLast && (
          <button onClick={onDone} className="w-full mt-3 py-2 text-sm" style={{ color: TEXT3 }}>Skip</button>
        )}
      </div>
    </div>
  );
}

type AuthFlowProps = {
  screen: AuthScreen;
  onScreenChange: (s: AuthScreen) => void;
  onSuccess: () => void;
};

export function AuthFlow({ screen, onScreenChange, onSuccess }: AuthFlowProps) {
  if (screen === 'choice') return <AuthChoice onLogin={() => onScreenChange('login')} onSignup={() => onScreenChange('signup')} />;
  if (screen === 'login') return <LoginScreen onBack={() => onScreenChange('choice')} onForgot={() => onScreenChange('forgot')} onSuccess={onSuccess} onSignup={() => onScreenChange('signup')} />;
  if (screen === 'signup') return <SignupScreen onBack={() => onScreenChange('choice')} onSuccess={onSuccess} onLogin={() => onScreenChange('login')} />;
  if (screen === 'forgot') return <ForgotScreen onBack={() => onScreenChange('login')} onSuccess={() => onScreenChange('otp')} />;
  if (screen === 'otp') return <OTPScreen onBack={() => onScreenChange('forgot')} onSuccess={() => onScreenChange('reset')} />;
  if (screen === 'reset') return <NewPasswordScreen onBack={() => onScreenChange('otp')} onSuccess={() => onScreenChange('reset-done')} />;
  if (screen === 'reset-done') return <PasswordResetDoneScreen onLogin={() => onScreenChange('login')} onSuccess={onSuccess} />;
  return null;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEVATED }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function AuthChoice({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="screen-body flex flex-col px-6">
        <div className="flex justify-center pt-8 pb-5">
          <GenzLogo size="xl" variant="mark" />
        </div>

        <div className="w-full rounded-3xl overflow-hidden mb-6" style={{ border: `1px solid ${BORDER}`, boxShadow: '0 0 32px rgba(0,255,255,0.12)' }}>
          <img src={genzBannerPng} alt="GenZ in Action" className="w-full object-contain" style={{ height: 180, background: '#0B2239' }} />
          <div className="p-4" style={{ background: CARD }}>
            <h2 className="text-lg font-black mb-1" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              GenZ in Action
            </h2>
            <p className="text-sm" style={{ color: TEXT2 }}>Learn, Experiment, Build, Demo, Improve and Repeat.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-8">
          <button onClick={onSignup} className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-95" style={{ background: CYAN, color: BG }}>
            Create your account
          </button>
          <button onClick={onLogin} className="w-full py-4 rounded-2xl text-base font-semibold transition-all active:scale-95" style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT2 }}>
            I already have an account
          </button>
          <p className="text-xs text-center mt-1" style={{ color: TEXT3 }}>By joining, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}

type LoginScreenProps = { onBack: () => void; onForgot: () => void; onSuccess: () => void; onSignup: () => void };
function LoginScreen({ onBack, onForgot, onSuccess, onSignup }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(onSuccess, 1500);
  };

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-4 flex items-center gap-3">
        <BackButton onBack={onBack} />
        <GenzLogo size="xs" variant="mark" />
      </div>
      <div className="screen-body px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Welcome back</h1>
          <p className="text-sm" style={{ color: TEXT2 }}>Log in to continue making change.</p>
        </div>
        <div className="flex flex-col gap-4">
          <GenzInput label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} error={errors.email} />
          <GenzInput label="Password" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setErrors({}); }} error={errors.password}
            rightIcon={<button onClick={() => setShowPw(!showPw)} type="button">{showPw ? <EyeOffIcon size={18} color={TEXT3} /> : <EyeIcon size={18} color={TEXT3} />}</button>}
          />
          <button onClick={onForgot} className="text-sm text-right" style={{ color: CYAN }}>Forgot password?</button>
        </div>
        <div className="mt-8">
          <GenzButton loading={loading} onClick={handleSubmit}>Log In</GenzButton>
          <p className="text-sm text-center mt-5" style={{ color: TEXT2 }}>
            New here?{' '}<button onClick={onSignup} style={{ color: CYAN, fontWeight: 600 }}>Create an account</button>
          </p>
        </div>
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px" style={{ background: BORDER }} />
          <span className="text-xs" style={{ color: TEXT3 }}>or continue with</span>
          <div className="flex-1 h-px" style={{ background: BORDER }} />
        </div>
        <div className="flex flex-col gap-3 pb-8">
          {['Google', 'Apple'].map(provider => (
            <button key={provider} onClick={onSuccess} className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold" style={{ background: ELEVATED, color: TEXT1, border: `1px solid ${BORDER}` }}>
              {provider === 'Google' ? '🔵' : '🍎'} Continue with {provider}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type SignupScreenProps = { onBack: () => void; onSuccess: () => void; onLogin: () => void };
function SignupScreen({ onBack, onSuccess, onLogin }: SignupScreenProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', RED, GOLD, GREEN];
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!username.trim()) e.username = 'Username is required';
    else if (username.length < 3) e.username = 'At least 3 characters';
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(onSuccess, 1800);
  };

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-4 flex items-center gap-3">
        <BackButton onBack={onBack} />
        <GenzLogo size="xs" variant="mark" />
      </div>
      <div className="screen-body px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Join the movement</h1>
          <p className="text-sm" style={{ color: TEXT2 }}>Create your account to start making change.</p>
        </div>
        <div className="flex flex-col gap-4">
          <GenzInput label="Full name" placeholder="Your Name" value={name} onChange={e => { setName(e.target.value); setErrors({}); }} error={errors.name} />
          <div>
            <GenzInput label="Username" placeholder="yourhandle" value={username} onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setErrors({}); }} error={errors.username} />
            {username.length >= 3 && !errors.username && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: GREEN }}>
                <CheckIcon size={12} color={GREEN} /> @{username} is available
              </p>
            )}
          </div>
          <GenzInput label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors({}); }} error={errors.email} />
          <div>
            <GenzInput label="Password" type={showPw ? 'text' : 'password'} placeholder="Create a strong password" value={password} onChange={e => { setPassword(e.target.value); setErrors({}); }} error={errors.password}
              rightIcon={<button onClick={() => setShowPw(!showPw)} type="button">{showPw ? <EyeOffIcon size={18} color={TEXT3} /> : <EyeIcon size={18} color={TEXT3} />}</button>}
            />
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map(lvl => (
                    <div key={lvl} className="flex-1 h-1 rounded-full transition-all" style={{ background: pwStrength >= lvl ? strengthColors[pwStrength] : ELEVATED }} />
                  ))}
                </div>
                {pwStrength > 0 && <p className="text-xs mt-1" style={{ color: strengthColors[pwStrength] }}>{strengthLabels[pwStrength]} password</p>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 mb-4">
          <GenzButton loading={loading} onClick={handleSubmit}>Create Account</GenzButton>
        </div>
        <p className="text-sm text-center mb-8" style={{ color: TEXT2 }}>
          Already have an account?{' '}<button onClick={onLogin} style={{ color: CYAN, fontWeight: 600 }}>Log in</button>
        </p>
      </div>
    </div>
  );
}

function ForgotScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return; }
    setLoading(true);
    setTimeout(onSuccess, 1500);
  };
  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-4 flex items-center gap-3">
        <BackButton onBack={onBack} />
        <GenzLogo size="xs" variant="mark" />
      </div>
      <div className="screen-body px-6">
        <div className="mb-8">
          <div className="text-5xl mb-5">🔑</div>
          <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Reset your password</h1>
          <p className="text-sm" style={{ color: TEXT2 }}>Enter your email and we will send you a verification code.</p>
        </div>
        <GenzInput label="Email address" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} error={error} />
        <div className="mt-6"><GenzButton loading={loading} onClick={handleSubmit}>Send Code</GenzButton></div>
      </div>
    </div>
  );
}

function OTPScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const handleChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) document.getElementById(`otp-${idx + 1}`)?.focus();
    if (next.every(d => d !== '')) { setLoading(true); setTimeout(onSuccess, 1200); }
  };
  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-4 flex items-center gap-3">
        <BackButton onBack={onBack} />
        <GenzLogo size="xs" variant="mark" />
      </div>
      <div className="screen-body px-6">
        <div className="mb-8">
          <div className="text-5xl mb-5">📱</div>
          <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Check your email</h1>
          <p className="text-sm" style={{ color: TEXT2 }}>Enter the 6-digit code we sent you.</p>
        </div>
        <div className="flex gap-3 justify-center mb-8">
          {otp.map((digit, idx) => (
            <input key={idx} id={`otp-${idx}`} type="number" inputMode="numeric" maxLength={1} value={digit}
              onChange={e => handleChange(e.target.value, idx)}
              className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none"
              style={{ background: ELEVATED, color: TEXT1, border: digit ? `2px solid ${CYAN}` : `1px solid ${BORDER}` }}
            />
          ))}
        </div>
        {loading && <div className="flex justify-center mb-4"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${CYAN}40`, borderTopColor: CYAN }} /></div>}
        <p className="text-sm text-center" style={{ color: TEXT2 }}>
          Did not receive it?{' '}<button style={{ color: CYAN, fontWeight: 600 }}>Resend code</button>
        </p>
      </div>
    </div>
  );
}

/* ── Shared form primitives ── */
type GenzInputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; rightIcon?: React.ReactNode };
function GenzInput({ label, error, rightIcon, ...props }: GenzInputProps) {
  return (
    <div className="w-full">
      {label && <label className="text-sm font-medium mb-1.5 block" style={{ color: TEXT2 }}>{label}</label>}
      <div className="relative">
        <input {...props} className={`w-full rounded-xl px-4 py-3.5 text-sm outline-none transition-all ${rightIcon ? 'pr-11' : ''}`}
          style={{ background: ELEVATED, color: TEXT1, border: error ? `1px solid ${RED}` : `1px solid ${BORDER}`, fontFamily: "'Inter', sans-serif" }}
        />
        {rightIcon && <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightIcon}</div>}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: RED }}>{error}</p>}
    </div>
  );
}

function GenzButton({ children, loading, onClick, disabled }: { children: React.ReactNode; loading?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-95 flex items-center justify-center"
      style={{ background: disabled ? `${CYAN}50` : CYAN, color: BG, opacity: (disabled || loading) ? 0.7 : 1 }}
    >
      {loading ? <span className="w-5 h-5 border-2 border-[#0B2239]/30 border-t-[#0B2239] rounded-full animate-spin" /> : children}
    </button>
  );
}

/* ── Password reset completion ── */

function NewPasswordScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One number', ok: /\d/.test(password) },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Passwords match', ok: password.length > 0 && password === confirm },
  ];
  const allOk = checks.every(c => c.ok);

  const handleSubmit = () => {
    const e: typeof errors = {};
    if (password.length < 8) e.password = 'Use at least 8 characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(onSuccess, 1500);
  };

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-4 flex items-center gap-3">
        <BackButton onBack={onBack} />
        <GenzLogo size="xs" variant="mark" />
      </div>
      <div className="screen-body px-6">
        <div className="mb-7">
          <div className="text-5xl mb-5">🛠️</div>
          <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Set a new password</h1>
          <p className="text-sm" style={{ color: TEXT2 }}>Code verified. Choose a password you have not used before.</p>
        </div>

        <div className="flex flex-col gap-4">
          <GenzInput
            label="New password"
            type={showPw ? 'text' : 'password'}
            placeholder="Create a strong password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors({}); }}
            error={errors.password}
            rightIcon={<button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOffIcon size={18} color={TEXT3} /> : <EyeIcon size={18} color={TEXT3} />}</button>}
          />
          <GenzInput
            label="Confirm new password"
            type={showPw ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setErrors({}); }}
            error={errors.confirm}
          />
        </div>

        <div className="mt-5 rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: TEXT3 }}>Password checklist</p>
          <div className="flex flex-col gap-2">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: c.ok ? 'rgba(50,205,50,0.15)' : ELEVATED }}
                >
                  {c.ok
                    ? <CheckIcon size={10} color={GREEN} />
                    : <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEXT3 }} />}
                </span>
                <span className="text-xs" style={{ color: c.ok ? GREEN : TEXT2 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pb-8">
          <GenzButton loading={loading} disabled={!allOk} onClick={handleSubmit}>Update Password</GenzButton>
          <p className="text-xs text-center mt-3" style={{ color: TEXT3 }}>
            Updating your password signs you out of all other devices.
          </p>
        </div>
      </div>
    </div>
  );
}

function PasswordResetDoneScreen({ onLogin, onSuccess }: { onLogin: () => void; onSuccess: () => void }) {
  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="screen-body px-6 flex flex-col items-center justify-center text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(50,205,50,0.1)', border: `2px solid ${GREEN}55` }}
        >
          <CheckIcon size={40} color={GREEN} />
        </div>
        <h1 className="text-3xl font-black mb-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Password updated
        </h1>
        <p className="text-sm mb-6" style={{ color: TEXT2, maxWidth: 300 }}>
          Your password has been changed. You can jump straight back in, or log in fresh on this device.
        </p>

        <div className="w-full rounded-2xl p-4 mb-8" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3 text-left">
            <span className="text-xl">🔐</span>
            <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>
              We signed you out everywhere else. If this reset was not you, contact support right away.
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 pb-10">
          <GenzButton onClick={onSuccess}>Continue to app</GenzButton>
          <button onClick={onLogin} className="w-full py-3.5 rounded-2xl text-sm font-semibold" style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT2 }}>
            Back to log in
          </button>
        </div>
      </div>
    </div>
  );
}
