import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

interface SectionHeaderProps {
  label: string;
  linkHref?: string;
  linkLabel?: string;
}

export function SectionHeader({ label, linkHref, linkLabel }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{label}</span>
      {linkHref && (
        <Link
          to={linkHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
        >
          {linkLabel ?? 'View all'}
          <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
