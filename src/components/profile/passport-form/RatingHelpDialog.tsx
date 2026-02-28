'use client';

import { CircleHelp } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

export function RatingHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="cursor-pointer" size="icon" aria-label="Rating help">
          <CircleHelp className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Padel rating systems</DialogTitle>
          <DialogDescription>
            Playtomic is a 0-7 scale used by clubs and apps. WPR is a 0-21 global rating standard. We use your ratings
            to match within a 20% range.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            <a
              href="https://playtomic.io"
              target="_blank"
              rel="noreferrer"
              className={`${buttonVariants({ variant: 'link' })} text-primary!`}
            >
              Playtomic official site
            </a>
          </p>
          <p>
            <a
              href="https://worldpadelrating.com"
              target="_blank"
              rel="noreferrer"
              className={`${buttonVariants({ variant: 'link' })} text-primary!`}
            >
              World Padel Rating (WPR)
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
