import TagChip from "@/components/profile/tag-chip";
import { CategoryColors, type CategoryId } from "@/constants/theme";

/** Category pill on posts. Uses the cause catalogue colours (same ids as profile tags). */
export default function CategoryTag({ category, label }: { category: string; label?: string }) {
  const fallback = (CategoryColors as Record<string, { label: string } | undefined>)[category as CategoryId]?.label ?? category;
  return <TagChip id={category} label={label ?? fallback} />;
}
