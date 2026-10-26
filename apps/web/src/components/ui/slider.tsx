'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>): React.ReactElement {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center py-3', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-gunmetal-700">
        <SliderPrimitive.Range className="absolute h-full bg-forge-500" />
      </SliderPrimitive.Track>
      {/* 24px thumb: still hittable with gloves without crowding the track. */}
      <SliderPrimitive.Thumb
        className={cn(
          'block size-6 rounded-full border-2 border-forge-500 bg-gunmetal-900 shadow',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forge-500',
        )}
      />
    </SliderPrimitive.Root>
  );
}
