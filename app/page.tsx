import { MonthRunner } from "@/components/canvas/MonthRunner";
import { AfterLens } from "@/components/layout/AfterLens";
import { MonthDrawer } from "@/components/drawer/MonthDrawer";
import { IntroSection } from "@/components/layout/IntroSection";
import { MonthSection } from "@/components/layout/MonthSection";
import { MonthTitleRunner } from "@/components/layout/MonthTitleRunner";
import { OutroSection } from "@/components/layout/OutroSection";
import { ProgressHeader } from "@/components/layout/ProgressHeader";
import { ScrollDriver } from "@/components/layout/ScrollDriver";
import { ThemeShift } from "@/components/layout/ThemeShift";
import { SideNav } from "@/components/layout/SideNav";
import { YearHeader } from "@/components/layout/YearHeader";
import { getMonthIndex, years } from "@/lib/timeline";

export default function Home() {
  return (
    <>
      <ScrollDriver />
      <ThemeShift />
      <MonthRunner />
      <MonthTitleRunner />

      <AfterLens>
        <ProgressHeader />
        <SideNav />
      </AfterLens>

      {/* Taps fall through the text layer to the cards behind it. */}
      <main className="pointer-events-none pr-10">
        <IntroSection />

        {years.map((year) => (
          <div key={year.year} data-year-block className="relative">
            <YearHeader year={year} />
            {year.months.map((month) => (
              <MonthSection
                key={month.id}
                month={month}
                index={getMonthIndex(month.id)}
              />
            ))}
          </div>
        ))}

        <OutroSection />
      </main>

      <MonthDrawer />
    </>
  );
}
