'use client';

import { ReactNode } from 'react';

import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NativeButtonProps extends ButtonProps {
  children: ReactNode;
  loading?: boolean;
  glow?: boolean;
}

const NativeButton = ({
  className,
  variant = 'default',
  size = 'lg',
  children,
  loading = false,
  glow = false,
  disabled,
  ...props
}: NativeButtonProps) => {
  const shouldReduceMotion = useReducedMotion();

  const buttonContent = (
    <>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <motion.span
        className={cn('flex items-center gap-2')}
        animate={loading ? { opacity: shouldReduceMotion ? 1 : [1, 0.5, 1] } : { opacity: 1 }}
        transition={
          loading && !shouldReduceMotion ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
        }
      >
        {children}
      </motion.span>
    </>
  );

  const glassmorphismClassName = cn(
    'cursor-pointer relative overflow-hidden',
    !glow && 'shadow-md hover:shadow-lg',
    glow &&
      'shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-[box-shadow,background-color,color,opacity] duration-200',
    variant === 'outline' && 'text-foreground/80 hover:bg-foreground/5',
    (disabled || loading) && 'opacity-50 cursor-not-allowed grayscale',
    className
  );

  return (
    <motion.div
      whileHover={!disabled && !loading && !shouldReduceMotion ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading && !shouldReduceMotion ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className="relative block w-fit"
    >
      {glow && !disabled && !loading && (
        <div className="bg-primary/20 absolute inset-0 rounded-full opacity-0 blur-xl transition-opacity duration-500 hover:opacity-100" />
      )}
      <Button
        variant={variant}
        size={size}
        className={glassmorphismClassName}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {buttonContent}
      </Button>
    </motion.div>
  );
};

NativeButton.displayName = 'NativeButton';

export { NativeButton };
