import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { UPLOAD_MAX_BYTES } from "@/lib/validation";

export type PreparedImage = { uri: string; base64: string; width: number; height: number };

/**
 * Opens the phone's photo picker and returns a resized JPEG ready to upload,
 * or null if the user cancelled. Every pick (HEIC, PNG, huge camera photos) is
 * re-encoded so uploads stay small and always match the buckets' JPEG/PNG + 5 MB
 * rules. The system picker needs no media-library permission on Android 13+ / iOS 14+.
 * Throws an Error with a readable message on failure.
 */
export async function pickAndPrepareImage(options: { maxEdge: number; square?: boolean; quality?: number }): Promise<PreparedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: Boolean(options.square),
    aspect: options.square ? [1, 1] : undefined,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  // Both target dimensions are passed explicitly: letting the library derive one
  // (`height: null`) fails on web, and explicit sizes behave the same everywhere.
  const context = ImageManipulator.manipulate(asset.uri);
  let width = asset.width;
  let height = asset.height;
  if (asset.width > 0 && asset.height > 0) {
    const scale = Math.min(1, options.maxEdge / Math.max(asset.width, asset.height));
    width = Math.round(asset.width * scale);
    height = Math.round(asset.height * scale);
    context.resize({ width, height });
  }
  const image = await context.renderAsync();
  const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: options.quality ?? 0.85, base64: true });

  if (!output.base64) throw new Error("The photo could not be read. Try another one.");
  if (output.base64.length * 0.75 > UPLOAD_MAX_BYTES) {
    throw new Error("That photo is larger than 5 MB. Choose a smaller one.");
  }
  return { uri: output.uri, base64: output.base64, width: output.width || width, height: output.height || height };
}
