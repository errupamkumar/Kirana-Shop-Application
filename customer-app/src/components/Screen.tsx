import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { MAX_CONTENT_WIDTH } from '../hooks/useLayout';

/** Centres content and caps its width on tablets and desktop; full width on phones. */
export function Container({ children, className, style, ...props }: ViewProps & { children: ReactNode; className?: string }) {
  return (
    <View {...props} className={`w-full self-center ${className ?? ''}`} style={[{ maxWidth: MAX_CONTENT_WIDTH }, style]}>
      {children}
    </View>
  );
}

/** Narrow centred column for forms and single-item screens (login, address, order detail on desktop). */
export function NarrowColumn({ children, className, maxWidth = 560 }: { children: ReactNode; className?: string; maxWidth?: number }) {
  return (
    <View className={`w-full self-center ${className ?? ''}`} style={{ maxWidth }}>
      {children}
    </View>
  );
}
