'use client';

import { useEffect } from 'react';

/** Marks the desk so the room color covers the mast, page, and footer. */
export function DeskSurface({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.dataset.surface = 'desk';
    return () => {
      delete document.body.dataset.surface;
    };
  }, []);
  return children;
}
