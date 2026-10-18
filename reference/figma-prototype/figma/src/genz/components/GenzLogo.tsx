import logoAsset from '@/assets/genz-logo.png.asset.json';
const logoMark = logoAsset.url;

type GenzLogoProps = {
  /** Controls the overall size. The mark renders at this height; text scales proportionally. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Show just the mark, or mark + wordmark */
  variant?: 'mark' | 'full' | 'stacked';
  className?: string;
};

const SIZE_MAP = {
  xs: { mark: 24, text: 11, gap: 6 },
  sm: { mark: 32, text: 13, gap: 8 },
  md: { mark: 40, text: 15, gap: 10 },
  lg: { mark: 56, text: 18, gap: 12 },
  xl: { mark: 80, text: 22, gap: 14 },
  '2xl': { mark: 140, text: 28, gap: 16 },
};

export default function GenzLogo({ size = 'md', variant = 'full', className = '' }: GenzLogoProps) {
  const s = SIZE_MAP[size];

  const mark = (
    <img
      src={logoMark}
      alt="GenZ in Action logo"
      style={{ width: s.mark, height: s.mark, objectFit: 'contain', flexShrink: 0 }}
    />
  );

  if (variant === 'mark') return <div className={className}>{mark}</div>;

  const wordmark = (
    <div style={{ lineHeight: 1.1 }}>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 900,
          fontSize: s.text,
          color: '#FFFFFF',
          letterSpacing: '-0.02em',
        }}
      >
        GenZ
      </div>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: s.text * 0.78,
          color: '#00FFFF',
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
        }}
      >
        in Action
      </div>
    </div>
  );

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center ${className}`} style={{ gap: s.gap * 0.6 }}>
        {mark}
        <div className="text-center" style={{ lineHeight: 1.1 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 900, fontSize: s.text * 1.2, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            GenZ
          </div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: s.text, color: '#00FFFF', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            in Action
          </div>
        </div>
      </div>
    );
  }

  // 'full' — horizontal mark + wordmark
  return (
    <div className={`flex items-center ${className}`} style={{ gap: s.gap }}>
      {mark}
      {wordmark}
    </div>
  );
}
