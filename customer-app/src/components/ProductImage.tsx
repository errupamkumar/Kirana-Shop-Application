import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { categoryVisual } from '../lib/categoryVisuals';
import { mediaUrl } from '../lib/env';

/**
 * Product or category photo. Without an uploaded image it shows the category's illustration on a soft tint,
 * so the catalog still looks intentional before the store adds photos.
 */
export function ProductImage({
  url,
  name,
  size,
  category,
}: {
  url: string | null;
  name: string;
  size: number;
  /** Category name or slug used to pick the placeholder illustration. */
  category?: string | null;
}) {
  const src = mediaUrl(url);
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        accessibilityLabel={name}
        // Photos have mixed shapes: fill the square tile so grids stay even
        style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#f3f4f6' }}
        contentFit="cover"
        contentPosition="center"
        transition={150}
      />
    );
  }
  const visual = categoryVisual(category ?? name);
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={{ width: size, height: size, backgroundColor: visual.tint }}
      className="items-center justify-center rounded-xl"
    >
      <Text style={{ fontSize: Math.round(size / 2.4) }}>{visual.emoji}</Text>
    </View>
  );
}
