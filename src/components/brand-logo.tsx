import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
  showStatus?: boolean;
};

export function BrandLogo({ className, size = 44, showStatus = false }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-visible",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src="/brand/auto-pro-ia-a-logo-transparent.png"
        alt=""
        className="h-full w-full object-contain"
      />
      {showStatus ? (
        <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#25D366] ring-2 ring-sidebar shadow-[0_0_14px_rgba(37,211,102,0.45)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
            className="size-3.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#25D366"
              d="M16 3.25c-6.94 0-12.58 5.54-12.58 12.36 0 2.2.6 4.34 1.72 6.2L3.5 28.75l7.13-1.6A12.8 12.8 0 0 0 16 28c6.94 0 12.58-5.54 12.58-12.36S22.94 3.25 16 3.25Z"
            />
            <path
              fill="#fff"
              d="M22.9 19.12c-.1-.17-.37-.27-.77-.47-.4-.2-2.37-1.15-2.74-1.28-.37-.14-.64-.2-.9.2-.27.4-1.04 1.28-1.28 1.55-.23.27-.47.3-.87.1-.4-.2-1.7-.61-3.24-1.94-1.2-1.04-2-2.32-2.24-2.72-.23-.4-.02-.61.18-.81.18-.18.4-.47.6-.7.2-.24.27-.4.4-.67.14-.27.07-.5-.03-.7-.1-.2-.9-2.14-1.24-2.94-.33-.77-.66-.67-.9-.68h-.77c-.27 0-.7.1-1.07.5-.37.4-1.4 1.35-1.4 3.29 0 1.94 1.44 3.82 1.64 4.09.2.27 2.84 4.27 6.88 5.98.96.41 1.72.66 2.3.84.97.3 1.85.26 2.55.16.78-.11 2.37-.95 2.7-1.87.34-.92.34-1.72.24-1.88Z"
            />
          </svg>
        </span>
      ) : null}
    </span>
  );
}
