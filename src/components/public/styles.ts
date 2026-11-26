/** Class names shared by the themed public pages (profile, booking, appointment). All colors are `--t-*` tokens. */

const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto";

export const tButton = {
  primary: `${base} bg-th-primary text-th-onp hover:brightness-110`,
  secondary: `${base} border border-th-line bg-th-surface text-th-text hover:bg-th-soft`,
  danger: `${base} bg-th-danger text-th-bg hover:brightness-110`,
} as const;

/** Same as `tButton` but always full width (call-to-action rows). */
export const tLink =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-th-line bg-th-surface px-5 text-base font-bold text-th-text hover:bg-th-soft";
