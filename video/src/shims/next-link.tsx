// Remotion shim for next/link: product components render real markup; navigation is irrelevant in video.
import type { AnchorHTMLAttributes, ReactNode } from 'react';
export default function Link({ href, children, prefetch: _p, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; children?: ReactNode }) {
  return <a href={href} {...rest}>{children}</a>;
}
