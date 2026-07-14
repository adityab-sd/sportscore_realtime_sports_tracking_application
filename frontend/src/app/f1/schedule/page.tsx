// ============================================================================
// PLEASE review — Empty schedule page breaks the route
// ----------------------------------------------------------------------------
// This page.tsx has no default export, so /f1/schedule cannot render as an App
// Router page. Ship a real page or remove the route until schedule data exists.
//
// EXAMPLE:
//   export default async function F1SchedulePage() {
//     const races = await getF1Schedule();
//     return races.length === 0 ? <EmptyState title="No races scheduled" /> : <RaceSchedule races={races} />;
//   }
// ============================================================================
