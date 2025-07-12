export default function TestTailwind() {
    return (
      <div className="min-h-screen bg-blue-500 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Tailwind Test</h1>
          <p className="text-gray-600">If you see colors and styling, Tailwind is working!</p>
          <button className="bg-orange-500 text-white px-4 py-2 rounded mt-4 hover:bg-orange-600">Test Button</button>
        </div>
      </div>
    )
  }
  