// ============================================================================
// PLEASE review — Missing dynamic race page contract
// ----------------------------------------------------------------------------
// This dynamic page is empty, so /f1/race/[id] has no default export, no id
// validation, and no notFound() path for unknown races.
//
// EXAMPLE:
//   export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
//     const { id } = await params;
//     if (!/^\d+$/.test(id)) return notFound();
//     const race = await getRace(id);
//     if (!race) return notFound();
//     return <RaceDetail race={race} />;
//   }
// ============================================================================
