/**
 * Official Istithbat lockup (Istithbat Brand.png): the transparent symbol beside the approved
 * stacked wordmark (Istithbat over استثبات). One source for the product header and the landing nav.
 * `auto` ships both theme variants and lets the theme CSS pick; `dark` ships only the on-dark pair.
 */
export function BrandLockup({ theme = 'auto' }: { theme?: 'auto' | 'dark' }) {
  return (
    <>
      {theme === 'auto' && <img className="brand-on-light" src="/brand/istithbat-symbol-on-light.png" alt="" width={31} height={34} />}
      <img className="brand-on-dark" src="/brand/istithbat-symbol-on-dark.png" alt="" width={31} height={34} />
      {theme === 'auto' && <img className="brand-latin brand-on-light" src="/brand/istithbat-wordmark-on-light.png" alt="" width={77} height={34} />}
      <img className="brand-latin brand-on-dark" src="/brand/istithbat-wordmark-on-dark.png" alt="" width={77} height={34} />
    </>
  );
}
