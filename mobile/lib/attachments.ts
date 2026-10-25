import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import { pickAndPrepareImage } from "@/lib/image";
import type { PickedAttachment } from "@/types/community";

/** Community uploads (decision D50): JPEG/PNG photos resized on the phone (≤5 MB), PDFs up to 10 MB. */
export const COMMUNITY_IMAGE_EDGE = 1600;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
const NAME_MAX = 120;

function cleanName(name: string, fallback: string) {
  const trimmed = name.trim() || fallback;
  if (trimmed.length <= NAME_MAX) return trimmed;
  const dot = trimmed.lastIndexOf(".");
  const ext = dot > 0 ? trimmed.slice(dot) : "";
  return trimmed.slice(0, NAME_MAX - ext.length) + ext;
}

/** Photo picker → resized JPEG. Null if cancelled. Throws an Error with a readable message. */
export async function pickCommunityPhoto(): Promise<PickedAttachment | null> {
  const img = await pickAndPrepareImage({ maxEdge: COMMUNITY_IMAGE_EDGE });
  if (!img) return null;
  return { kind: "image", ...img, name: "photo.jpg" };
}

/** Document picker limited to PDF. Null if cancelled. Throws an Error with a readable message. */
export async function pickCommunityPdf(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const isPdf = (asset.mimeType ?? "").toLowerCase() === "application/pdf" || asset.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Only PDF documents can be attached.");
  if (asset.size && asset.size > PDF_MAX_BYTES) throw new Error("That PDF is larger than 10 MB. Choose a smaller one.");

  let bytes: Uint8Array;
  if (Platform.OS === "web" && asset.file) {
    bytes = new Uint8Array(await asset.file.arrayBuffer());
  } else {
    bytes = await new File(asset.uri).bytes();
  }
  if (bytes.length > PDF_MAX_BYTES) throw new Error("That PDF is larger than 10 MB. Choose a smaller one.");
  // A real PDF starts with "%PDF" — the bucket also checks the declared type.
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new Error("That file doesn't look like a PDF.");
  }
  return { kind: "pdf", uri: asset.uri, bytes, size: bytes.length, name: cleanName(asset.name, "document.pdf") };
}

/** "2.4 MB", "640 KB". */
export function formatBytes(size: number | null | undefined): string {
  if (!size || size <= 0) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}
