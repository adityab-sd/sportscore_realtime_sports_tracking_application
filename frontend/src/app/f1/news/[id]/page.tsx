// ============================================================================
// PLEASE review — Missing dynamic article handling
// ----------------------------------------------------------------------------
// This dynamic page is empty, so article ids are neither validated nor converted
// to notFound() when missing. Add explicit fetch, validation, and error handling.
//
// EXAMPLE:
//   export default async function F1ArticlePage({ params }: { params: Promise<{ id: string }> }) {
//     const { id } = await params;
//     if (!/^\d+$/.test(id)) return notFound();
//     const article = await getF1Article(id);
//     if (!article) return notFound();
//     return <ArticleView article={article} />;
//   }
// ============================================================================
