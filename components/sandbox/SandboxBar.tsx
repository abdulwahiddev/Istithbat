import Link from 'next/link';
import { BrandLockup } from '@/components/strata/BrandLockup';
import { Icon } from '@/components/strata/icons';
import { ThemeSwitch } from '@/components/strata/theme';
import { JudgeGuideButton } from '@/components/strata/JudgeGuide';

/** Demo-control header: official lockup, the environment label, theme, and the way back to the product. */
export function SandboxBar() {
  return (
    <header className="sbx-bar">
      <div className="wrap sbx-bar-in">
        <span className="sbx-bar-l">
          <Link href="/" aria-label="Istithbat home" className="brand"><BrandLockup /></Link>
          <span className="sbx-env"><Icon name="flask-conical" size={14} />Demo sandbox<span className="sbx-env-sub"> · Controlled test environment</span></span>
        </span>
        <span className="sbx-bar-r">
          <JudgeGuideButton />
          <ThemeSwitch />
          <Link prefetch={false} className="btn btn-ghost sbx-btn-s" href="/overview">Back to Istithbat<Icon name="arrow-up-right" size={16} /></Link>
        </span>
      </div>
    </header>
  );
}
