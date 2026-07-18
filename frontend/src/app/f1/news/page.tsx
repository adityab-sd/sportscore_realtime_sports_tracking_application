// ============================================================================
// PLEASE review — Empty F1 news index ships a broken page
// ----------------------------------------------------------------------------
// This page.tsx has no default export and no empty/error handling, so /f1/news
// will fail instead of showing a usable news list or coming-soon state.
//
// EXAMPLE:
//   export default async function F1NewsPage() {
//     const articles = await getF1News();
//     return articles.length === 0 ? <EmptyState title="No F1 news available" /> : <NewsList articles={articles} />;
//   }
// ============================================================================
