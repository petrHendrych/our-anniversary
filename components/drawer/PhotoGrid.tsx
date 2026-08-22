import Image from "next/image";
import type { MemoryPhoto } from "@/data/timeline";

/**
 * The rest of the month's photos. Uniform square tiles rather than a masonry
 * run: real photos arrive in mixed orientations and a fixed tile keeps the
 * grid calm and free of layout shift.
 */
export function PhotoGrid({ photos }: { photos: MemoryPhoto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {photos.map((photo) => (
        <li key={photo.id}>
          <div className="relative aspect-square overflow-hidden rounded-[2px] bg-ink">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
          {photo.caption && (
            <p className="mt-2 text-[0.8125rem] leading-5 text-dim">
              {photo.caption}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
