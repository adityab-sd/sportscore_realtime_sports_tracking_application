export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to SportScore</h1>
        <p className="text-gray-500">
          Go to <a href="/football" className="text-emerald-600 underline">Football</a> to see live scores
        </p>
      </div>
    </div>
  );
}