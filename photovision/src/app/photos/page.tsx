import Link from "next/link";

export default function PhotosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation Bar */}
      <nav className="w-full px-6 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PV</span>
            </div>
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">
              PhotoVision
            </Link>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Home
            </Link>
            <Link href="/photos" className="text-blue-600 dark:text-blue-400 font-medium">
              Photos
            </Link>
            <Link href="/admin/data" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Status Indicator */}
      <div className="w-full px-6 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
        <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-700 dark:text-green-400">System Status: Online</span>
          <span className="text-xs text-green-600 dark:text-green-500">• Photo grid ready</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Photo Gallery</h1>
          <p className="text-gray-600 dark:text-gray-300">
            This is where the photo grid will be implemented in Phase 1.3. Currently showing placeholder content.
          </p>
        </div>

        {/* Placeholder Grid Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Grid Settings</h2>
          <div className="flex items-center space-x-4">
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>12 photos per page</option>
              <option>24 photos per page</option>
              <option>48 photos per page</option>
            </select>
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>Sort by date</option>
              <option>Sort by name</option>
              <option>Sort by size</option>
            </select>
          </div>
        </div>

        {/* Placeholder Photo Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Photo {i + 1}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Placeholder image</p>
              </div>
            </div>
          ))}
        </div>

        {/* Placeholder Pagination */}
        <div className="flex justify-center items-center space-x-4 mt-8">
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-400">Page 1 of 5</span>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Next
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2025 PhotoVision. Photo grid implementation coming in Phase 1.3.</p>
        </div>
      </footer>
    </div>
  );
}
