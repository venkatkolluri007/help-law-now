import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="legal-page mx-auto min-h-screen max-w-3xl px-6 py-12 text-foreground">
    <Button asChild variant="outline"><Link to="/">Back to Ally AI</Link></Button>
    <h1 className="mt-10 text-3xl font-semibold">{title}</h1>
    <div className="mt-8 space-y-6 text-base leading-relaxed">{children}</div>
    <nav className="mt-12 flex gap-6 border-t border-border pt-6 text-sm"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav>
  </main>;
}