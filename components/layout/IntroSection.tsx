import { CalendarSpine } from "@/components/layout/CalendarSpine";
import { monthCount, rangeLabel } from "@/lib/timeline";

export function IntroSection() {
  return (
    <section className="relative z-10 flex min-h-[100svh] flex-col justify-between px-5 pb-12 pt-28">
      <div className="flex flex-1 flex-col justify-center">
        <p className="eyebrow text-dim">{rangeLabel}</p>
        <h1 className="display mt-4 text-[22vw]">Two years</h1>
        <p className="mt-6 max-w-[22rem] text-[0.9375rem] leading-6 text-dim">
          {monthCount} months we wrote down, in the order they happened.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <CalendarSpine orientation="horizontal" />
        <p className="eyebrow text-bone/40">Scroll</p>
      </div>
    </section>
  );
}
