import Image from 'next/image';
import Link from 'next/link';

const LINKS = [
  { href: '/support', label: 'Support' },
  { href: '/status', label: 'System status' },
  { href: '/careers', label: 'Careers' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/security', label: 'Report security issues' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/cookies', label: 'Cookie preferences' },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="frame site-foot-row">
        <nav className="site-foot-nav" aria-label="Site">
          {LINKS.map((link, index) => (
            <span key={link.href} className="site-foot-item">
              {index > 0 ? <span className="site-foot-sep" aria-hidden="true" /> : null}
              <Link href={link.href}>{link.label}</Link>
            </span>
          ))}
        </nav>
        <p className="site-foot-copy">© 2026 firstround</p>
      </div>
      <div className="frame site-foot-mark" aria-hidden="true">
        <Image
          src="/brand/firstround-logo.svg"
          alt=""
          className="site-foot-logo"
          width={3028}
          height={699}
          unoptimized
        />
      </div>
    </footer>
  );
}
