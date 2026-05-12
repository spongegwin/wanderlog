"use client";

interface AvatarProps {
  name: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };

export default function Avatar({ name, color, size = "md" }: AvatarProps) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color ?? "#9a9189" }}
      title={name ?? "Unknown"}
    >
      {initials}
    </div>
  );
}
